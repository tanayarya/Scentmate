"""Deterministic, explainable pairing rules for Stage 2.

This module deliberately has no network calls and no randomization. It only uses
stored tags and profile confidence from collection records.
"""
from typing import Any, Optional

OCCASION_TAGS = {
    "office": {"clean", "aromatic", "soft", "woody"},
    "casual": set(),
    "date-night": {"warm", "sweet", "woody", "amber", "gourmand", "musk"},
    "party": {"bold", "sweet", "amber", "aromatic"},
    "wedding": {"woody", "aromatic", "amber"},
    "summer-day": {"fresh", "citrus", "aquatic", "green", "aromatic"},
    "winter-evening": {"warm", "amber", "woody", "spicy", "gourmand"},
    "relaxed-evening": {"warm", "soft", "musk", "gourmand"},
    "special-occasion": {"bold", "amber", "woody", "spicy"},
    "everyday": {"fresh", "clean", "aromatic"},
}
FRESH_TAGS = {"fresh", "citrus", "aquatic", "green", "aromatic", "clean"}
WARM_TAGS = {"warm", "amber", "gourmand", "vanilla", "sweet", "spicy"}

def tags(f: dict[str, Any]) -> set[str]:
    return set(f.get("family_tags", [])) | set(f.get("character_tags", []))

def supported(f: dict[str, Any]) -> bool:
    return f.get("profile_confidence") != "unknown" and bool(tags(f))

def duplicate_profile(main: dict[str, Any], pair: dict[str, Any]) -> bool:
    """Avoid presenting near-identical profiles as an interesting pairing."""
    a, b = tags(main), tags(pair)
    union = a | b
    return bool(union) and len(a & b) / len(union) >= 0.75

def rule_matches(main: dict[str, Any], pair: dict[str, Any]) -> list[dict[str, str]]:
    """Return every named rule which is actually supported by stored tags."""
    if not supported(main) or not supported(pair) or duplicate_profile(main, pair): return []
    a, b = tags(main), tags(pair); matches=[]
    if "woody" in a and "woody" in b:
        matches.append({"id":"R_WOODY_WOODY","mode":"reinforce","why":"Both profiles carry a stored woody tag, so this reinforces a woody direction."})
    if (({"sweet","gourmand"} & a) and "woody" in b) or (({"sweet","gourmand"} & b) and "woody" in a):
        matches.append({"id":"R_SWEET_DRY_WOODS","mode":"contrast","why":"A stored sweet/gourmand profile is balanced by stored woody character."})
    if ((FRESH_TAGS & a) and "woody" in b) or ((FRESH_TAGS & b) and "woody" in a):
        matches.append({"id":"R_FRESH_WOODY","mode":"freshen","why":"A stored fresh or aromatic direction is given structure by a stored woody tag."})
    if (FRESH_TAGS & a) and (FRESH_TAGS & b) and len(a & b) <= 1:
        matches.append({"id":"R_FRESH_LIFT","mode":"freshen","why":"The profiles share a light stored direction while retaining enough contrast to layer cleanly."})
    if (({"vanilla","amber","gourmand"} & a) and ({"vanilla","amber","gourmand"} & b) and not ("sweet" in a and "sweet" in b)):
        matches.append({"id":"R_SWEET_VANILLA","mode":"reinforce","why":"Warm gourmand/amber tags overlap without the excessive-sweetness guard being triggered."})
    if (({"warm","woody","amber"} & a) and ({"soft","clean","musk"} & b)) or (({"warm","woody","amber"} & b) and ({"soft","clean","musk"} & a)):
        matches.append({"id":"R_WARM_MUSK","mode":"soften","why":"A warm/woody/amber direction is supported by a stored soft, clean, or musky tag."})
    if ((WARM_TAGS & a) and (FRESH_TAGS & b)) or ((WARM_TAGS & b) and (FRESH_TAGS & a)):
        matches.append({"id":"R_WARM_FRESH_BALANCE","mode":"contrast","why":"A stored warm direction is balanced by a fresher, more open stored profile."})
    if (("aromatic" in a and "woody" in b) or ("aromatic" in b and "woody" in a)):
        matches.append({"id":"R_AROMATIC_WOODY","mode":"reinforce","why":"Stored aromatic and woody tags form a polished, compatible direction."})
    return matches

