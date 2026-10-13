import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bookmark,
  Briefcase,
  CalendarDays,
  Check,
  CloudSun,
  Coffee,
  Edit3,
  Gem,
  Heart,
  ImagePlus,
  PartyPopper,
  Plus,
  Search,
  Sparkles,
  Sun,
  Snowflake,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import "./styles.css";
type F = {
  id: number;
  name: string;
  brand: string;
  format: string;
  profile_confidence: string;
  family_tags: string[];
  character_tags: string[];
  is_favorite?: boolean;
  image_path?: string | null;
  notes?: string;
};
type Rec = {
  main: F;
  pair: F;
  mode: string;
  explanation: string;
  recently_worn: boolean;
  profile_state?: "confirmed" | "mixed" | "inferred";
};
type Combo = {
  id: number;
  main: F;
  pair: F;
  pairing_mode: string;
  explanation: string;
  user_feedback?: string;
};
type Candidate = { name: string; brand: string; image_url: string };
type View = "home" | "collection" | "lab" | "saved";
const api = "/api";
const occasions = [
  { id: "everyday", label: "Everyday", Icon: CalendarDays },
  { id: "office", label: "Office", Icon: Briefcase },
  { id: "casual", label: "Casual", Icon: Coffee },
  { id: "date-night", label: "Date night", Icon: Heart },
  { id: "party", label: "Party", Icon: PartyPopper },
  { id: "wedding", label: "Wedding", Icon: Gem },
  { id: "summer-day", label: "Summer day", Icon: Sun },
  { id: "winter-evening", label: "Winter evening", Icon: Snowflake },
];
const directions = [
  ["citrus", "Bright and sparkling"],
  ["aquatic", "Watery and open"],
  ["aromatic", "Herbal and polished"],
  ["woody", "Dry and grounding"],
  ["amber", "Golden and enveloping"],
  ["gourmand", "Sweet and edible"],
  ["musk", "Skinlike and smooth"],
  ["spicy", "Warm and vivid"],
  ["oud", "Resinous and deep"],
  ["smoky", "Dark and textured"],
  ["leather", "Supple and bold"],
] as const;
type Feel = "fresh" | "balanced" | "warm";
type Presence = "soft" | "versatile" | "bold";
type ProfileDraft = { feel: Feel; presence: Presence; directions: string[] };

const profileState = (f: F) =>
  f.profile_confidence === "user-confirmed"
    ? "Confirmed profile"
    : f.profile_confidence === "inferred"
      ? "Suggested profile"
      : "Profile needs review";

function draftFrom(f: F): ProfileDraft {
  const tags = new Set([...(f.family_tags || []), ...(f.character_tags || [])]);
  const feel: Feel =
    tags.has("fresh") || tags.has("aquatic") || tags.has("citrus")
      ? "fresh"
      : tags.has("warm") || tags.has("amber") || tags.has("gourmand")
        ? "warm"
        : "balanced";
  const presence: Presence = tags.has("bold") || tags.has("dark")
    ? "bold"
    : tags.has("soft") || tags.has("musk")
      ? "soft"
      : "versatile";
  return {
    feel,
    presence,
    directions: directions.map(([id]) => id).filter((id) => tags.has(id)).slice(0, 2),
  };
}

