import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, upload, review, report, lint, suggest

app = FastAPI(title="Code-Grammerizer", version="1.0.0")

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


@app.get("/health")
def health():
    return {"status": "ok"}
