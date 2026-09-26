# Khuzaima Hanif / King AI

An Angular portfolio and a FastAPI private workspace, with the supplied gold and silver KH branding, an original 320-frame orbital sequence, and a separate looping video atmosphere.

## Run locally

From this folder, start the API and production preview together:

```powershell
.\Start-Project.ps1
# http://127.0.0.1:4000
```

The launcher starts hidden background services, waits for API/proxy health, logs errors under Backend/storage/runtime-*.log and reuses already running services. You can close the launching terminal. Existing accounts and database files are preserved. Run `.\Stop-Project.ps1` to stop only the processes managed by this launcher. After frontend source changes, run `.\Start-Project.ps1 -Build` to rebuild and restart the managed preview.

For Angular development with live compilation, use two terminals instead: `.\Start-Backend.ps1` and `.\Start-Frontend.ps1`, then open http://127.0.0.1:4300. Keep both development terminals running. The API listens on 127.0.0.1:8000; frontend servers forward /api and WebSockets to it. An unavailable API causes HTTP 502 from the preview proxy.

The first backend seed creates a local owner and writes its random credentials to **Backend/storage/owner-credentials.txt**. That file, the database, uploads and secrets are ignored by Git. Existing accounts and projects are preserved on subsequent starts. Use **Add project** or **Edit projects** on the first screen of the public portfolio. Sign-in or unlocking returns the owner to that landing editor. The header **Edit portfolio** opens the same manager. New signups receive a private USER account; they cannot publish to the owner's public portfolio.

For manual SSR startup, keep the API running on port 8000 in a separate terminal and use an available frontend port. Start-Project.ps1 handles both services automatically. Manual frontend commands:

```powershell
cd Frontend
npm run build
npm run serve:ssr:Frontend
# http://127.0.0.1:4000
```

## Features

- Collapsible workspace menus, personal workspace name/accent, outside-click notification menus and scoped notification deletion.
- Communication page with voice/video calls, expiring-code desktop sharing, and locally approved Windows desktop control.
- Owner-only Add and Edit project controls on the portfolio home, Selected work, and project detail pages; saved portfolio drafts, publication, image uploads/removal/cover selection, demo links, source links, and documentation.
- Public home, projects and details, about, skills, experience, journey, timeline, achievements, goals, contact, AI/ML, technology, research and blog routes.
- Signup, login, remember me, rotating HttpOnly refresh sessions, password recovery/reset, session revocation, and password-only workspace unlock. Manual workspace locking locks the account's active sessions; each session needs a password to unlock. Refreshes coordinate across tabs where Web Locks are supported.
- Dashboard metrics calculated from the database, projects with documentation and screenshot uploads, task board/list with subtasks and comments, goals with milestones, and a Markdown notepad with autosave, pin, favorite, archive, categories and tags.
- Reports, date filtering, chart visualizations, learning logs, activity history and CSV exports.
- Conversations, text and links, authenticated image uploads, history pagination, read receipts, presence, typing, reconnect, notifications and scoped global search.
- Profile editing, appearance preferences, active sessions, password changes, owner-only public content editing and contact inbox.
- Optional provider-backed AI note, project and report summaries; an explicit unavailable state when credentials are absent.
- Lazy feature routes, mobile navigation, native accessible dialogs, reduced motion, bounded frame loading, WebGL cleanup and branded loading states.

The four seeded projects are **planned concepts from the brief**, not completed products. No work history, certificate, article, contact address, real portrait or deployed product was invented. Update public content in **Settings**. Manage personal portfolio projects directly on **http://127.0.0.1:4000/** using the first-screen **Add project** and **Edit projects** buttons. The project showcase is immediately below the hero; the separate **/projects** page also supports management. Check **Publish on the portfolio homepage** to make a project visible to visitors; uncheck it to keep a portfolio draft with an owner-only preview. Ordinary private workspace projects stay outside this portfolio list.

## Configuration

Backend/.env is local and contains a generated JWT signing secret. Backend/.env.example documents the available settings.

Local development uses a real SQLite database at Backend/storage/workspace.db. Set DATABASE_URL to a MySQL SQLAlchemy URL for MySQL. The normalized schema has 18 tables; docs/mysql-schema.sql contains generated MySQL DDL. The idempotent startup migration adds the portfolio scope field to existing project records and retains all already-published owner projects. The local database was backed up before this upgrade under Backend/storage/backups/.

Recovery links are delivered by SMTP when configured. Without SMTP, development writes links to Backend/storage/outbox. Production never uses the development outbox. Configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD and SMTP_FROM for real email.

AI summaries require AI_BASE_URL, AI_API_KEY and AI_MODEL for a compatible chat-completions provider. Text is sent to that configured provider only when a summary action is requested. No simulated AI response is returned.

## Verify

```powershell
# Backend: isolated temporary database and synthetic users
cd Backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m pip check

# Frontend
cd ..\Frontend
npm test -- --watch=false
npm run build

# Running production server: creates and removes disposable QA records
cd ..
Backend\.venv\Scripts\python.exe tools\smoke_local.py http://127.0.0.1:4000
```

The test runner uses one worker to avoid exhausting memory on Windows.

## Deployment preparation

Copy .env.example to a root .env, supply strong secrets and URL-safe MySQL passwords, and run docker compose up --build. This starts MySQL, the API and the SSR frontend on port 4000. Then run docker compose exec backend python -m app.seed to create the owner inside its persistent storage volume.

For public production, configure an HTTPS reverse proxy/domain, ENVIRONMENT=production, COOKIE_SECURE=true, explicit HTTPS origins, SSR_ALLOWED_HOSTS containing your domain hostname, SMTP, and a MySQL backup plan. The backend validates required production settings at startup. Docker and live MySQL execution require Docker/a database service; external hosting credentials were not supplied.

The realtime hub is in-process and the backend deliberately runs one worker. Multiple API instances require shared presence/ticket/event storage such as Redis before scaling. Schema upgrades currently require reviewed migration scripts; create_all initializes tables but does not migrate existing schemas.

## Project map

| Folder | Purpose |
|---|---|
| Frontend/src/app/core | HTTP, authentication, guards, realtime and types |
| Frontend/src/app/layouts | Public and private navigation |
| Frontend/src/app/features | Standalone lazy feature pages |
| Frontend/src/app/shared | Icons, forms, dialogs, charts, Markdown and motion |
| Backend/app/routers | HTTP/WebSocket endpoints |
| Backend/app/services | Password/session logic, analytics and optional integrations |
| Backend/app/repositories | Ownership checks and activity recording |
| Backend/app/models.py | SQLAlchemy persistence |
| tools | Reproducible media, schema and running-server verification |
| docs | Baseline audit, blueprint, schema and final verification audit |

See [the verification audit](docs/FINAL-AUDIT.md) for checked behavior and limits, and [Communication setup](docs/COMMUNICATION.md) for calls, relays and the desktop helper.