function profileTags(draft: ProfileDraft) {
  const family = new Set(draft.directions);
  const character = new Set<string>();
  if (draft.feel === "fresh") {
    character.add("fresh");
    character.add("clean");
  } else if (draft.feel === "balanced") {
    character.add("clean");
    family.add("aromatic");
  } else {
    character.add("warm");
    family.add("amber");
  }
  if (draft.presence === "soft") character.add("soft");
  if (draft.presence === "bold") character.add("bold");
  return { family_tags: [...family], character_tags: [...character] };
}
function Bottle({ f, big = false }: { f: F; big?: boolean }) {
  const i = f.name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
  return (
    <div
      className={
        "bottle " + (big ? "big " : "") + (f.image_path ? "photo" : "")
      }
      style={
        f.image_path ? { backgroundImage: `url(${f.image_path})` } : undefined
      }
    >
      <span>{f.image_path ? "" : i}</span>
    </div>
  );
}
function Top({ view, setView }: { view: View; setView: (v: View) => void }) {
  const [temp, setTemp] = useState<number | null>(null);
  useEffect(() => {
    const getTemperature = async (latitude: number, longitude: number) => {
      try {
        const d = await (
          await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`,
          )
        ).json();
        setTemp(Math.round(d.current.temperature_2m));
      } catch {}
    };
    const fallback = () => getTemperature(22.5726, 88.3639);
    if (!navigator.geolocation) {
      fallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => getTemperature(p.coords.latitude, p.coords.longitude),
      fallback,
      { timeout: 5000, maximumAge: 900000 },
    );
  }, []);
  return (
    <header>
      <button className="logo" onClick={() => setView("home")}>
        SCENT<span>MATE</span>
        <i>°</i>
      </button>
      <div className="header-actions">
        <nav className="topnav">
          {(
            [
              ["home", "Today"],
              ["collection", "My collection"],
              ["lab", "Pairing Lab"],
              ["saved", "Saved"],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              className={view === id ? "current" : ""}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="weather" title="Current temperature">
          <CloudSun />
          <span>{temp === null ? "…" : `${temp}°C`}</span>
        </div>
      </div>
    </header>
  );
}
function Pair({
  r,
  onSave,
  onWear,
  saved,
}: {
  r: Rec;
  onSave: () => void;
  onWear: () => void;
  saved: boolean;
}) {
  return (
    <article className="pair">
      <div className="pair-art">
        <Bottle f={r.main} big />
        <span>+</span>
        <Bottle f={r.pair} big />
      </div>
      <div className="pair-copy">
        <small>
          {r.mode}
          {r.recently_worn ? " · worn recently" : ""}
          {r.profile_state === "confirmed" ? " · confirmed profiles" : ""}
          {r.profile_state === "mixed" ? " · one profile suggested" : ""}
          {r.profile_state === "inferred" ? " · suggested profiles" : ""}
        </small>
        <h2>
          {r.main.name} with {r.pair.name}
        </h2>
        <p>{r.explanation}</p>
        <div>
          <button className="primary" onClick={onWear}>
            Wear this
          </button>
          <button className="secondary" disabled={saved} onClick={onSave}>
            {saved ? <Check /> : <Bookmark />}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </article>
  );
}
export default function App() {
  const [view, setView] = useState<View>("home"),
    [items, setItems] = useState<F[]>([]),
    [rows, setRows] = useState<Rec[]>([]),
    [combos, setCombos] = useState<Combo[]>([]),
    [occasion, setOccasion] = useState("everyday"),
    [main, setMain] = useState<number | "">(""),
    [intent, setIntent] = useState(""),
    [search, setSearch] = useState(""),
    [imageFor, setImageFor] = useState<F | null>(null),
    [query, setQuery] = useState(""),
    [imageUrl, setImageUrl] = useState(""),
    [candidates, setCandidates] = useState<Candidate[]>([]),
    [loading, setLoading] = useState(false),
    [imageError, setImageError] = useState(""),
    [editor, setEditor] = useState<F | null>(null),
    [adding, setAdding] = useState(false),
    [profileFor, setProfileFor] = useState<F | null>(null),
    [profileStep, setProfileStep] = useState<1 | 2 | 3>(1),
    [profileDraft, setProfileDraft] = useState<ProfileDraft>({
      feel: "balanced",
      presence: "versatile",
      directions: [],
    });
  const load = async () => {
    setItems(await (await fetch(`${api}/fragrances`)).json());
    setCombos(await (await fetch(`${api}/combinations`)).json());
  };
  const getRows = async () => {
    const p = new URLSearchParams({ occasion });
    if (main) p.set("main_id", String(main));
    if (intent) p.set("mode", intent);
    setRows(await (await fetch(`${api}/recommendations?${p}`)).json());
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    getRows();
  }, [occasion, main, intent]);
  const save = async (r: Rec) => {
    await fetch(`${api}/combinations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        main_fragrance_id: r.main.id,
        paired_fragrance_id: r.pair.id,
        occasion,
      }),
    });
    load();
  };
  const wear = async (r: Rec) => {
    await fetch(`${api}/wear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        main_fragrance_id: r.main.id,
        paired_fragrance_id: r.pair.id,
        occasion,
      }),
    });
    getRows();
  };
  const wearSingle = async (f: F) => {
    await fetch(`${api}/wear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ main_fragrance_id: f.id, occasion }),
    });
  };
  const openPhoto = (f: F) => {
    setImageFor(f);
    setQuery(`${f.brand} ${f.name}`);
    setImageUrl("");
    setCandidates([]);
    setImageError("");
  };
  const imageSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFor || !query.trim()) return;
    setLoading(true);
    setImageError("");
    try {
      const r = await fetch(`${api}/fragrances/${imageFor.id}/image-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!r.ok) throw Error();
      setCandidates(await r.json());
    } catch {
      setImageError(
        "That search did not return a usable image. Paste or upload one instead.",
      );
    } finally {
      setLoading(false);
    }
  };
  const choose = async (url: string) => {
    if (!imageFor) return;
    setLoading(true);
    setImageError("");
    try {
      const r = await fetch(`${api}/fragrances/${imageFor.id}/image-select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: url }),
      });
      if (!r.ok) throw Error();
      const saved = (await r.json()) as F;
      setItems((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      setImageFor(null);
      void load().catch(() => {});
    } catch {
      setImageError(
        "That link is not a usable image. Use a direct JPG, PNG, or WebP image link instead.",
      );
    } finally {
      setLoading(false);
    }
  };
  const uploadFile = async (file: File) => {
    if (!imageFor) return;
    setLoading(true);
    setImageError("");
    try {
      const b = new FormData();
      b.append("image", file);
      const r = await fetch(`${api}/fragrances/${imageFor.id}/image`, {
        method: "POST",
        body: b,
      });
      if (!r.ok) throw Error();
      const saved = (await r.json()) as F;
      setItems((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      setImageFor(null);
      void load().catch(() => {});
    } catch {
      setImageError(
        "We could not save that image. Use a JPG, PNG, or WebP under 8 MB.",
      );
    } finally {
      setLoading(false);
    }
  };
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) await uploadFile(e.target.files[0]);
  };
  const clipboardImage = (clipboard: DataTransfer | null) => {
    if (!clipboard) return null;
    const item = Array.from(clipboard.items).find((i) =>
      i.type.startsWith("image/"),
    );
    const file = item?.getAsFile() || clipboard.files?.[0];
    if (file) return file;
    const html = clipboard.getData("text/html");
    const source = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    return source?.startsWith("http") ? source : null;
  };
  const pasteImage = (clipboard: DataTransfer | null) => {
    const pasted = clipboardImage(clipboard);
    if (!pasted) return false;
    if (typeof pasted === "string") {
      setImageUrl(pasted);
      void choose(pasted);
    } else {
      void uploadFile(pasted);
    }
    return true;
  };
  const importUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (imageUrl.trim()) await choose(imageUrl.trim());
  };
  useEffect(() => {
    if (!imageFor) return;
    const handlePaste = (event: ClipboardEvent) => {
      if (pasteImage(event.clipboardData)) event.preventDefault();
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [imageFor]);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const body = {
      name: d.get("name"),
      brand: d.get("brand"),
      format: d.get("format"),
      notes: d.get("notes"),
    };
    const response = await fetch(
      editor ? `${api}/fragrances/${editor.id}` : `${api}/fragrances`,
      {
        method: editor ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) return;
    const saved = (await response.json()) as F;
    setItems((current) =>
      editor
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved],
    );
    setEditor(null);
    setAdding(false);
    if (!editor) {
      setProfileFor(saved);
      setProfileDraft(draftFrom(saved));
      setProfileStep(1);
    }
    void load().catch(() => {});
  };
  const openProfile = (f: F) => {
    setProfileFor(f);
    setProfileDraft(draftFrom(f));
    setProfileStep(1);
  };
  const saveProfile = async () => {
    if (!profileFor) return;
    const r = await fetch(`${api}/fragrances/${profileFor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...profileTags(profileDraft),
        profile_confidence: "user-confirmed",
      }),
    });
    if (!r.ok) return;
    const saved = (await r.json()) as F;
    setItems((current) => current.map((f) => (f.id === saved.id ? saved : f)));
    setProfileFor(null);
    void load().catch(() => {});
    void getRows().catch(() => {});
  };
  const shown = useMemo(
    () =>
      items.filter((f) =>
        (f.name + f.brand).toLowerCase().includes(search.toLowerCase()),
      ),
    [items, search],
  );
  const suggestions = items.filter((f) => f.is_favorite).slice(0, 2);
  const todayRows = useMemo(() => {
    if (!rows.length) return rows;
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - yearStart.getTime()) / 86400000);
    const occasionIndex = occasions.findIndex((item) => item.id === occasion);
    const offset = (dayOfYear + Math.max(occasionIndex, 0)) % rows.length;
    return [...rows.slice(offset), ...rows.slice(0, offset)];
  }, [rows, occasion]);
  const dailyPick = todayRows[0]?.main ?? suggestions[0];
  const profilesToReview = items.filter(
    (f) => f.profile_confidence !== "user-confirmed",
  );
  return (
    <main>
      <div className="shell">
        <Top
          view={view}
          setView={(next) => {
            if (next === "home") {
              setMain("");
              setIntent("");
            }
            setView(next);
          }}
        />
        {view === "home" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <p className="eyebrow">A MORE PERSONAL START</p>
                <h1>
                  What moment are you
                  <br />
                  stepping into?
                </h1>
                <p>
                  Pick an occasion to shape the day. Start with one scent or
                  build a pairing when it feels right.
                </p>
                <div className="occasion-grid">
                  {occasions.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      className={occasion === id ? "selected" : ""}
                      onClick={() => setOccasion(id)}
                    >
                      <Icon aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {dailyPick && (
                <article className="daily-stage">
                  <div className="stage-bottle">
                    <Bottle f={dailyPick} big />
                  </div>
                  <div className="daily-copy">
                    <span>{dailyPick.brand}</span>
                    <h2>{dailyPick.name}</h2>
                    <button
                      className="link"
                      onClick={() => wearSingle(dailyPick)}
                    >
                      Wear this today
                    </button>
                  </div>
                </article>
              )}
            </section>
            <section className="pair-grid home-pairings">
              {todayRows.slice(0, 4).map((r) => (
                <Pair
                  key={`${r.main.id}${r.pair.id}`}
                  r={r}
                  onSave={() => save(r)}
                  onWear={() => wear(r)}
                  saved={combos.some(
                    (c) => c.main.id === r.main.id && c.pair.id === r.pair.id,
                  )}
                />
              ))}
            </section>
          </>
        )}
        {view === "collection" && (
          <section className="collection">
            <div className="section-head">
              <div>
                <p className="eyebrow">YOUR BOTTLES</p>
                <h1>My collection</h1>
              </div>
              <div className="collection-actions">
                <label className="search">
                  <Search />
                  <input
                    placeholder="Search perfume or brand"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                {profilesToReview.length > 0 && (
                  <button
                    className="secondary review-profiles"
                    onClick={() => openProfile(profilesToReview[0])}
                  >
                    <Sparkles />
                    Complete profiles ({profilesToReview.length})
                  </button>
                )}
                <button className="primary" onClick={() => setAdding(true)}>
                  <Plus />
                  Add perfume
                </button>
              </div>
            </div>
            <div className="collection-grid">
              {shown.map((f) => (
                <article className="collection-card" key={f.id}>
                  <Bottle f={f} big />
                  <div>
                    <p>{f.brand}</p>
                    <h2>{f.name}</h2>
                    <span>{f.format === "attar" ? "Attar" : "Spray"}</span>
                    <button className="profile-link" onClick={() => openProfile(f)}>
                      <Sparkles />
                      {profileState(f)}
                    </button>
                  </div>
                  <div className="manage">
                    <button onClick={() => openPhoto(f)}>
                      <ImagePlus />
                      Photo
                    </button>
                    <button onClick={() => setEditor(f)}>
                      <Edit3 />
                      Edit
                    </button>
                    <button
                      className="delete"
                      onClick={async () => {
                        await fetch(`${api}/fragrances/${f.id}`, {
                          method: "DELETE",
                        });
                        load();
                      }}
                    >
                      <Trash2 />
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        {view === "lab" && (
          <section className="lab">
            <div className="section-head">
              <div>
                <p className="eyebrow">PAIRING LAB</p>
                <h1>Start with the moment.</h1>
              </div>
            </div>
            <div className="occasion-grid lab-occasions">
              {occasions.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  className={occasion === id ? "selected" : ""}
                  onClick={() => setOccasion(id)}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
            <section className="lab-card">
              <div>
                <p className="eyebrow">CHOOSE A MAIN FRAGRANCE</p>
                <div className="pick-grid">
                  <button
                    className={main === "" ? "selected" : ""}
                    onClick={() => setMain("")}
                  >
                    Best fit
                  </button>
                  {items
                    .filter((f) => f.profile_confidence !== "unknown")
                    .map((f) => (
                      <button
                        key={f.id}
                        className={main === f.id ? "selected" : ""}
                        onClick={() => setMain(f.id)}
                      >
                        <Bottle f={f} />
                        <span>{f.name}</span>
                      </button>
                    ))}
                </div>
              </div>
              <div>
                <p className="eyebrow">WHAT SHOULD THE PAIRING DO?</p>
                <div className="intent-grid">
                  {[
                    ["", "Best fit"],
                    ["reinforce", "Reinforce"],
                    ["soften", "Soften"],
                    ["contrast", "Contrast"],
                    ["freshen", "Keep fresh"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={intent === id ? "selected" : ""}
                      onClick={() => setIntent(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <section className="pair-grid">
              {rows.map((r) => (
                <Pair
                  key={`${r.main.id}${r.pair.id}`}
                  r={r}
                  onSave={() => save(r)}
                  onWear={() => wear(r)}
                  saved={combos.some(
                    (c) => c.main.id === r.main.id && c.pair.id === r.pair.id,
                  )}
                />
              ))}
            </section>
          </section>
        )}
        {view === "saved" && (
          <section className="saved">
            <p className="eyebrow">YOUR RETURN TO LIST</p>
            <h1>Saved combinations</h1>
            {combos.map((c) => (
              <article className="saved-card" key={c.id}>
                <Bottle f={c.main} />
                <span>+</span>
                <Bottle f={c.pair} />
                <div>
                  <h2>
                    {c.main.name} with {c.pair.name}
                  </h2>
                  <p>{c.explanation}</p>
                </div>
                <div className="feedback">
                  {[
                    ["loved", "Loved it"],
                    ["good", "Good"],
                    ["didnt_work", "Did not work"],
                  ].map(([id, label]) => (
                    <button
                      className={c.user_feedback === id ? "selected" : ""}
                      key={id}
                      onClick={async () => {
                        await fetch(`${api}/combinations/${c.id}/feedback`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ feedback: id }),
                        });
                        load();
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
      {imageFor && (
        <div className="scrim">
          <section className="image-picker">
            <button className="x" onClick={() => setImageFor(null)}>
              <X />
            </button>
            <p className="eyebrow">BOTTLE PHOTO</p>
            <h2>Choose a photo for {imageFor.name}</h2>
            <form className="photo-search" onSubmit={imageSearch}>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Try brand and fragrance name"
              />
              <button className="primary">Search</button>
            </form>
            <p className="photo-help">
              Search is optional. The reliable choices are pasting a copied
              bottle image, uploading a file, or pasting a direct image link.
            </p>
            <div className="paste-zone" tabIndex={0}>
              <ImagePlus />
              <strong>Click here, then paste a copied bottle image</strong>
              <span>
                Paste anywhere in this photo window with Command V on Mac or
                Ctrl V on Windows. The image is saved to your collection.
              </span>
            </div>
            <form className="url-import" onSubmit={importUrl}>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Paste a direct JPG, PNG, or WebP link"
              />
              <button className="secondary">Use link</button>
            </form>
            <label className="upload">
              <Upload />
              Choose an image file
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={upload}
              />
            </label>
            {imageError && <p className="image-error">{imageError}</p>}
            {loading ? (
              <div className="loading">Saving your image</div>
            ) : candidates.length ? (
              <div className="candidate-grid">
                {candidates.map((c, i) => (
                  <button key={i} onClick={() => choose(c.image_url)}>
                    <img src={c.image_url} alt={`${c.brand} ${c.name}`} />
                    <span>{c.name || c.brand || "Bottle photo"}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="fallback">
                Pasted or uploaded images are the most reliable way to get the
                exact bottle you want.
              </p>
            )}
          </section>
        </div>
      )}
      {(editor || adding) && (
        <div className="scrim">
          <form className="editor" onSubmit={submit}>
            <button
              className="x"
              type="button"
              onClick={() => {
                setEditor(null);
                setAdding(false);
              }}
            >
              <X />
            </button>
            <p className="eyebrow">{editor ? "EDIT PERFUME" : "ADD PERFUME"}</p>
            <h2>
              {editor
                ? "Update your bottle details."
                : "Add something new to your shelf."}
            </h2>
            <label>
              Name
              <input name="name" required defaultValue={editor?.name} />
            </label>
            <label>
              Brand
              <input name="brand" defaultValue={editor?.brand} />
            </label>
            <label>
              Format
              <select name="format" defaultValue={editor?.format || "spray"}>
                <option value="spray">Spray</option>
                <option value="attar">Attar</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
            <label>
              Notes
              <textarea name="notes" defaultValue={editor?.notes} />
            </label>
            {editor && (
              <button
                className="refine-profile"
                type="button"
                onClick={() => {
                  const current = editor;
                  setEditor(null);
                  openProfile(current);
                }}
              >
                <Sparkles />
                Refine scent profile
                <span>{profileState(editor)}</span>
              </button>
            )}
            <button className="primary">Save perfume</button>
          </form>
        </div>
      )}
      {profileFor && (
        <div className="scrim">
          <section className="profile-wizard" aria-modal="true" role="dialog">
            <button className="x" onClick={() => setProfileFor(null)}>
              <X />
            </button>
            <p className="eyebrow">REFINE PROFILE</p>
            <div className="wizard-head">
              <div>
                <h2>{profileFor.name}</h2>
                <p>
                  {profileFor.profile_confidence === "user-confirmed"
                    ? "Tune your confirmed scent profile."
                    : "Turn this suggested profile into one you trust."}
                </p>
              </div>
              <span className="step-count">{profileStep} of 3</span>
            </div>
            <div className="progress" aria-label={`Step ${profileStep} of 3`}>
              {[1, 2, 3].map((step) => (
                <span key={step} className={step <= profileStep ? "active" : ""} />
              ))}
            </div>
            {profileStep === 1 && (
              <div className="profile-question">
                <p className="question-kicker">STEP 1 · OVERALL FEEL</p>
                <h3>How does it feel when you wear it?</h3>
                <div className="profile-choices three-up">
                  {[
                    ["fresh", "Fresh & airy", "Light, crisp, and open."],
                    ["balanced", "Balanced & clean", "Easy, polished, and versatile."],
                    ["warm", "Warm & rich", "Deep, cosy, and enveloping."],
                  ].map(([id, label, copy]) => (
                    <button
                      key={id}
                      className={profileDraft.feel === id ? "chosen" : ""}
                      onClick={() => setProfileDraft((d) => ({ ...d, feel: id as Feel }))}
                    >
                      <strong>{label}</strong>
                      <span>{copy}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {profileStep === 2 && (
              <div className="profile-question">
                <p className="question-kicker">STEP 2 · PRESENCE</p>
                <h3>How much presence does it have?</h3>
                <div className="profile-choices three-up">
                  {[
                    ["soft", "Soft", "Close to the skin."],
                    ["versatile", "Versatile", "Comfortable in most rooms."],
                    ["bold", "Bold", "Noticeable and expressive."],
                  ].map(([id, label, copy]) => (
                    <button
                      key={id}
                      className={profileDraft.presence === id ? "chosen" : ""}
                      onClick={() => setProfileDraft((d) => ({ ...d, presence: id as Presence }))}
                    >
                      <strong>{label}</strong>
                      <span>{copy}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {profileStep === 3 && (
              <div className="profile-question">
                <p className="question-kicker">STEP 3 · SCENT DIRECTIONS</p>
                <h3>Pick up to two directions you notice.</h3>
                <div className="direction-grid">
                  {directions.map(([id, copy]) => {
                    const selected = profileDraft.directions.includes(id);
                    const limited = !selected && profileDraft.directions.length >= 2;
                    return (
                      <button
                        key={id}
                        className={selected ? "chosen" : ""}
                        disabled={limited}
                        onClick={() =>
                          setProfileDraft((d) => ({
                            ...d,
                            directions: selected
                              ? d.directions.filter((direction) => direction !== id)
                              : [...d.directions, id],
                          }))
                        }
                      >
                        <strong>{id}</strong>
                        <span>{copy}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="wizard-actions">
              {profileStep > 1 ? (
                <button
                  className="secondary"
                  onClick={() => setProfileStep((step) => (step - 1) as 1 | 2 | 3)}
                >
                  Back
                </button>
              ) : (
                <span />
              )}
              {profileStep < 3 ? (
                <button
                  className="primary"
                  onClick={() => setProfileStep((step) => (step + 1) as 1 | 2 | 3)}
                >
                  Continue
                </button>
              ) : (
                <button className="primary" onClick={saveProfile}>
                  <Check />
                  Save confirmed profile
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
