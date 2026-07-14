from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from models.supabase_client import get_supabase
from utils.auth import get_current_user
from config import ALLOWED_EXTENSIONS, settings
from services.git_service import pull_repo, concat_files, RepoError
from pathlib import Path

router = APIRouter(prefix="/projects", tags=["projects"])


class SnippetRequest(BaseModel):
    project_name: str
    code: str
    language: str = "python"


class RepoRequest(BaseModel):
    repo_url: str
    project_name: str = ""
    branch: str = ""
    token: str = ""      # optional, for private repos


@router.post("/snippet", status_code=201)
def submit_snippet(body: SnippetRequest, current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("projects").insert({
        "user_id": current_user["id"],
        "project_name": body.project_name,
        "upload_type": "snippet",
        "file_content": body.code,
        "file_name": f"snippet.{body.language[:2]}",
        "language": body.language,
    }).execute()
    p = result.data[0]
    return {"id": p["id"], "project_name": p["project_name"], "upload_type": p["upload_type"]}


@router.post("/file", status_code=201)
async def submit_file(
    project_name: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")

    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")

    try:
        code = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be valid UTF-8 text")

    lang_map = {".py": "python", ".js": "javascript", ".ts": "typescript",
                ".jsx": "javascript", ".tsx": "typescript", ".java": "java",
                ".cpp": "cpp", ".c": "c", ".go": "go"}
    language = lang_map.get(suffix, "python")

    sb = get_supabase()
    result = sb.table("projects").insert({
        "user_id": current_user["id"],
        "project_name": project_name,
        "upload_type": "file",
        "file_content": code,
        "file_name": file.filename,
        "language": language,
    }).execute()
    p = result.data[0]
    return {"id": p["id"], "project_name": p["project_name"], "file_name": p["file_name"]}


@router.post("/repo", status_code=201)
def submit_repo(body: RepoRequest, current_user: dict = Depends(get_current_user)):
    """Pull a small public/private git repo and store it as a multi-file project."""
    try:
        result = pull_repo(body.repo_url, body.branch, body.token)
    except RepoError as e:
        raise HTTPException(status_code=400, detail=str(e))

    files = result["files"]
    name = body.project_name.strip() or body.repo_url.rstrip("/").split("/")[-1].removesuffix(".git")

    sb = get_supabase()
    project = sb.table("projects").insert({
        "user_id": current_user["id"],
        "project_name": name,
        "upload_type": "repo",
        "file_content": concat_files(files),   # whole-project blob for AI review
        "file_name": f"{len(files)} files",
        "language": result["language"],
        "repo_url": body.repo_url,
        "file_count": len(files),
    }).execute().data[0]

    sb.table("project_files").insert([
        {"project_id": project["id"], "path": f["path"],
         "content": f["content"], "language": f["language"]}
        for f in files
    ]).execute()

    return {
        "id": project["id"],
        "project_name": project["project_name"],
        "file_count": len(files),
        "truncated": result["truncated"],
        "skipped": result["skipped"],
    }


@router.get("/{project_id}/files")
def list_project_files(project_id: int, current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    proj = sb.table("projects").select("id").eq("id", project_id).eq("user_id", current_user["id"]).execute()
    if not proj.data:
        raise HTTPException(status_code=404, detail="Project not found")
    files = sb.table("project_files").select("id, path, language").eq("project_id", project_id).order("path").execute()
    return files.data or []


@router.get("/")
def list_projects(current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    projects = sb.table("projects").select("*").eq("user_id", current_user["id"]).order("created_at", desc=True).execute()
    result = []
    for p in projects.data:
        reviews = sb.table("reviews").select("id").eq("project_id", p["id"]).execute()
        result.append({**p, "review_count": len(reviews.data)})
    return result


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("projects").select("id").eq("id", project_id).eq("user_id", current_user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Project not found")
    sb.table("projects").delete().eq("id", project_id).execute()
