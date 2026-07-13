from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body
from models.supabase_client import get_supabase
from utils.auth import get_current_user
from services.pylint_service import run_pylint
from services.bandit_service import run_bandit
from services.radon_service import run_radon
from services.ai_service import ai_review_code, generate_documentation

router = APIRouter(prefix="/reviews", tags=["reviews"])


def _run_full_review(project_id: int, user_id: int):
    sb = get_supabase()
    proj_res = sb.table("projects").select("*").eq("id", project_id).execute()
    if not proj_res.data:
        return
    project = proj_res.data[0]
    code = project.get("file_content", "")
    language = project.get("language", "python")
    if not code:
        return

    static = {}
    complexity = {}
    if language == "python":
        try:
            static["pylint"] = run_pylint(code, project.get("file_name") or "code.py")
        except Exception as e:
            static["pylint"] = {"error": str(e), "findings": []}
        try:
            static["bandit"] = run_bandit(code)
        except Exception as e:
            static["bandit"] = {"error": str(e), "findings": []}
        try:
            complexity = run_radon(code)
        except Exception as e:
            complexity = {"error": str(e)}

    ai_result = {}
    docs = ""
    try:
        ai_result = ai_review_code(code, language)
    except Exception as e:
        ai_result = {
            "score": 0, "summary": f"AI review unavailable: {e}",
            "bugs": [], "security_issues": [], "code_smells": [],
            "performance": [], "naming_suggestions": [], "improvements_summary": "",
        }
    try:
        docs = generate_documentation(code, language)
    except Exception:
        docs = ""
    score = ai_result.get("score", 0)

    review_res = sb.table("reviews").insert({
        "project_id": project_id,
        "review_score": score,
        "summary": ai_result.get("summary", ""),
        "static_analysis": static,
        "complexity_metrics": complexity,
        "ai_review": ai_result,
        "documentation": str(docs),
    }).execute()
    review_id = review_res.data[0]["id"]

    findings = []
    for bug in ai_result.get("bugs", []):
        findings.append({"review_id": review_id, "severity": "high", "category": "bug",
                         "issue": bug.get("issue", ""), "suggestion": bug.get("suggestion", ""),
                         "line_number": bug.get("line")})
    for sec in ai_result.get("security_issues", []):
        findings.append({"review_id": review_id, "severity": sec.get("severity", "medium"),
                         "category": "security", "issue": sec.get("issue", ""),
                         "suggestion": sec.get("suggestion", ""), "line_number": sec.get("line")})
    for smell in ai_result.get("code_smells", []):
        findings.append({"review_id": review_id, "severity": "low", "category": "style",
                         "issue": smell.get("issue", ""), "suggestion": smell.get("suggestion", ""),
                         "line_number": smell.get("line")})
    for perf in ai_result.get("performance", []):
        findings.append({"review_id": review_id, "severity": "medium", "category": "performance",
                         "issue": perf.get("issue", ""), "suggestion": perf.get("suggestion", ""),
                         "line_number": perf.get("line")})
    if findings:
        sb.table("review_findings").insert(findings).execute()


@router.post("/{project_id}", status_code=202)
def trigger_review(project_id: int, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    proj = sb.table("projects").select("id").eq("id", project_id).eq("user_id", current_user["id"]).execute()
    if not proj.data:
        raise HTTPException(status_code=404, detail="Project not found")
    background_tasks.add_task(_run_full_review, project_id, current_user["id"])
    return {"message": "Review started", "project_id": project_id}


@router.get("/all/me")
def all_my_reviews(search: str = "", min_score: int = 0, max_score: int = 100,
                   language: str = "", current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    projects = sb.table("projects").select("id, project_name, language").eq("user_id", current_user["id"]).execute()
    project_ids = [p["id"] for p in projects.data]
    project_map = {p["id"]: p["project_name"] for p in projects.data}
    language_map = {p["id"]: p.get("language", "") for p in projects.data}
    if not project_ids:
        return []

    reviews = sb.table("reviews").select("id, project_id, review_score, summary, created_at").in_("project_id", project_ids).order("created_at", desc=True).execute()
    result = []
    for r in reviews.data:
        pname = project_map.get(r["project_id"], "")
        if search and search.lower() not in pname.lower() and search.lower() not in (r.get("summary") or "").lower():
            continue
        if r.get("review_score") is not None:
            if r["review_score"] < min_score or r["review_score"] > max_score:
                continue
        if language and language_map.get(r["project_id"], "").lower() != language.lower():
            continue
        result.append({**r, "project_name": pname})
    return result


@router.get("/project/{project_id}")
def get_reviews_for_project(project_id: int, current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    proj = sb.table("projects").select("id, project_name").eq("id", project_id).eq("user_id", current_user["id"]).execute()
    if not proj.data:
        raise HTTPException(status_code=404, detail="Project not found")
    reviews = sb.table("reviews").select("*").eq("project_id", project_id).order("created_at", desc=True).execute()
    return [_format_review(r, proj.data[0]["project_name"]) for r in reviews.data]


@router.get("/{review_id}")
def get_review(review_id: int, current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    review_res = sb.table("reviews").select("*").eq("id", review_id).execute()
    if not review_res.data:
        raise HTTPException(status_code=404, detail="Review not found")
    review = review_res.data[0]
    proj = sb.table("projects").select("id, project_name, file_content, language").eq("id", review["project_id"]).eq("user_id", current_user["id"]).execute()
    if not proj.data:
        raise HTTPException(status_code=403, detail="Forbidden")
    findings = sb.table("review_findings").select("*").eq("review_id", review_id).execute()
    return {
        **_format_review(review, proj.data[0]["project_name"]),
        "findings": findings.data,
        "code": proj.data[0].get("file_content"),
        "language": proj.data[0].get("language"),
    }


@router.delete("/{review_id}", status_code=204)
def delete_review(review_id: int, current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    review_res = sb.table("reviews").select("project_id").eq("id", review_id).execute()
    if not review_res.data:
        raise HTTPException(status_code=404, detail="Review not found")
    proj = sb.table("projects").select("id").eq("id", review_res.data[0]["project_id"]).eq("user_id", current_user["id"]).execute()
    if not proj.data:
        raise HTTPException(status_code=403, detail="Forbidden")
    sb.table("review_findings").delete().eq("review_id", review_id).execute()
    sb.table("reviews").delete().eq("id", review_id).execute()


@router.post("/{review_id}/rerun")
def rerun_review(review_id: int, background_tasks: BackgroundTasks,
                 body: dict = Body({}), current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    review_res = sb.table("reviews").select("project_id").eq("id", review_id).execute()
    if not review_res.data:
        raise HTTPException(status_code=404, detail="Review not found")
    project_id = review_res.data[0]["project_id"]
    proj = sb.table("projects").select("id").eq("id", project_id).eq("user_id", current_user["id"]).execute()
    if not proj.data:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Update code if provided
    new_code = body.get("code")
    if new_code:
        sb.table("projects").update({"file_content": new_code}).eq("id", project_id).execute()

    background_tasks.add_task(_run_full_review, project_id, current_user["id"])
    return {"message": "Re-review started", "project_id": project_id}


def _format_review(review: dict, project_name: str) -> dict:
    return {
        "id": review["id"],
        "project_id": review["project_id"],
        "project_name": project_name,
        "review_score": review.get("review_score"),
        "summary": review.get("summary"),
        "static_analysis": review.get("static_analysis"),
        "complexity_metrics": review.get("complexity_metrics"),
        "ai_review": review.get("ai_review"),
        "documentation": review.get("documentation"),
        "created_at": review.get("created_at"),
    }
