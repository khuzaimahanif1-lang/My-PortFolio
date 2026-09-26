# Development blueprint

Each stage builds on the preceding stage. At the initial audit all domain
features were empty; the generated Angular application and installed packages are
reused. Completion is recorded after functional validation in FINAL-AUDIT.md.

| Stage | Objective and missing work | Implementation files and functions | Validation / security / acceptance |
|---|---|---|---|
| 1 | Persistence and application foundation | Backend/app/core/config.py, database.py, models.py, schemas.py; get_db, lifespan; environment examples and MySQL Compose | SQLAlchemy foreign keys, indexes, input schemas, local startup and MySQL configuration |
| 2 | Accounts, sessions, recovery and lock | services/security.py, dependencies.py, routers/auth.py; password hashing, issue/rotate/revoke, cookie session, reset and unlock; Angular core/auth | Password hash/verify, token expiry, refresh rotation/revocation, one-time reset, lock enforcement, owner role |
| 3 | Public portfolio and projects | routers/public.py, workspace.py; profile and public project APIs; Angular public layout, home, content, project details | Actual configured content; public-only queries; all public routes load; contact persists |
| 4 | Private workspace CRUD | workspace.py, repositories/resources.py; project/task/note/goal creation, editing, deletion; Angular workspace feature pages | Cross-user ownership isolation; enums, progress/date/URL validation; persisted edits and empty/error states |
| 5 | Analytics and activity | services/analytics.py, reports API; Angular dashboard, charts and reports | Database-derived KPIs, trends, status and technology distribution; date filters; downloadable report |
| 6 | Messages, uploads and notifications | websocket/hub.py, routers/messages.py; conversation members, history, read/typing/presence events, secure attachments; Angular realtime service | Membership checks for history/uploads; reconnect; two-user delivery/read tests; authenticated notification updates |
| 7 | Profile, preferences, sessions, owner content and search | routers/account.py and search.py; Angular account/settings and global search | Current-password validation, revoke sessions, owner-only portfolio editing; bounded permission-scoped search |
| 8 | Immersive motion and brand assets | tools/generate_media.py; shared logo loader, scroll sequence, Three.js scene and reveal directive | 320 WebP frames with bounded cache, independent WebM atmosphere, responsive canvas, reduced-motion and cleanup |
| 9 | Optional AI assistance | routers/assistant.py, provider configuration; notes/project summary actions | External provider only with configured credentials; explicit unavailable state and request limits; no fabricated AI output |
| 10 | Verification and operation | Backend/tests, Angular tests, browser QA, start scripts, Dockerfiles, README, FINAL-AUDIT | Meaningful security/API tests, production build, browser signup/CRUD/lock flow, reproducible local startup |

Frontend architecture: standalone lazy routes → public/workspace layouts → feature
components → typed HTTP/auth/realtime services; signals for state; Router guards
and a single refresh-aware interceptor. Shared icons, modal, empty/loading states
and global design tokens avoid duplication. Backend architecture: routers →
services/repositories → SQLAlchemy models, with shared auth dependencies.

API surface: /api/public, /api/auth, /api/projects, /api/tasks, /api/notes,
/api/goals, /api/reports, /api/conversations, /api/messages, /api/uploads,
/api/notifications, /api/account, /api/search, /api/assistant and /api/ws.

Deployment preparation is authorized local work. External publishing requires a
real hosting target and configured production credentials; none were supplied.
