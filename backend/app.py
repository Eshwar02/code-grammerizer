import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, upload, review, report, lint, suggest, workspace, collab
from models.supabase_client import get_supabase

log = logging.getLogger("uvicorn")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm the Supabase client (TLS handshake + HTTP/2 pool) and prime the
    # connection with a tiny query before the first user request. On free-tier
    # hosts the container cold-starts after idle; doing this here means the DB
    # round-trip is already paid for by the time someone opens the dashboard.
    try:
        get_supabase().table("projects").select("id").limit(1).execute()
        log.info("Supabase connection warmed on startup")
    except Exception as e:  # never block boot on a warm-up failure
        log.warning("Supabase warm-up skipped: %s", e)
    yield


app = FastAPI(title="Code-Grammerizer", version="1.0.0", lifespan=lifespan)

# Allow localhost in dev + any configured frontend URL in prod
_allowed = ["http://localhost:5173", "http://localhost:3000"]
_frontend_url = os.getenv("FRONTEND_URL", "")
if _frontend_url:
    _allowed.append(_frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(review.router)
app.include_router(report.router)
app.include_router(lint.router)
app.include_router(suggest.router)
app.include_router(workspace.router)
app.include_router(collab.router)


@app.get("/health")
def health():
    return {"status": "ok"}
