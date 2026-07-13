from fastapi import APIRouter, Depends
from pydantic import BaseModel
from utils.auth import get_current_user
from services.ai_service import suggest_code

router = APIRouter(prefix="/suggest", tags=["suggest"])

class SuggestRequest(BaseModel):
    code: str
    language: str = "python"
    focus: str = ""

@router.post("/code")
def get_code_suggestion(body: SuggestRequest, current_user: dict = Depends(get_current_user)):
    try:
        result = suggest_code(body.code, body.language, body.focus)
        return result
    except Exception as e:
        return {"error": str(e), "improved_code": None, "changes": [], "summary": "AI suggestion unavailable"}
