from fastapi import APIRouter, Depends
from pydantic import BaseModel
from utils.auth import get_current_user
from services.live_lint_service import live_lint

router = APIRouter(prefix="/lint", tags=["lint"])


class LiveLintRequest(BaseModel):
    code: str
    language: str = "python"


@router.post("/live")
def live_lint_endpoint(body: LiveLintRequest, current_user: dict = Depends(get_current_user)):
    findings = live_lint(body.code, body.language)
    return {"findings": findings, "count": len(findings)}
