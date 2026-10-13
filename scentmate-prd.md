# Scentmate — Product Requirements Document (PRD)

**Status:** Planning / ready for staged implementation  
**Product type:** Private, single-user web app  
**Primary goal:** Help the user decide what to wear from their existing perfume and attar collection, and suggest thoughtful, explainable combinations without maintaining a manual pairing catalog.  
**Implementation rule:** Build Stage 1, deploy it, and review it with the user before beginning Stage 2. Repeat for Stage 3. Do not build all stages in one pass.

---

## 1. Product vision

Scentmate is a visual, personal fragrance assistant hosted on the user's existing Ubuntu home server through Docker. It should answer:

> **What should I wear for this occasion, and what can I pair it with from my own collection?**

The app is not a public perfume-review platform and should not require the user to enter longevity, projection, sillage, or similar performance data. The user already knows their own experience and will provide broad feedback such as **Loved it / Good / Didn't work**.

### Product principles

1. **Low maintenance:** Preload the user's existing collection. Do not ask them to re-enter every perfume.
2. **Visual first:** Use bottle images and image placeholders so the user can identify products quickly.
3. **Pairings must be explainable:** Never generate random combinations. Every suggested pairing must pass explicit compatibility rules and receive a score.
4. **Works without external services:** The core app must work when an image API or OpenAI is unavailable.
5. **Private by default:** Run on the home server and access over LAN or Tailscale. Do not expose it publicly by default.
6. **Stage and review:** Complete one stage, deploy it, and collect feedback before proceeding.
7. **No unnecessary complexity:** One application container and SQLite are sufficient for the first version.

---

## 2. Target user and primary jobs

**Primary user:** One person managing their own perfume and attar collection.

The user needs to:
- Browse their collection visually.
- Choose an occasion and receive multiple recommendations.
- Select a main fragrance and see suitable attar/perfume pairings.
- Understand why each combination is suggested.
- Save combinations and mark whether they worked.
- Add a missing bottle image manually.
- Add a new fragrance without having to hand-create every pairing rule.

Not in scope initially:
- Public accounts or multiple users.
- Community reviews or social features.
- Automated longevity/projection measurement.
- Shopping, price tracking, or affiliate links.
- Mandatory weather integration.
- Training a custom machine-learning model.

---

## 3. Proposed technology stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fast, responsive dashboard and reusable components |
| Styling | Tailwind CSS | Efficient responsive styling |
| UI components | shadcn/ui where useful | Polished, accessible controls without a heavy design system |
| Font | **Plus Jakarta Sans** | Required visual typeface; load via a self-hosted font file or Google Fonts with a local fallback |
| Backend | Python + FastAPI | Small API for collection, recommendations, images, and feedback |
| Data validation | Pydantic | Validate API inputs and structured fragrance metadata |
| Database | SQLite | Single-file database; no separate database server required |
| ORM/migrations | SQLModel or SQLAlchemy + Alembic | Maintainable schema and future migrations |
| Images | Local persistent storage | Reliable images even when external APIs fail |
| External image lookup | Open Beauty Facts API, best-effort only | Free community-contributed cosmetic-product catalog; fragrance coverage is not guaranteed |
| Optional AI | OpenAI API, disabled by default | Optional metadata normalization or explanations only; never the sole source of pairing decisions |
| Deployment | Docker Compose | Matches existing home-server setup |
| Testing | Pytest + frontend unit tests | Validate compatibility rules and prevent bad pairings |
| Backup | SQLite backup + images directory | Simple backup of the whole collection |

### Suggested repository structure

```text
scentmate/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── README.md
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── api/
│   │   ├── services/
│   │   │   ├── pairing_engine.py
│   │   │   ├── recommendation_engine.py
│   │   │   ├── image_lookup.py
│   │   │   └── openai_metadata.py
│   │   └── tests/
│   └── requirements.txt
├── data/
│   └── scentmate.db
└── images/
    ├── bottles/
    └── placeholders/
```

`data/` and `images/` must be persistent Docker volumes/bind mounts, not data stored only inside the container.

---

## 4. Hosting and Docker requirements

