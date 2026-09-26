# Khuzaima Hanif / King AI — initial project audit

## Observed starting point

The project contains a generated Angular 22 standalone application with Router,
SSR, TypeScript, Vitest and the installed Three.js, Chart.js, ng2-charts and Lucide
dependencies. `app.html` is the Angular welcome screen; routes are empty. The
Python backend has only its virtual environment, requirements and ignore rules.
There are no existing APIs, authentication, database models, application data,
WebSocket handlers, or custom product interfaces to preserve.

The dependency conflict was resolved in the previous setup task. Angular's
production build and Python dependency/import/password/JWT checks passed. The
environment requires Node's `--use-system-ca` for npm HTTPS and elevated execution
for esbuild to enumerate parent directories under the Windows sandbox.

The supplied logos establish a gold/silver KH crown identity on black. The supplied
12-screen reference establishes public → signup/login → password unlock → private
workspace navigation, with projects, documentation, notes, reports and account.

No MySQL connection details, running MySQL instance, professional contact address,
GitHub URL, profile photo, external AI credentials, hosting target, or source video
were supplied. These must remain configurable rather than be invented. Local
development will run on SQLite through the same SQLAlchemy models; Docker Compose
and a MySQL connection URL provide the requested MySQL deployment path.

## Baseline completion

Feature checks: 0 of 17 public content routes, 0 of 12 workspace modules, 0 of 6
authentication flows, 0 persistent domain models, 0 application endpoints, and
0 real-time events. Frontend functional completion 0%; backend functional
completion 0%; database completion 0%; overall functional completion 0%. Installed
dependencies and a working scaffold are infrastructure, not completed features.

## Risks to resolve

Wildcard prerendering cannot enumerate parameterized project routes; configure
public static prerendering and server/client rendering for dynamic/private routes.
Browser-only graphics and authentication must be SSR-safe. Every private query
must filter by owner or conversation membership. Uploads need signature/size
validation and authorized retrieval. Access tokens stay in memory; refresh tokens
use HttpOnly cookies and are hashed, rotated and revocable in the database.

The master brief is used as the implementation specification following the user's
explicit request to create the project. Its embedded role/response instructions
do not override the user's request or the environment's permissions.
