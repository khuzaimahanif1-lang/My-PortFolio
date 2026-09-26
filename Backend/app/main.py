from contextlib import asynccontextmanager
from collections import defaultdict,deque
import time
from fastapi import FastAPI,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .core.config import get_settings
from .core.database import Base,engine
from .core.migrations import migrate_portfolio
from . import models
from .routers import auth,public,workspace,reports,messages,account,search,assistant,project_images,calls,portfolio

settings=get_settings()
@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    migrate_portfolio(engine)
    yield
app=FastAPI(title=settings.app_name,version="1.0.0",lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=settings.origins,allow_credentials=True,
    allow_methods=["GET","POST","PUT","DELETE"],allow_headers=["Authorization","Content-Type"])
attempts=defaultdict(deque)

@app.middleware("http")
async def security(request: Request,call_next):
    if request.method in ("POST","PUT","DELETE"):
        origin=request.headers.get("origin")
        if origin and origin not in settings.origins:
            return JSONResponse({"detail":"This origin is not allowed."},status_code=403)
        try:
            if int(request.headers.get("content-length","0"))>8*1024*1024:
                return JSONResponse({"detail":"Request is too large."},status_code=413)
        except ValueError:
            return JSONResponse({"detail":"Invalid request length."},status_code=400)
    limited=request.url.path in ("/api/auth/login","/api/auth/signup","/api/auth/forgot-password",
        "/api/calls/join","/api/calls","/api/auth/reset-password","/api/auth/unlock","/api/public/contact","/api/assistant/summarize")
    if limited and request.method=="POST":
        key=(request.client.host if request.client else "unknown",request.url.path)
        window=attempts[key]
        current=time.monotonic()
        while window and window[0]<current-60:
            window.popleft()
        if len(window)>=10:
            return JSONResponse({"detail":"Too many attempts. Please wait a minute."},status_code=429,
                headers={"Retry-After":"60"})
        window.append(current)
        if len(attempts)>10000:
            for stale in list(attempts):
                if not attempts[stale] or attempts[stale][-1]<current-60:
                    del attempts[stale]
    response=await call_next(request)
    response.headers["X-Content-Type-Options"]="nosniff"
    response.headers["Referrer-Policy"]="strict-origin-when-cross-origin"
    if request.url.path.startswith("/api") and not request.url.path.startswith("/api/public"):
        response.headers["Cache-Control"]="no-store"
    return response

@app.get("/api/health")
def health():
    return {"status":"ok","service":"king-ai","database":"mysql" if settings.database_url.startswith("mysql") else "sqlite-local"}
for router in (auth.router,public.router,workspace.router,reports.router,messages.router,account.router,search.router,assistant.router,project_images.router,calls.router,portfolio.router):
    app.include_router(router,prefix="/api")