- Run as one web application service initially; the frontend can be built into static assets and served by the FastAPI container.
- Use SQLite; do not create a separate PostgreSQL container for the initial single-user version.
- Use a persistent host directory for the database and bottle images.
- Provide a health endpoint and Docker health check.
- Restart automatically after host reboot using Docker's restart policy.
- Bind to the local network only as configured by the user; do not configure public tunneling or port forwarding.
- Access remotely through the user's existing Tailscale setup if desired.
- Keep secrets in `.env`, never in frontend code or Git.
- Do not require OpenAI credentials for normal operation.
- Provide a documented backup/restore process.
- Pin production dependency versions after implementation is validated.

Example Compose outline (final ports and paths to be chosen during implementation):

```yaml
services:
  scentmate:
    build: .
    container_name: scentmate
    restart: unless-stopped
    ports:
      - "127.0.0.1:8787:8000"
    environment:
      DATABASE_URL: sqlite:////app/data/scentmate.db
      IMAGE_LOOKUP_ENABLED: "true"
      OPENAI_ENABLED: "false"
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
    volumes:
      - ./data:/app/data
      - ./images:/app/images
```

**Deployment note:** Binding to `127.0.0.1` restricts access to the host itself. If the user wants LAN access, the port binding must be changed to the intended LAN interface or `0.0.0.0`, with firewall and Tailscale exposure checked deliberately. Never make it public by default.

---

## 5. Information architecture and UI

Use a calm, premium, minimal visual style: warm neutral background, strong typography, clean bottle cards, restrained accent color, generous spacing, and responsive layouts. Avoid a generic AI-generated dashboard appearance.

### Main navigation

1. **Home**
2. **My Collection**
3. **Pairing Lab**
4. **Saved Combos**
5. **Settings** (small section or menu)

### 5.1 Home dashboard

- Greeting/title: “What are you wearing today?”
- Occasion chips: Everyday, Office, Casual, Date Night, Party, Wedding, Summer Day, Winter Evening, Relaxed Evening, Special Occasion.
- “Recommend” button.
- Quick stats calculated from the database (number of fragrances, attars, saved combinations).
- Recently selected combinations.
- Optional “Surprise me” action, but it must still use the same compatibility and occasion filters; it cannot choose arbitrary pairs.

### 5.2 Recommendation results

Return 3–5 options, sorted by compatibility and occasion fit. Each card should show:
- Main bottle image, brand, and fragrance name.
- Optional second bottle image and name for a pairing.
- Combination label, e.g. “Fresh & woody” or “Sweet evening”.
- Occasion fit.
- One concise explanation grounded in stored fragrance attributes.
- Evidence state: “Rule-based suggestion”, “Previously liked”, or “Experimental — not yet tried”.
- Actions: **Wear this**, **Pair it**, **Show alternatives**, **Save**, **Feedback**.

Do not display invented longevity or projection estimates. Do not imply a combination has been tested unless the user has rated it.

### 5.3 My Collection

- Responsive image-card grid; list view optional.
- Filters: perfume/attar, brand, fragrance family, favorite, and occasion fit.
- Search by name or brand.
- Add/edit/archive a fragrance.
- Replace bottle image or upload a missing image.
- Unknown metadata must be allowed; a missing note profile must not block use of the app.
- Avoid a requirement to record performance fields.

### 5.4 Pairing Lab

- Choose a main perfume.
- Show only attars/perfumes that pass pairing-engine rules.
- Filter by desired effect: reinforce, soften, add contrast, or keep fresh.
- Show why each candidate passed.
- Save a combination or mark it as experimental.
- Warn that layering is subjective and recommend starting with a small amount.

### 5.5 Saved Combos

- Saved combinations with bottle images.
- Feedback: **Loved it / Good / Didn't work**.
- Keep feedback on a *combination* separate from preference for an individual fragrance.
- Ability to remove or archive a saved combination.

---

## 6. User's initial fragrance collection (pre-seed)

Seed all of the following as separate collection records. Preserve the user's names as entered; where a name is uncertain, flag it for later identification rather than guessing a different product. Add placeholder images and allow image replacement.

