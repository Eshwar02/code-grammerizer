from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from models.supabase_client import get_supabase
from utils.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    name: str = None
    avatar_url: str = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/register", status_code=201)
def register(body: RegisterRequest):
    sb = get_supabase()
    existing = sb.table("users").select("id").eq("email", body.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")
    result = sb.table("users").insert({
        "name": body.name,
        "email": body.email,
        "password_hash": hash_password(body.password),
    }).execute()
    user = result.data[0]
    token = create_access_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}


@router.post("/login")
def login(body: LoginRequest):
    sb = get_supabase()
    result = sb.table("users").select("*").eq("email", body.email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = result.data[0]
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.put("/profile")
def update_profile(body: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    updates = {}
    if body.name:
        updates["name"] = body.name
    if body.avatar_url is not None:
        updates["avatar_url"] = body.avatar_url
    if not updates:
        return current_user
    result = sb.table("users").update(updates).eq("id", current_user["id"]).execute()
    u = result.data[0]
    return {"id": u["id"], "name": u["name"], "email": u["email"]}


@router.get("/stats")
def get_user_stats(current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    from services.ai_service import generate_profile_insight

    # Get all user projects
    projects = sb.table("projects").select("id").eq("user_id", current_user["id"]).execute()
    project_ids = [p["id"] for p in projects.data] if projects.data else []

    if not project_ids:
        return {
            "total_reviews": 0, "avg_score": 0, "best_score": 0,
            "good_codes": 0, "total_findings": 0, "accuracy": 0,
            "level": "Beginner", "encouragement": "Submit your first code review to get started!",
            "quote": '"The best way to learn is to do." - Paul Halmos', "tip": "Start with a small Python script."
        }

    # Get all reviews
    reviews = sb.table("reviews").select("id, review_score").in_("project_id", project_ids).execute()
    scores = [r["review_score"] for r in reviews.data if r.get("review_score") is not None]

    total = len(scores)
    avg_score = round(sum(scores) / total) if total > 0 else 0
    best_score = round(max(scores)) if scores else 0
    good_codes = sum(1 for s in scores if s >= 75)

    # Get findings count
    review_ids = [r["id"] for r in reviews.data if r.get("id")]
    findings_count = 0
    if review_ids:
        findings = sb.table("review_findings").select("id", count="exact").in_("review_id", review_ids).execute()
        findings_count = findings.count or 0

    accuracy = round((good_codes / total) * 100) if total > 0 else 0

    stats = {
        "total_reviews": total, "avg_score": avg_score, "best_score": best_score,
        "good_codes": good_codes, "total_findings": findings_count, "accuracy": accuracy
    }

    try:
        insight = generate_profile_insight(stats)
    except Exception:
        insight = {
            "level": "Intermediate",
            "encouragement": f"Great work! You've completed {total} reviews with an average score of {avg_score}/100.",
            "quote": '"Code is like humor. When you have to explain it, it is bad." - Cory House',
            "tip": "Focus on reducing complexity in your functions."
        }

    return {**stats, **insight}


@router.put("/change-password")
def change_password(body: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    sb = get_supabase()
    result = sb.table("users").select("password_hash").eq("id", current_user["id"]).execute()
    if not result.data or not verify_password(body.current_password, result.data[0]["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password incorrect")
    sb.table("users").update({"password_hash": hash_password(body.new_password)}).eq("id", current_user["id"]).execute()
    return {"message": "Password updated"}
