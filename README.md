# GATE Assessment

Performance reviews for the APK Gate team. Roles: Backend, Frontend, DevOps, DevNet, Service, QA. Levels L1–L7. Sign-in required.

## Start (development)

```bash
cd ~/gate-assessment
cp -n .env.example .env   # optional; defaults work for local use
npm install
npm run dev
```

- App: http://127.0.0.1:5173
- API: http://127.0.0.1:3001 (Vite proxies `/api`)

## Admin login

| Field | Default |
| --- | --- |
| Username | `m.dehghan` |
| Password | `gate-admin-change-me` |

Set `ADMIN_PASSWORD` and `SESSION_SECRET` in `.env` **before the first start** (the hash is written into `data/store.json`). After that, change the password from the Roles tab, or via `POST /api/password`. Deleting `data/store.json` re-seeds users and rubrics.

GATE teammates also get accounts (same default password) and can run assessments. Only the admin can add or edit roles.

Do not commit `.env` or `data/store.json`.

## What it does

- Authenticated assessment: pick a GATE role and level, score metrics 1–7, radar vs expected threshold, promotion checklist, evidence notes.
- **Metric specifications** on the main page: what grows each of the five main metrics, and the recommended score range per level.
- **Evaluation report** on the main page, exportable as a one-page PDF.
- Per-employee PDF export covering that person's role skills and shared domains.
- Admin **Roles** tab: add, edit, and delete roles and their technical rubrics (including L1–L7 expectations).
- Rubrics are original GATE-specific content (UTM / firewall product work), not copied from other platforms.

## Scoring scale

Scores run **1–7**, matching the L1–L7 ladder: a score of N describes the work expected of an LN engineer, so an L3 sits mid-scale with real headroom above them.

| Level | Expected score |
| --- | --- |
| L1 | 1.0 |
| L2 | 2.0 |
| L3 | 3.0 |
| L4 | 4.0 |
| L5 | 5.0 |
| L6 | 6.0 |
| L7 | 6.8 |

L7 stops at 6.8 so the top of the ladder stays reachable without demanding a literal perfect score on every metric. The scale, the level expectations, and the review outcome thresholds live in `server/seedDefaults.js`, mirrored in `src/lib.js` as `SCORE_MAX` and `LEVEL_EXPECTATIONS`.

## Metric specifications

The five main metrics — Impact (30%), Execution (25%), Ownership (20%), Collaboration (15%), Growth (10%) — each break down into four parameters in `src/metric-specs.js`. Every parameter carries a recommended score range for each level L1–L7, and the position-dependent ones (scope of impact, business outcome, change failure rate, incident response) have per-role wording.

Ranges come from three ramps:

| Ramp | Meaning | L1 | L3 | L5 | L7 |
| --- | --- | --- | --- | --- | --- |
| Hygiene | Expected solid early, then saturates | 1.5–2.5 | 3.5–4.5 | 5.0–6.0 | 6.0–7.0 |
| Core | Tracks the level expectation | 1.0–1.5 | 2.5–3.5 | 4.5–5.5 | 6.3–7.0 |
| Leadership | Unlocks once scope widens | 1.0–1.0 | 1.5–2.5 | 4.0–5.0 | 6.0–7.0 |

The weighted midpoint of all parameters lands on the level expectation within 0.04 for L2–L5 (L1 sits +0.35 because 1.0 is the floor of the scale, L7 −0.21). The ranges therefore calibrate against the same threshold the overall score is judged by. They are guidance for calibration, not a cap.

Basis: scope-and-autonomy ladders (task → component → system → cross-team → org), DORA delivery metrics (lead time, change failure rate, MTTR), and the SPACE communication dimension. Volume signals — commits, pull requests, lines of code, story points — are deliberately excluded because AI assistants inflate all of them.

## Evaluation report

The report compares the latest quarter with the one before it across the five main metrics plus the final score, and nothing else. Detail lives on the main page; the export stays to one page. With only one quarter on record it shows that quarter and says so explicitly.

## Q1 1405 archive

The previous spreadsheet review (`advanced_team_evaluation.xlsx`) is imported as period **Q1 1405**. The file is stored at `data/archives/q1-1405-advanced_team_evaluation.xlsx`.

Original columns (Impact 30%, Execution 25%, Ownership 20%, Collaboration 15%, Growth 10%) are kept on each scorecard as entered and mapped onto today’s domains so the radar still works. Hamed Dehghan and Mohsen Noeiaval had no numeric scores in the file; they are archived as incomplete stubs.

The scoring UI now runs 1–7 so it matches L1–L7. Archived Q1 numbers are **not** stretched: a 4.21 stays 4.21.

Re-import (then restart the server):

```bash
node scripts/import-q1-1405.js
```

## Production

```bash
npm run build
NODE_ENV=production npm start
```

With `HTTPS=true` in `.env`, production serves the API and built UI on HTTPS `PORT` (default **443**, Certum `*.apk-group.net` in gitignored `certs/fullchain.pem` + `certs/key.pem`). Employees open `https://gate-assessment.apk-group.net/` with no port. HTTP on `HTTP_PORT` (default 3080) only redirects to HTTPS without a port suffix when `PORT=443`. Binding 443 as a non-root user (no passwordless sudo here) needs a one-time, reversible cap on an **app-local** Node copy — not `/usr/bin/node`:

```bash
mkdir -p .bin
cp /usr/bin/node .bin/gate-node
sudo /sbin/setcap cap_net_bind_service=+ep /home/mastor/gate-assessment/.bin/gate-node
# undo: sudo /sbin/setcap -r /home/mastor/gate-assessment/.bin/gate-node
```

Replacing `.bin/gate-node` (copy, `cp`, or overwrite) **drops** the capability. Re-run `setcap` before restarting, then `systemctl --user restart gate-assessment`.

### systemd (survives reboot and Cursor shells)

Preferred: **user** unit + linger (no AmbientCapabilities; the file cap on `.bin/gate-node` is enough):

- Unit: `~/.config/systemd/user/gate-assessment.service`
- Repo copy / system fallback: `deploy/gate-assessment.service`

```bash
loginctl enable-linger mastor
systemctl --user daemon-reload
systemctl --user enable --now gate-assessment.service
systemctl --user status gate-assessment.service
```

Linger makes `user@1000` start at boot so the unit comes up without a login. Passwordless `sudo -n` is not required for this path.

If the user unit cannot bind 443 or does not survive reboot, install the system unit (runs as `mastor`, not root):

```bash
sudo cp /home/mastor/gate-assessment/deploy/gate-assessment.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gate-assessment.service
```

Do not run production from a Cursor background shell once the unit is active — only one process should listen on 443.

Internal AD maps `gate-assessment.apk-group.net` → `172.25.7.28`. Do not reuse `assessment-platform.apk-group.net`. Keep the Debian nginx default site on `:80`; this app does not steal unrelated vhosts.

Optional alternative (also needs sudo): `sudo ./deploy/install-nginx-tls.sh` so nginx terminates TLS on 443 and proxies to loopback 3001 (`PROXY_TLS=true`, `BIND_HOST=127.0.0.1`). Only use that if Node cannot bind 443. That script must not replace the Debian default site.

Development (`npm run dev`) stays HTTP: Vite on 5173 proxies `/api` to `http://127.0.0.1:3001`. Use `PORT=3001 npm run server` for a local API so it does not compete with production on 443. `HTTPS=true` is applied only when `NODE_ENV=production`.