| # | Name as provided | Brand | Type | Initial profile / metadata status |
|---:|---|---|---|---|
| 1 | 9 PM Original | Afnan | Spray | Sweet / fruity / vanilla / amber; user strongly likes it and reports excellent longevity |
| 2 | Paris Blue (B-L-U) | Paris Bleu (confirm exact brand/variant) | Spray | Profile needs confirmation; user reports excellent longevity |
| 3 | Acqua di Combo | Alvaro Navarro | Spray | User describes it as an Acqua di Giò-style clone; fresh/aquatic, confirm notes |
| 4 | Odd Father (possibly Godfather) | Beardo | Spray | Exact name/profile needs confirmation; user reports decent longevity |
| 5 | Whisky Smoke | Beardo | Spray | Smoky/woody direction to verify; user likes it |
| 6 | Whisky Smoke Bourbon | Beardo | Spray | Boozy/woody direction to verify; user likes it |
| 7 | 9.0 | Zara | Spray | Exact product/variant needs confirmation |
| 8 | Edge | Wild Stone | Spray | Fresh profile; user likes smell, reports poor longevity |
| 9 | Mariner | Beardo | Spray | Fresh/aquatic; user really likes it, reports poor longevity |
| 10 | Trump | The Man Company | Spray | Exact profile needs confirmation; user rates it okay-ish |
| 11 | Cool Water | Davidoff | Spray | Aquatic/aromatic; user says longevity is below expectations |
| 12 | Classic Black | Jaguar | Spray | Woody/aromatic; user really likes it, average-to-decent longevity |
| 13 | Contemporary | Police | Spray | Exact variant/profile needs confirmation; user likes it, average performance |
| 14 | Icon | Police | Spray | Exact variant/profile needs confirmation; user likes it, average performance |
| 15 | Maverick | Beardo | Spray | Exact profile needs confirmation; user says smell is fine, performance average |
| 16 | To Be (blue skull bottle) | Police | Spray | Exact variant should be verified from image; user likes profile, moderate projection |
| 17 | Denim | Denim (exact attar maker/variant unknown) | Attar | Traditional masculine profile unknown; user says it is very good |
| 18 | Arabiyat (name as provided; exact product unknown) | Arabiyat | Attar | Exact product and profile unknown |
| 19 | Intense Oud (exact label uncertain) | Arabiyat / House of Arabiyat (confirm) | Attar | Oud/woody provisional classification only; user experience not yet specified |
| 20 | Choco Musk | Al Rehab | Attar/oil (confirm user's bottle format) | Chocolate/vanilla gourmand; user strongly likes it |
| 21 | Zidan / Zadar (uncertain spelling) | Al Rehab | Attar | Identity needs confirmation; do not assume a product until verified |
| 22 | Dakar | Al Rehab | Attar | Aromatic/woody masculine provisional profile; user strongly likes it |
| 23 | Seven Seas | Aroma (Aroma Attar) | Attar | Exact product/profile needs confirmation |
| 24 | Seven Black (name uncertain) | Aroma (Aroma Attar) | Attar | Exact product/profile needs confirmation |
| 25 | Lust | Alternate Scents | Spray | User describes it as a Rasasi Hawas-inspired fragrance; likes profile/value, reports an alcohol-heavy opening and has not yet judged final performance |

### Additional collection rules

- Seed these records at first startup with stable IDs and an idempotent seed script. Restarting the app must not duplicate records.
- Do not overwrite user-edited data on subsequent deployments.
- Unknown profiles remain unknown; do not fabricate notes.
- Store user's broad feedback as optional tags or a simple rating, not as a required form.
- User dislikes Jannat-e-Firdaus attar and similar traditional profile. This is a negative preference rule, but **do not infer that the user dislikes all oud, all attars, or all Middle Eastern perfumes**.
- The user prioritizes scent fit and performance but does not want to maintain performance metrics in the app.
- User likes Afnan 9 PM, Al Rehab Choco Musk, Al Rehab Dakar, Jaguar Classic Black, Acqua di Combo, Beardo Mariner (scent despite poor longevity), Beardo Whisky Smoke, Beardo Whisky Smoke Bourbon, and Police To Be.
- User reports poor longevity for Wild Stone Edge, Beardo Mariner, and Davidoff Cool Water; do not automatically exclude these from recommendations, but prefer better-suited alternatives when appropriate.
- User rates The Man Company Trump as okay-ish and Beardo Maverick as average.

---

## 7. Data model

Keep the schema small. Suggested tables:

### `fragrances`
- `id` (UUID or integer primary key)
- `name`
- `brand`
- `format` (`spray`, `attar`, `unknown`)
- `family_tags` (normalized JSON array or related tag table)
- `note_tags` (optional JSON array; may be empty)
- `character_tags` (e.g. `fresh`, `sweet`, `woody`, `smoky`, `powdery`, `musky`, `citrus`, `aquatic`, `spicy`, `gourmand`)
- `profile_confidence` (`verified`, `user-confirmed`, `inferred`, `unknown`)
- `image_path` (local path)
- `image_source_url` (optional attribution/reference)
- `image_source_license` (optional)
- `is_favorite`
- `is_archived`
- `user_feedback` (optional broad opinion: `love`, `good`, `okay`, `dislike`)
- `notes` (optional free text)
- `created_at`, `updated_at`

### `combinations`
- `id`
- `main_fragrance_id`
- `paired_fragrance_id`
- `pairing_mode` (`reinforce`, `soften`, `contrast`, `freshen`, `experimental`)
- `compatibility_score`
- `rule_ids` (or relation table)
- `explanation`
- `status` (`suggested`, `saved`, `tried`, `archived`)
- `user_feedback` (`loved`, `good`, `didnt_work`, null)
- `created_at`, `updated_at`

### `wear_history` (Stage 3 or optional Stage 2)
- `id`
- `combination_id` (nullable)
- `main_fragrance_id`
- `paired_fragrance_id` (nullable)
- `occasion`
- `selected_at`

### `image_lookup_cache` (optional)
- Search query, candidate metadata, candidate image URL, lookup provider, and timestamp. Cache responses to avoid repeated requests.

No table/field for longevity or projection is required.

---

## 8. Strict pairing engine — required design

**Pairing must not be random.** Every recommendation must be generated from explicit compatibility rules, explainable scoring, and safety filters. If the system cannot establish a defensible match because metadata is missing, it should ask for more information or show the item as “profile incomplete”; it must not invent a confident pairing.

### 8.1 Canonical tag vocabulary

Normalize tags to a controlled vocabulary, such as:
- Families: `aquatic`, `citrus`, `aromatic`, `woody`, `amber`, `spicy`, `floral`, `musk`, `oud`, `gourmand`, `leather`, `smoky`, `green`, `powdery`.
- Character: `fresh`, `clean`, `sweet`, `dry`, `creamy`, `warm`, `dark`, `bright`, `soft`, `bold`.
- Notes: specific known notes only, such as `vanilla`, `chocolate`, `citrus`, `sandalwood`, `cedar`, `musk`, `amber`, `tobacco`, `coffee`, `rose`, `incense`, `cardamom`.
- Intensity can be optional qualitative metadata, but do not infer performance from the concentration or brand marketing.

Do not treat family and notes as interchangeable. For example, `woody` is a family/character tag, while `cedar` is a note.

### 8.2 Pairing modes

Each proposed combination must have one declared mode:

1. **Reinforce:** compatible profiles that share a theme, e.g. a verified woody perfume with a verified woody attar.
2. **Soften:** a stronger/darker profile paired with a verified soft musk/creamy profile, only when tags support this.
3. **Contrast:** a sweet profile balanced by verified dry woods or a fresh profile contrasted with a compatible warm base.
4. **Freshen:** verified citrus/aquatic/aromatic profiles paired with compatible fresh/clean tags.
5. **Experimental:** a plausible but less certain combination; always label as untested and rank below proven user-liked combinations.

### 8.3 Rule-based candidate generation

- A fragrance can be paired only if both records have enough known tags to satisfy at least one rule.
- Never create all possible pairs and shuffle them.
- Generate candidates by rule match, then score and rank them.
- Never assume that two products are compatible just because they share a brand or are both perfumes.
- Do not recommend combining two fragrances whose known tags create a clear clash unless the user explicitly requests experimental combinations.
- Apply user negative preferences as penalties or exclusions. Jannat-e-Firdaus-like traditional heavy profiles should be down-ranked; do not broadly exclude all oud/attar profiles.
- If metadata is unknown, the system should not fabricate it. Show the fragrance in the collection but exclude it from confident pairing until enough metadata is known.
- Include a manual “try experimentally” route if desired, but clearly separate it from normal recommendations.

### 8.4 Example compatibility rules

These are starting rules, not universal perfume truths. They must be implemented as named, testable rules and refined as feedback accumulates.

| Rule ID | Preconditions | Pairing mode | Rationale |
|---|---|---|---|
| `R_WOODY_WOODY` | Both have verified woody tags; no strong conflict tags | Reinforce | May build a coherent woody theme |
| `R_SWEET_DRY_WOODS` | Main has verified sweet/gourmand tags; pair has verified dry woody tags | Contrast | May add structure to sweetness |
| `R_FRESH_CITRUS` | Both have verified fresh/citrus/aquatic/aromatic compatibility tags | Freshen | May maintain a bright, fresh direction |
| `R_SWEET_VANILLA` | Both have verified vanilla/amber/gourmand-compatible tags and no excessive-sweetness flag | Reinforce | May produce a warmer sweet profile; guard against cloying sweetness |
| `R_WARM_MUSK` | One has verified warm/woody/amber tags; other has verified soft/clean musk tags | Soften | May smooth the overall impression |
| `R_AROMATIC_WOODY` | One has verified aromatic tags and the other verified woody tags, with compatible notes | Reinforce | May create a polished masculine direction |
| `R_USER_LIKED_PAIR` | User previously rated the exact pair `loved` or `good` | Previously liked | User feedback is stronger evidence than a generic rule |
| `R_USER_REJECTED_PAIR` | User rated the exact pair `didnt_work` | Exclude / heavy penalty | Avoid repeating a failed combination |

### 8.5 Scoring

Suggested transparent score (0–100):
- 35% rule strength / number and quality of supported compatible tag relationships.
- 25% fit to selected occasion.
- 20% user feedback on the exact combination or closely related pairings.
- 10% user fragrance preferences.
- 10% diversity bonus to avoid showing near-identical results.

Apply explicit penalties:
- −40 for a directly rejected combination.
- −20 for a known negative profile relevant to the user's stated dislike.
- −15 for incomplete or low-confidence metadata.
- Exclude pairs with no matching rule rather than allowing penalties to create a false match.

Scores should be internal ranking aids, not claims of scientific certainty. Explain the matched rule(s) in plain language on each recommendation card.

### 8.6 Occasion fit

Occasion matching should be based on tags, not on guessed performance:
- Office: clean, aromatic, soft musk, restrained woody profiles; down-rank strongly sweet/dark profiles unless the user chooses them.
- Party: bold, sweet, amber, aromatic, fruity profiles if metadata supports this.
- Date night: warm, sweet, woody, amber, gourmand, or soft musky profiles.
- Summer day: fresh, citrus, aquatic, green, light aromatic profiles.
- Winter evening: warm, amber, woody, spicy, gourmand profiles.
- Wedding/formal: polished woody, aromatic, amber, or balanced profiles.
- Casual: broad fit, with user favorites prioritized.

Do not make weather a dependency in Stage 1. Weather integration can be evaluated later.

### 8.7 Feedback loop

- Store feedback on the exact combination separately from feedback on each individual fragrance.
- A `loved` combination receives a ranking boost for the same pair and can inform similar tag-based pairings.
- A `didnt_work` combination should be excluded from normal suggestions.
- Never let feedback silently rewrite a fragrance's factual notes; only update preference/ranking.
- Avoid recommending the same combination repeatedly by tracking recent selections in Stage 3.

### 8.8 Required tests

Include unit tests ensuring:
- No candidate is returned without at least one valid pairing rule.
- Unknown metadata does not create confident recommendations.
- Rejected combinations are excluded from normal suggestions.
- Loved combinations rank higher than equally compatible untested ones.
- Occasion filtering changes ranking predictably.
- Results are deterministic for the same data and feedback; no random shuffle.
- A pairing explanation cites the exact rule and tags used.
- Seeded products with unknown profiles are not assigned fabricated notes.

---

## 9. Image lookup and manual image upload

### 9.1 Primary free lookup: Open Beauty Facts

Use the official Open Beauty Facts service as a **best-effort search source**, not as a guaranteed perfume catalog. It is a free, community-contributed cosmetics database and provides product data/images where available. Perfume coverage and completeness are not guaranteed.

Documentation:
- https://openbeautyfacts.github.io/documentation/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/scanning-cosmetics-pet-food-and-other-products/

Implementation requirements:
1. Search by normalized brand + product name where supported.
2. Display candidate results for user confirmation; never silently select an uncertain match.
3. Use timeouts, sensible rate limits, and caching.
4. If no result or image is found, gracefully fall back to upload.
5. Store the selected image locally and retain source/attribution metadata when available.
6. Respect the API's current terms, license, and attribution requirements.
7. Do not make the dashboard depend on this service at runtime.

**Important:** Open Beauty Facts is primarily a community cosmetics database, not a fragrance-specific catalog. It may not find Afnan 9 PM or niche/Indian attars. Do not claim it will find every perfume.

### 9.2 Manual upload (mandatory feature)

Every fragrance create/edit screen must include:
- Bottle-image preview.
- “Search image” action.
- “Upload image” action.
- “Replace image” action.
- “Remove image” action.
- Placeholder image when none exists.

Support JPEG, PNG, and WebP; enforce a reasonable size limit, validate MIME type, generate safe filenames, and never trust the uploaded filename as a filesystem path. Save files under persistent `/app/images/bottles/` and store a relative path in SQLite. Restrict upload handling to the app's authenticated/private interface.

### 9.3 Image fallback priority

1. User-confirmed external result.
2. Manually uploaded bottle photo.
3. Locally seeded image where a suitable, properly sourced asset is available.
4. Brand/family neutral placeholder.

Do not hotlink arbitrary images indefinitely; download and cache images only where allowed.

---

## 10. Optional OpenAI integration — use sparingly

OpenAI is **not required for the core app** and must be disabled by default. The deterministic pairing engine remains the authority.

Potential useful uses:
1. **Metadata assistance:** Given an exact fragrance name and brand, return candidate fragrance-family/note tags in structured JSON. Mark these tags as `inferred` and require confirmation if confidence is low.
2. **Plain-language explanation:** Rewrite a deterministic engine explanation into a short, user-friendly sentence, without adding facts not present in the matched rules.
3. **Name cleanup:** Suggest possible corrections for uncertain names such as “Zidan/Zadar”, but require user confirmation and never overwrite the original record silently.

Do **not** use OpenAI to:
- Invent fragrance notes when reliable information is missing.
- Generate arbitrary combinations without the pairing engine.
- Claim a combination is safe, proven, or guaranteed to smell good.
- Decide the final score without explainable rules.
- Require an API key for ordinary browsing or recommendations.

If enabled:
- Use the backend only; never expose the key in frontend JavaScript.
- Store the key in `.env` as `OPENAI_API_KEY`.
- Set `OPENAI_ENABLED=false` by default.
- Make failures non-blocking.
- Show inferred metadata provenance and let the user edit it.
- Do not send personal data; the fragrance catalog is the only necessary context.
- Avoid unnecessary calls; cache results.
- Document that API usage may incur charges.

---

## 11. API endpoints (proposed)

- `GET /api/health` — health check.
- `GET /api/fragrances` — list/search/filter collection.
- `GET /api/fragrances/{id}` — detail.
- `POST /api/fragrances` — create a record.
- `PATCH /api/fragrances/{id}` — edit metadata/preferences.
- `POST /api/fragrances/{id}/image` — upload bottle image.
- `POST /api/fragrances/{id}/image-search` — query configured image provider and return candidates.
- `DELETE /api/fragrances/{id}/image` — remove image.
- `GET /api/recommendations?occasion=party` — return ranked, explainable recommendations.
- `GET /api/fragrances/{id}/pairings` — return rule-qualified pair candidates.
- `POST /api/combinations` — save a combination.
- `PATCH /api/combinations/{id}/feedback` — save user feedback.
- `GET /api/combinations` — list saved combinations.
- `POST /api/seed` should not be public in production; seeding should run via a startup migration/command.

Validate inputs and return useful error messages. Never return filesystem paths that expose server internals.

---

## 12. Three-stage delivery plan — implement and review one stage at a time

### Stage 1 — Visual collection and foundation

**Build only this stage first. Deploy it and ask the user to review before continuing.**

Deliverables:
- React/TypeScript + FastAPI app.
- Plus Jakarta Sans typography and responsive, premium visual design.
- SQLite schema and persistent Docker storage.
- Seed all 25 collection records listed in Section 6.
- Image-card collection with search and basic filters.
- Add/edit/archive fragrance.
- Image placeholder, manual upload, replace, and remove.
- Free Open Beauty Facts lookup integration as best-effort, with candidate confirmation and caching.
- Docker Compose, health check, environment example, backup/restore instructions.
- No pairing recommendations beyond a disabled/placeholder UI.
- No OpenAI dependency required.

Acceptance criteria:
- Clean Docker startup on the user's Ubuntu home server.
- Data and uploaded images persist after container recreation.
- Seeding does not duplicate records or overwrite user changes.
- All 25 records appear.
- Unknown fragrance names remain flagged rather than silently “corrected”.
- Image search failures never block the app.
- Manual image upload works.
- User can review the dashboard and request changes before Stage 2.

**Stop after Stage 1 and obtain user review.**

### Stage 2 — Deterministic recommendations and pairing engine

Start only after Stage 1 is reviewed and accepted.

Deliverables:
- Occasion selector.
- Recommendation cards with 3–5 ranked options.
- Rule-based pairing engine described in Section 8.
- Explainable scores and reasons.
- Pairing Lab.
- Saved combinations.
- Feedback buttons: Loved it / Good / Didn't work.
- Unit tests for compatibility rules, unknown metadata, rejection rules, scoring, and determinism.
- No random pairing; no pairing without a rule match.
- Optional OpenAI metadata assistance may be prototyped behind a feature flag, but core operation must remain deterministic and offline-capable.

Acceptance criteria:
- Every recommended pair shows the rule and known tags supporting it.
- Unknown profiles are not used for confident pairing.
- Rejected pairs do not appear in normal recommendations.
- The same inputs produce the same ranking.
- The user can review the recommendations and refine the rules before Stage 3.

**Stop after Stage 2 and obtain user review.**

### Stage 3 — Smarter personalization and polish

Start only after Stage 2 is reviewed and accepted.

Deliverables:
- Wear/selection history, recorded when user taps “Wear this”.
- Avoid-recent-repetition ranking.
- More personalization from combination feedback.
- Optional OpenAI-assisted metadata cleanup/explanations, disabled unless configured.
- Optional weather integration only if the user wants it; occasion-based recommendations must work without weather.
- Improved image matching/caching and data management.
- Export/backup UI and restore guidance.
- UI polish, accessibility, and performance pass.

Acceptance criteria:
- Recent choices influence diversity without overriding compatibility rules.
- Feedback changes rankings in a transparent way.
- OpenAI/weather outages do not break core features.
- Export and backup are usable.
- Final user review before considering the product complete.

---

## 13. Definition of done for the initial product

The app is ready for personal use when:
- It runs on the home server via Docker Compose.
- It contains the user's initial 25 fragrance records.
- The user can visually identify bottles and upload missing images.
- Collection data survives container restarts and updates.
- The user can choose an occasion and receive multiple explainable options (after Stage 2).
- Every pairing is supported by explicit rules; no random pairings.
- User feedback affects future ranking without requiring detailed performance logging.
- The app remains usable without an external image API or OpenAI.
- Backup and restore instructions are documented.
- Each stage has been reviewed and accepted before the next stage begins.

---

## 14. Developer instructions

1. Read this PRD completely before implementation.
2. Build **Stage 1 only** first.
3. Do not implement Stage 2 or Stage 3 until the user has reviewed Stage 1 and approved continuation.
4. Preserve the supplied collection names and uncertainty notes.
5. Do not fabricate fragrance notes or images.
6. Keep all external integrations optional and failure-tolerant.
7. Keep pairing decisions deterministic and explainable.
8. Use Plus Jakarta Sans throughout the interface.
9. Provide a clear README with Docker startup, environment configuration, backup/restore, and update instructions.
10. At the end of each stage, summarize what was implemented, list tests run, show known limitations, and ask for review.

---

## 15. External reference

- Open Beauty Facts documentation: https://openbeautyfacts.github.io/documentation/
- Open Beauty Facts API tutorial / behavior: https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/scanning-cosmetics-pet-food-and-other-products/

Open Beauty Facts is free and community-maintained. Coverage for perfumes is not guaranteed; manual upload is a required fallback. Review the current API terms and attribution/license requirements before shipping image reuse.
