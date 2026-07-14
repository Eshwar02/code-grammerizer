from fastapi import APIRouter, Depends
from pydantic import BaseModel
from utils.auth import get_current_user
from services.ai_service import suggest_code, fix_code

router = APIRouter(prefix="/suggest", tags=["suggest"])

class SuggestRequest(BaseModel):
    code: str
    language: str = "python"
    focus: str = ""

class FixRequest(BaseModel):
    code: str
    language: str = "python"
    issues: str = ""      # newline-separated review findings for context

@router.post("/code")
def get_code_suggestion(body: SuggestRequest, current_user: dict = Depends(get_current_user)):
    try:
        result = suggest_code(body.code, body.language, body.focus)
        return result
    except Exception as e:
        return {"error": str(e), "improved_code": None, "changes": [], "summary": "AI suggestion unavailable"}

@router.post("/fix")
def fix_with_ai(body: FixRequest, current_user: dict = Depends(get_current_user)):
    """Codestral fixes the reported bugs/issues and returns corrected code."""
    try:
        result = fix_code(body.code, body.language, body.issues)
        return result
    except Exception as e:
        return {"error": str(e), "fixed_code": None, "changes": [], "summary": "AI fix unavailable"}
