import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from models.supabase_client import get_supabase
from utils.auth import get_current_user

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


# ---------- request bodies ----------
class CreateWorkspace(BaseModel):
    name: str


class InviteBody(BaseModel):
    email: EmailStr
    role: str = "editor"


class JoinBody(BaseModel):
    code: str


class CreateFile(BaseModel):
    name: str
    language: str = "python"
    content: str = ""


class SaveFile(BaseModel):
    ydoc_snapshot: str = ""
    content: str = ""


# ---------- helpers ----------
def _member(sb, workspace_id: int, user_id: int):
    r = (sb.table("workspace_members").select("*")
         .eq("workspace_id", workspace_id).eq("user_id", user_id).execute())
    return r.data[0] if r.data else None


def _require_member(sb, workspace_id: int, user: dict):
    m = _member(sb, workspace_id, user["id"])
    if not m:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
    return m


def _resolve_invites(sb, user: dict):
    """Turn any pending email invites for this user into real memberships."""
    inv = (sb.table("workspace_invites").select("*")
           .eq("email", user["email"]).eq("accepted", False).execute())
    for i in (inv.data or []):
        if not _member(sb, i["workspace_id"], user["id"]):
            sb.table("workspace_members").insert({
                "workspace_id": i["workspace_id"],
                "user_id": user["id"],
                "role": i.get("role", "editor"),
            }).execute()
        sb.table("workspace_invites").update({"accepted": True}).eq("id", i["id"]).execute()


