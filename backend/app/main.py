import json, os, shutil, uuid
from pathlib import Path
from typing import Optional
import httpx
from fastapi import Body, FastAPI, Depends, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Field, Session, SQLModel, create_engine, select
from .seed import CURATED_PROFILES, SEED_FRAGRANCES
from .pairing_engine import recommendations, candidate

DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data")); IMAGE_DIR = Path(os.getenv("IMAGE_DIR", "/app/images/bottles"))
DATA_DIR.mkdir(parents=True, exist_ok=True); IMAGE_DIR.mkdir(parents=True, exist_ok=True)
engine = create_engine(os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR}/scentmate.db"), connect_args={"check_same_thread": False})

class Fragrance(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str; brand: str = ""; format: str = "unknown"
    family_tags: str = "[]"; character_tags: str = "[]"; profile_confidence: str = "unknown"
    image_path: Optional[str] = None; is_favorite: bool = False; is_archived: bool = False
    user_feedback: Optional[str] = None; notes: Optional[str] = None

class Combination(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    main_fragrance_id: int; paired_fragrance_id: int; pairing_mode: str
    compatibility_score: int; rule_ids: str = "[]"; explanation: str = ""
    status: str = "saved"; user_feedback: Optional[str] = None

class WearHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    main_fragrance_id: int; paired_fragrance_id: Optional[int] = None
    occasion: str = "everyday"; selected_at: str = Field(default_factory=lambda: __import__("datetime").datetime.utcnow().isoformat())

def session():
    with Session(engine) as s: yield s
def output(item: Fragrance):
    row = item.model_dump(); row["family_tags"] = json.loads(row["family_tags"]); row["character_tags"] = json.loads(row["character_tags"]); return row
def combination_output(item: Combination, s: Session):
    row=item.model_dump(); row["rule_ids"]=json.loads(row["rule_ids"])
    main=s.get(Fragrance,item.main_fragrance_id); pair=s.get(Fragrance,item.paired_fragrance_id)
    row["main"]=output(main) if main else None; row["pair"]=output(pair) if pair else None
    return row
def seed():
    with Session(engine) as s:
        if not s.exec(select(Fragrance)).first():
            for f in SEED_FRAGRANCES:
                f = f.copy(); f["family_tags"] = json.dumps(f.get("family_tags", [])); f["character_tags"] = json.dumps(f.get("character_tags", [])); s.add(Fragrance(**f))
        # Correct confirmed names without changing the user's profile data.
        for row in s.exec(select(Fragrance)).all():
            if row.name == "9 PM Original": row.name = "9 PM"; row.brand = "Afnan"
            if row.name == "Odd Father (possibly Godfather)": row.name = "Godfather"; row.brand = "Beardo"
            profile = CURATED_PROFILES.get(row.name)
            if profile and row.profile_confidence != "user-confirmed":
                families, characters = profile
                row.family_tags = json.dumps(families)
                row.character_tags = json.dumps(characters)
                row.profile_confidence = "inferred"
                s.add(row)
        s.commit()

app = FastAPI(title="Scentmate Stage 3")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
@app.on_event("startup")
def startup(): SQLModel.metadata.create_all(engine); seed()
@app.get("/api/health")
def health(): return {"status":"ok", "stage":3}
@app.get("/api/fragrances")
def list_fragrances(q: str = "", kind: str = "all", favorite: bool = False, include_archived: bool = False, s: Session = Depends(session)):
    rows = s.exec(select(Fragrance)).all()
    q = q.lower(); rows = [r for r in rows if (include_archived or not r.is_archived) and (kind == "all" or r.format == kind) and (not favorite or r.is_favorite) and (not q or q in (r.name+r.brand).lower())]
    return [output(r) for r in rows]
@app.post("/api/fragrances")
def create_fragrance(data: dict, s: Session = Depends(session)):
    item = Fragrance(name=data.get("name", "Untitled"), brand=data.get("brand", ""), format=data.get("format", "unknown"), notes=data.get("notes"), profile_confidence=data.get("profile_confidence", "unknown")); s.add(item); s.commit(); s.refresh(item); return output(item)
@app.patch("/api/fragrances/{item_id}")
def update_fragrance(item_id: int, data: dict, s: Session = Depends(session)):
    item=s.get(Fragrance,item_id)
    if not item: raise HTTPException(404,"Fragrance not found")
    for k,v in data.items():
        if k in {"family_tags","character_tags"}: v=json.dumps(v)
        if hasattr(item,k): setattr(item,k,v)
    s.add(item); s.commit(); s.refresh(item); return output(item)
@app.delete("/api/fragrances/{item_id}")
def delete_fragrance(item_id:int, s:Session=Depends(session)):
    item=s.get(Fragrance,item_id)
    if not item: raise HTTPException(404,"Fragrance not found")
    if item.image_path: (IMAGE_DIR/Path(item.image_path).name).unlink(missing_ok=True)
    for combo in s.exec(select(Combination).where((Combination.main_fragrance_id==item_id) | (Combination.paired_fragrance_id==item_id))).all(): s.delete(combo)
    s.delete(item);s.commit();return {"deleted":True}
@app.post("/api/fragrances/{item_id}/image")
async def upload_image(item_id: int, image: UploadFile = File(...), s: Session = Depends(session)):
    item=s.get(Fragrance,item_id)
    if not item: raise HTTPException(404,"Fragrance not found")
    if image.content_type not in {"image/jpeg","image/png","image/webp"}: raise HTTPException(415,"Use JPEG, PNG, or WebP")
    contents=await image.read()
    if len(contents)>8*1024*1024: raise HTTPException(413,"Image must be 8 MB or smaller")
    suffix={"image/jpeg":".jpg","image/png":".png","image/webp":".webp"}[image.content_type]; filename=f"{uuid.uuid4().hex}{suffix}"
    (IMAGE_DIR/filename).write_bytes(contents); item.image_path=f"/images/bottles/{filename}"; s.add(item); s.commit(); s.refresh(item); return output(item)
@app.delete("/api/fragrances/{item_id}/image")
def remove_image(item_id: int, s: Session = Depends(session)):
    item=s.get(Fragrance,item_id)
    if not item: raise HTTPException(404,"Fragrance not found")
    if item.image_path: (IMAGE_DIR/Path(item.image_path).name).unlink(missing_ok=True)
    item.image_path=None; s.add(item); s.commit(); s.refresh(item); return output(item)
@app.post("/api/fragrances/{item_id}/image-search")
async def image_search(item_id:int, data:dict=Body(default={}), s:Session=Depends(session)):
    item=s.get(Fragrance,item_id)
    if not item: raise HTTPException(404,"Fragrance not found")
    search_terms=str(data.get("query") or f"{item.brand} {item.name}").strip()
    if not search_terms: raise HTTPException(422,"Enter a fragrance or brand to search")
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r=await client.get("https://world.openbeautyfacts.org/cgi/search.pl", params={"search_terms":search_terms,"search_simple":1,"action":"process","json":1,"page_size":12,"fields":"product_name,brands,image_front_url,image_url,code"}); r.raise_for_status()
        return [{"name":x.get("product_name"),"brand":x.get("brands"),"image_url":x.get("image_front_url") or x.get("image_url"),"source":"Open Beauty Facts","code":x.get("code")} for x in r.json().get("products",[]) if x.get("image_front_url") or x.get("image_url")]
    except Exception: return []
@app.post("/api/fragrances/{item_id}/image-select")
async def select_image(item_id:int, data:dict, s:Session=Depends(session)):
    """Download only a user-confirmed candidate to persistent local storage."""
    item=s.get(Fragrance,item_id)
    url=str(data.get("image_url", ""))
    if not item: raise HTTPException(404,"Fragrance not found")
    if not url.startswith(("https://","http://")): raise HTTPException(422,"A valid image URL is required")
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            response=await client.get(url, headers={"User-Agent":"Scentmate/1.0"}); response.raise_for_status()
        content_type=response.headers.get("content-type", "").split(";")[0].lower()
        if content_type not in {"image/jpeg","image/png","image/webp"}: raise HTTPException(415,"Candidate is not a supported image")
        if len(response.content)>8*1024*1024: raise HTTPException(413,"Candidate image is too large")
        suffix={"image/jpeg":".jpg","image/png":".png","image/webp":".webp"}[content_type]; filename=f"{uuid.uuid4().hex}{suffix}"
        (IMAGE_DIR/filename).write_bytes(response.content); item.image_path=f"/images/bottles/{filename}"; s.add(item);s.commit();s.refresh(item);return output(item)
    except HTTPException: raise
    except Exception: raise HTTPException(502,"Could not download this image")
@app.get("/api/recommendations")
def get_recommendations(occasion: str = "everyday", main_id: Optional[int] = None, mode: Optional[str] = None, s: Session = Depends(session)):
    fragrances=[output(x) for x in s.exec(select(Fragrance)).all() if not x.is_archived]
    saved=s.exec(select(Combination)).all(); feedback={(x.main_fragrance_id,x.paired_fragrance_id):x.user_feedback for x in saved if x.status != "archived" and x.user_feedback}
    history=s.exec(select(WearHistory).order_by(WearHistory.id.desc()).limit(8)).all()
    recent={(x.main_fragrance_id,x.paired_fragrance_id) for x in history if x.paired_fragrance_id}
    return recommendations(fragrances,occasion,main_id,mode,feedback,recent)
@app.get("/api/fragrances/{item_id}/pairings")
def get_pairings(item_id:int, occasion:str="everyday", mode:Optional[str]=None, s:Session=Depends(session)):
    if not s.get(Fragrance,item_id): raise HTTPException(404,"Fragrance not found")
    return get_recommendations(occasion,item_id,mode,s)
@app.post("/api/combinations")
def save_combination(data:dict, s:Session=Depends(session)):
    main=s.get(Fragrance,int(data["main_fragrance_id"])); pair=s.get(Fragrance,int(data["paired_fragrance_id"]))
    if not main or not pair: raise HTTPException(404,"Fragrance not found")
    item=candidate(output(main),output(pair),data.get("occasion","everyday"))
    if not item: raise HTTPException(422,"This combination does not pass a pairing rule")
    existing=s.exec(select(Combination).where(Combination.main_fragrance_id==main.id,Combination.paired_fragrance_id==pair.id)).first()
    if existing: return combination_output(existing,s)
    saved=Combination(main_fragrance_id=main.id,paired_fragrance_id=pair.id,pairing_mode=item["mode"],compatibility_score=item["score"],rule_ids=json.dumps([r["id"] for r in item["rules"]]),explanation=item["explanation"])
    s.add(saved);s.commit();s.refresh(saved);return combination_output(saved,s)
@app.get("/api/combinations")
def list_combinations(s:Session=Depends(session)):
    return [combination_output(x,s) for x in s.exec(select(Combination)).all() if x.status!="archived"]
@app.patch("/api/combinations/{item_id}/feedback")
def combination_feedback(item_id:int, data:dict, s:Session=Depends(session)):
    item=s.get(Combination,item_id)
    if not item: raise HTTPException(404,"Combination not found")
    feedback=data.get("feedback")
    if feedback not in {"loved","good","didnt_work",None}: raise HTTPException(422,"Invalid feedback")
    item.user_feedback=feedback;s.add(item);s.commit();s.refresh(item);return combination_output(item,s)
@app.patch("/api/combinations/{item_id}")
def archive_combination(item_id:int, s:Session=Depends(session)):
    item=s.get(Combination,item_id)
    if not item: raise HTTPException(404,"Combination not found")
    item.status="archived";s.add(item);s.commit();return {"archived":True}
@app.post("/api/wear")
def record_wear(data:dict, s:Session=Depends(session)):
    main_id=int(data["main_fragrance_id"]); pair_id=data.get("paired_fragrance_id")
    if not s.get(Fragrance,main_id): raise HTTPException(404,"Fragrance not found")
    if pair_id and not s.get(Fragrance,int(pair_id)): raise HTTPException(404,"Fragrance not found")
    row=WearHistory(main_fragrance_id=main_id,paired_fragrance_id=int(pair_id) if pair_id else None,occasion=data.get("occasion","everyday"));s.add(row);s.commit();return {"recorded":True}
@app.get("/api/history")
def wear_history(s:Session=Depends(session)):
    rows=s.exec(select(WearHistory).order_by(WearHistory.id.desc()).limit(8)).all()
    return [{"id":x.id,"occasion":x.occasion,"selected_at":x.selected_at,"main":output(s.get(Fragrance,x.main_fragrance_id)),"pair":output(s.get(Fragrance,x.paired_fragrance_id)) if x.paired_fragrance_id else None} for x in rows]
app.mount("/images", StaticFiles(directory=str(IMAGE_DIR.parent)), name="images")
DIST = Path("/app/frontend/dist")
if DIST.exists(): app.mount("/", StaticFiles(directory=str(DIST), html=True), name="frontend")
