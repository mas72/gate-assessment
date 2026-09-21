# GATE Assessment

Performance reviews for the APK Gate team. Roles: Backend, Frontend, DevOps, DevNet, Service, QA. Levels L1–L7. Sign-in required.

- **Live:** https://gate-assessment.apk-group.net/
- **Clone:** `git clone https://github.com/mas72/gate-assessment.git`

## Access

| Role | Username | What they can do |
| --- | --- | --- |
| Admin | `m.dehghan` | Full access: reviews, roles, specs, team PDF |
| Team | GATE username (e.g. `ali.dehghan`) | Read-only: own scorecards |

Set `ADMIN_PASSWORD`, `DEFAULT_PASSWORD`, and `SESSION_SECRET` in `.env` **before the first start**. Hashes are written into `data/store.json` on seed. After that, change a password with `POST /api/password` (or delete `data/store.json` to re-seed).

Do not commit `.env`, `data/store.json`, or `certs/`. The login page does not show passwords.

## Start (development)

```bash
cd gate-assessment
cp -n .env.example .env
# For local Vite, set PORT=3001 and HTTPS=false (or omit HTTPS) in .env
npm install
npm run dev
```

- App: http://127.0.0.1:5173
- API: http://127.0.0.1:3001 (Vite proxies `/api`)

## Production

```bash
npm run build
NODE_ENV=production npm start
```

This host serves HTTPS on **443** with the Certum wildcard (`certs/fullchain.pem` + `certs/key.pem`, gitignored). HTTP on **3080** redirects to `https://gate-assessment.apk-group.net/` (no port).

Binding 443 as a non-root user needs a one-time cap on an **app-local** Node binary, not `/usr/bin/node`:

```bash
mkdir -p .bin
cp "$(command -v node)" .bin/gate-node
sudo /sbin/setcap cap_net_bind_service=+ep "$PWD/.bin/gate-node"
```

Replacing `.bin/gate-node` drops the capability. Re-run `setcap`, then restart the service.

### systemd (boot + crash restart)

Preferred: user unit + linger (uses the file cap on `.bin/gate-node`):

```bash
loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user enable --now gate-assessment.service
systemctl --user status gate-assessment.service
```

Repo copy / system fallback: `deploy/gate-assessment.service`. Do not start a second production Node process while the unit is active — only one listener should own 443.

Internal DNS: `gate-assessment.apk-group.net` → this host. Do not reuse `assessment-platform.apk-group.net`.

Development stays HTTP: `PORT=3001 npm run server` so it does not compete with production on 443. `HTTPS=true` applies only when `NODE_ENV=production`.

## What it does

- Authenticated assessment: pick a GATE role and level, score metrics 1–7, radar vs expected threshold, promotion checklist, evidence notes.
- Metric specifications: what grows each of the five main metrics, and the recommended score range per level.
- Evaluation report, exportable as PDF. Admin team report compares Q1 vs Q2.
- Per-employee PDF covering that person's role skills and shared domains.
- Admin Roles tab: add, edit, and delete roles and technical rubrics (including L1–L7 expectations).
- Rubrics are original GATE-specific content (UTM / firewall product work).

## Scoring scale

Scores run **1–7**, matching the L1–L7 ladder: a score of N describes the work expected of an LN engineer.

| Level | Expected score |
| --- | --- |
| L1 | 1.0 |
| L2 | 2.0 |
| L3 | 3.0 |
| L4 | 4.0 |
| L5 | 5.0 |
| L6 | 6.0 |
| L7 | 6.8 |

L7 stops at 6.8 so the top of the ladder stays reachable. Scale and thresholds live in `server/seedDefaults.js`, mirrored in `src/lib.js` as `SCORE_MAX` and `LEVEL_EXPECTATIONS`.

**Final** = `0.30·Impact + 0.25·Execution + 0.20·Ownership + 0.15·Collaboration + 0.10·Growth`. Unscored metrics count as **0**.

## Metric specifications

The five main metrics each break down into parameters in `src/metric-specs.js`. Every parameter has a recommended score range for L1–L7.

| Ramp | Meaning | L1 | L3 | L5 | L7 |
| --- | --- | --- | --- | --- | --- |
| Hygiene | Expected solid early, then saturates | 1.5–2.5 | 3.5–4.5 | 5.0–6.0 | 6.0–7.0 |
| Core | Tracks the level expectation | 1.0–1.5 | 2.5–3.5 | 4.5–5.5 | 6.3–7.0 |
| Leadership | Unlocks once scope widens | 1.0–1.0 | 1.5–2.5 | 4.0–5.0 | 6.0–7.0 |

Ranges are guidance for calibration, not a cap. Volume signals (commits, PRs, lines of code, story points) are excluded because AI assistants inflate them.

## Evaluation report

The report compares the latest quarter with the one before it across the five main metrics plus the final score. With only one quarter on record it shows that quarter and says so.

## Q1 1405 archive

The previous spreadsheet review is imported as period **Q1 1405**. File: `data/archives/q1-1405-advanced_team_evaluation.xlsx`.

Original columns are kept on each scorecard. Archived Q1 numbers are **not** stretched: a 4.21 stays 4.21.

Re-import (then restart the server):

```bash
node scripts/import-q1-1405.js
```
