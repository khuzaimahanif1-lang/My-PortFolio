# Windows setup

Run `.\Start-Project.ps1` from the project root to start the API and built preview together at http://127.0.0.1:4000. These services keep running in hidden background windows when the launcher returns; `.\Stop-Project.ps1` stops only its managed processes. Use `-Build` on Start-Project.ps1 after changing frontend source. Existing databases and accounts are preserved.

Start-Backend.ps1 and Start-Frontend.ps1 remain available for two-terminal development at port 4300. Keep the backend terminal running when using that mode. Full configuration, verification and deployment preparation are documented in README.md.

## Dependency issue resolved

npm commands must run inside Frontend. This project now uses Angular 22, matching @angular/cdk 22, ng2-charts 10, chart.js 4.5.1, three 0.186.0, and @lucide/angular 1.45.0. The old lucide-angular package is replaced with the maintained Angular package. Avoid --force and --legacy-peer-deps.

Node 24 may need the Windows trusted certificate store in this environment:

```powershell
$env:NODE_OPTIONS = ($env:NODE_OPTIONS + ' --use-system-ca').Trim()
cd Frontend
npm ci
```

Backend/requirements.txt pins compatible Passlib 1.7.4 and bcrypt 4.0.1. The supplied pip output indicated a successful install; a runtime compatibility issue with bcrypt 5 was corrected and password hashing is tested.

## Manual startup

```powershell
# Backend terminal, from the project root
cd Backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# Start-Backend.ps1 generates .env if absent. Preserve the existing secret.
.\.venv\Scripts\python.exe -m app.seed
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Frontend terminal, from the project root
cd Frontend
npm start -- --host 127.0.0.1 --port 4300
```

Open http://127.0.0.1:4300 and use the local owner credentials in Backend/storage/owner-credentials.txt, or create a private user account. Authentication and API calls need the backend running. Database and image files persist under Backend/storage.

Ports 4200, 4300 and 4000 on localhost/127.0.0.1 are allowed by the development defaults. When overriding ALLOWED_ORIGINS, include the exact URL you use in the browser.


Call and desktop access setup is documented in docs/COMMUNICATION.md.