# ---------- workspaces ----------
@router.post("/", status_code=201)
def create_workspace(body: CreateWorkspace, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    ws = sb.table("workspaces").insert({
        "name": body.name,
        "owner_id": user["id"],
        "share_code": secrets.token_urlsafe(9),
    }).execute().data[0]
    sb.table("workspace_members").insert({
        "workspace_id": ws["id"], "user_id": user["id"], "role": "owner",
    }).execute()
    return ws


@router.get("/")
def list_workspaces(user: dict = Depends(get_current_user)):
    sb = get_supabase()
    _resolve_invites(sb, user)
    mem = sb.table("workspace_members").select("workspace_id, role").eq("user_id", user["id"]).execute()
    ids = [m["workspace_id"] for m in (mem.data or [])]
    if not ids:
        return []
    roles = {m["workspace_id"]: m["role"] for m in mem.data}
    ws = sb.table("workspaces").select("*").in_("id", ids).order("created_at", desc=True).execute()
    return [{**w, "role": roles.get(w["id"])} for w in (ws.data or [])]


@router.get("/{workspace_id}")
def get_workspace(workspace_id: int, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    me = _require_member(sb, workspace_id, user)
    ws = sb.table("workspaces").select("*").eq("id", workspace_id).execute()
    if not ws.data:
        raise HTTPException(status_code=404, detail="Workspace not found")
    members = sb.table("workspace_members").select("user_id, role").eq("workspace_id", workspace_id).execute()
    uids = [m["user_id"] for m in (members.data or [])]
    users = sb.table("users").select("id, name, email").in_("id", uids).execute() if uids else None
    umap = {u["id"]: u for u in (users.data if users else [])}
    member_list = [{"role": m["role"], **umap.get(m["user_id"], {"id": m["user_id"]})} for m in members.data]
    files = (sb.table("workspace_files").select("id, name, language, updated_at")
             .eq("workspace_id", workspace_id).order("created_at").execute())
    return {**ws.data[0], "role": me["role"], "members": member_list, "files": files.data or []}


@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: int, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    m = _require_member(sb, workspace_id, user)
    if m["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can delete")
    sb.table("workspaces").delete().eq("id", workspace_id).execute()
    return {"message": "deleted"}


# ---------- membership: invites + share link ----------
@router.post("/{workspace_id}/invite")
def invite(workspace_id: int, body: InviteBody, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    m = _require_member(sb, workspace_id, user)
    if m["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can invite")
    # existing user -> add directly, else store pending invite
    existing = sb.table("users").select("id").eq("email", body.email).execute()
    if existing.data:
        uid = existing.data[0]["id"]
        if not _member(sb, workspace_id, uid):
            sb.table("workspace_members").insert({
                "workspace_id": workspace_id, "user_id": uid, "role": body.role,
            }).execute()
        return {"status": "added"}
    sb.table("workspace_invites").insert({
        "workspace_id": workspace_id, "email": body.email,
        "role": body.role, "invited_by": user["id"],
    }).execute()
    return {"status": "invited"}


@router.delete("/{workspace_id}/members/{member_id}")
def remove_member(workspace_id: int, member_id: int, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    m = _require_member(sb, workspace_id, user)
    if m["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can remove members")
    sb.table("workspace_members").delete().eq("workspace_id", workspace_id).eq("user_id", member_id).execute()
    return {"message": "removed"}


@router.post("/{workspace_id}/share")
def toggle_share(workspace_id: int, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    m = _require_member(sb, workspace_id, user)
    if m["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can change sharing")
    ws = sb.table("workspaces").select("share_enabled").eq("id", workspace_id).execute().data[0]
    updated = sb.table("workspaces").update({
        "share_enabled": not ws["share_enabled"],
        "share_code": secrets.token_urlsafe(9),
    }).eq("id", workspace_id).execute().data[0]
    return updated


@router.post("/join")
def join(body: JoinBody, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    ws = sb.table("workspaces").select("id, share_enabled").eq("share_code", body.code).execute()
    if not ws.data:
        raise HTTPException(status_code=404, detail="Invalid invite link")
    ws = ws.data[0]
    if not ws["share_enabled"]:
        raise HTTPException(status_code=403, detail="Sharing is disabled for this workspace")
    if not _member(sb, ws["id"], user["id"]):
        sb.table("workspace_members").insert({
            "workspace_id": ws["id"], "user_id": user["id"], "role": "editor",
        }).execute()
    return {"workspace_id": ws["id"]}


# ---------- files ----------
@router.post("/{workspace_id}/files", status_code=201)
def create_file(workspace_id: int, body: CreateFile, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    _require_member(sb, workspace_id, user)
    f = sb.table("workspace_files").insert({
        "workspace_id": workspace_id, "name": body.name,
        "language": body.language, "content": body.content,
    }).execute().data[0]
    return f


@router.get("/{workspace_id}/files/{file_id}")
def get_file(workspace_id: int, file_id: int, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    _require_member(sb, workspace_id, user)
    f = sb.table("workspace_files").select("*").eq("id", file_id).eq("workspace_id", workspace_id).execute()
    if not f.data:
        raise HTTPException(status_code=404, detail="File not found")
    return f.data[0]


@router.put("/{workspace_id}/files/{file_id}")
def save_file(workspace_id: int, file_id: int, body: SaveFile, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    m = _require_member(sb, workspace_id, user)
    if m["role"] == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot edit")

    prev = sb.table("workspace_files").select("content, name").eq("id", file_id).eq("workspace_id", workspace_id).execute()
    old = prev.data[0]["content"] if prev.data else ""
    fname = prev.data[0]["name"] if prev.data else None

    sb.table("workspace_files").update({
        "ydoc_snapshot": body.ydoc_snapshot, "content": body.content, "updated_at": "now()",
    }).eq("id", file_id).eq("workspace_id", workspace_id).execute()

    # Change log with username. Only record real edits (skip no-op saves).
    delta = len(body.content) - len(old or "")
    if delta != 0:
        added = max(delta, 0)
        removed = max(-delta, 0)
        lines = abs((body.content.count("\n")) - ((old or "").count("\n")))
        sb.table("workspace_changes").insert({
            "workspace_id": workspace_id, "file_id": file_id,
            "user_id": user["id"], "user_name": user["name"], "file_name": fname,
            "summary": f"+{added} / -{removed} chars, {lines} line(s)",
            "chars_added": added, "chars_removed": removed,
        }).execute()
    return {"message": "saved"}


@router.get("/{workspace_id}/changes")
def list_changes(workspace_id: int, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    _require_member(sb, workspace_id, user)
    r = (sb.table("workspace_changes").select("*")
         .eq("workspace_id", workspace_id)
         .order("created_at", desc=True).limit(100).execute())
    return r.data or []


@router.delete("/{workspace_id}/files/{file_id}")
def delete_file(workspace_id: int, file_id: int, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    m = _require_member(sb, workspace_id, user)
    if m["role"] == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot edit")
    sb.table("workspace_files").delete().eq("id", file_id).eq("workspace_id", workspace_id).execute()
    return {"message": "deleted"}
