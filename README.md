# Scentmate — Stage 1

Scentmate is a private, visual fragrance collection for one user. Stage 3 adds visual polish, image selection, and gentle history based variety.

## Included

- Responsive collection dashboard using Plus Jakarta Sans, with a spacious desktop layout and mobile drawer navigation.
- A seeded, idempotent SQLite collection of all 25 names from the PRD. Uncertain products remain visibly marked **Profile incomplete**.
- Search, spray/attar/favourites filters, add, edit, archive, and persistent manual JPEG/PNG/WebP image upload (8 MB maximum). Existing images can be replaced or removed.
- A best-effort Open Beauty Facts lookup endpoint (`POST /api/fragrances/{id}/image-search`). It returns candidates only; nothing is selected or stored without user confirmation.
- A weather-aware, single-fragrance **daily pick** using free Open-Meteo browser requests. If location/weather is unavailable, it falls back safely.
- A deterministic pairing engine with named compatibility rules, occasion scoring, Pairing Lab filters, saved combinations, and exact-combination feedback.
- An image led collection view with a confirmation based Open Beauty Facts search. Chosen images are downloaded into the local persistent store.
- Wear history: tapping **Wear this** records the choice and gently moves recently worn pairs down later results without overriding compatibility rules.
- Docker Compose health check, persistent `data/` and `images/` volumes, and no required API key.

## Pairing safeguards

The Stage 2 pairing engine runs locally and has no AI or external dependency. It never shuffles possibilities: a pair is shown only when at least one explicit rule matches stored tags. Incomplete profiles do not make confident recommendations, and a combination marked **Didn't work** is excluded from normal results. Each card displays its rule ID and a short explanation.

## Deliberately not included

OpenAI integration and a backup/export screen remain out of scope. Existing backup and restore instructions below remain valid.

## Run locally

Requirements: Docker Compose.

```bash
docker compose up --build -d
```

Open `http://localhost:8787`. The Compose port is loopback-only by default, keeping it off the LAN/public internet. To use another device on your LAN, deliberately change the port binding and confirm your firewall/Tailscale setup first.

For frontend development:

```bash
cd frontend && npm install && npm run dev
```

In another terminal, install backend packages from `backend/requirements.txt` and run `uvicorn app.main:app --reload` with `PYTHONPATH=backend`.

## Persistence and backup

The SQLite database is `data/scentmate.db`; uploads are under `images/bottles/`. Both are mounted from the host and survive container recreation.

To back up while the app is stopped:

```bash
docker compose down
tar -czf scentmate-backup-$(date +%F).tgz data images
```

To restore, stop the app, replace `data/` and `images/` with the directories from the archive, then run `docker compose up -d`.

## Updating

```bash
docker compose up --build -d
```

Seeding checks whether collection records already exist, so it will not duplicate the initial collection or overwrite user edits.

## Environment

`.env.example` is intentionally empty because Stage 1 requires no credentials. Open Beauty Facts and Open-Meteo are nonessential, failure-tolerant integrations; the app stays usable if either is unavailable.