def occasion_score(main: dict[str, Any], pair: dict[str, Any], occasion: str) -> int:
    desired=OCCASION_TAGS.get(occasion, set())
    found=len((tags(main)|tags(pair)) & desired)
    score=min(36, found*9) if desired else 16
    all_tags=tags(main)|tags(pair)
    if occasion == "office" and ({"dark","bold","sweet"} & all_tags): score=max(0,score-8)
    if occasion in {"date-night","party","winter-evening"} and not ({"warm","amber","woody","bold","spicy"} & all_tags): score=max(0,score-12)
    if occasion == "summer-day" and ({"dark","sweet","smoky"} & all_tags) and not ({"citrus","aquatic","fresh"} & all_tags): score=max(0,score-12)
    return score

def candidate(main: dict[str, Any], pair: dict[str, Any], occasion: str, feedback: Optional[str]=None) -> Optional[dict[str, Any]]:
    matches=rule_matches(main,pair)
    if feedback == "didnt_work" or not matches: return None
    mode_weight={"contrast":30,"soften":28,"freshen":25,"reinforce":22}
    occasion_mode_bonus={
        "everyday":{"freshen":12,"soften":5},
        "office":{"freshen":10,"soften":8},
        "summer-day":{"freshen":14},
        "date-night":{"contrast":10,"reinforce":6},
        "party":{"contrast":9,"reinforce":7},
        "winter-evening":{"reinforce":10,"contrast":7},
    }
    best=max(matches,key=lambda match:mode_weight.get(match["mode"],0)+occasion_mode_bonus.get(occasion,{}).get(match["mode"],0))
    a,b=tags(main),tags(pair)
    distinctness=min(10, len(a ^ b)*3)
    base=min(35, 16+len(matches)*6+distinctness); occasion_points=occasion_score(main,pair,occasion)
    preference=6 if main.get("is_favorite") or pair.get("is_favorite") else 0
    feedback_points=20 if feedback in {"loved","good"} else 0
    confirmed = sum(
        item.get("profile_confidence") == "user-confirmed" for item in (main, pair)
    )
    # A confirmed profile is still ranked alongside a useful inferred profile,
    # but wins a close decision because its inputs are more trustworthy.
    confidence_points = {0: 0, 1: 5, 2: 12}[confirmed]
    profile_state = "confirmed" if confirmed == 2 else ("mixed" if confirmed else "inferred")
    profile_note = (
        " Both scent profiles are confirmed by you."
        if profile_state == "confirmed"
        else " One scent profile is suggested; refine it to make this more personal."
        if profile_state == "mixed"
        else " These scent profiles are suggested; refine them to make this more personal."
    )
    evidence="liked" if feedback in {"loved","good"} else ("confirmed" if profile_state == "confirmed" else "suggested")
    return {"main":main,"pair":pair,"mode":best["mode"],"score":base+occasion_points+preference+feedback_points+confidence_points,"rules":matches,"explanation":best["why"]+profile_note,"evidence":evidence,"profile_state":profile_state,"occasion":occasion}

def recommendations(fragrances:list[dict[str,Any]], occasion:str, main_id:Optional[int]=None, mode:Optional[str]=None, feedback_by_pair:Optional[dict[tuple[int,int],str]]=None, recent_pairs:Optional[set[tuple[int,int]]]=None)->list[dict[str,Any]]:
    feedback_by_pair=feedback_by_pair or {}; recent_pairs=recent_pairs or set(); results=[]
    for main in fragrances:
        if main_id and main["id"] != main_id: continue
        for pair in fragrances:
            if main["id"] == pair["id"]: continue
            # Deduplicate general recommendations only; selected-main lab remains directional.
            if not main_id and main["id"] > pair["id"]: continue
            feedback=feedback_by_pair.get((main["id"],pair["id"])) or feedback_by_pair.get((pair["id"],main["id"]))
            item=candidate(main,pair,occasion,feedback)
            if item and (not mode or item["mode"]==mode):
                if (main["id"],pair["id"]) in recent_pairs or (pair["id"],main["id"]) in recent_pairs:
                    item["score"]-=15; item["recently_worn"]=True
                else: item["recently_worn"]=False
                results.append(item)
    ranked=sorted(results,key=lambda x:(-x["score"],x["main"]["name"],x["pair"]["name"]))
    if main_id:
        return ranked[:5]
    # The home screen should feel like a varied edit, not five repeats of one bottle.
    selected=[]; used=set()
    for item in ranked:
        ids={item["main"]["id"], item["pair"]["id"]}
        if ids & used: continue
        selected.append(item); used |= ids
        if len(selected)==5: break
    return (selected or ranked)[:5]
