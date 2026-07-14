"""Shallow-clone a small git repo and pull out reviewable source files.

Public repos need no auth. Private repos use settings.github_token (or a token
passed per-request), injected into the clone URL. Everything runs in a temp dir
that is always cleaned up.
"""
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from config import (
    ALLOWED_EXTENSIONS,
    REPO_MAX_FILES,
    REPO_MAX_FILE_BYTES,
    REPO_MAX_TOTAL_BYTES,
    REPO_SKIP_DIRS,
    settings,
)

LANG_MAP = {
    ".py": "python", ".js": "javascript", ".ts": "typescript",
    ".jsx": "javascript", ".tsx": "typescript", ".java": "java",
    ".cpp": "cpp", ".c": "c", ".go": "go",
}

_URL_RE = re.compile(r"^https?://[\w.-]+/[\w.-]+/[\w.-]+?(?:\.git)?/?$")


class RepoError(Exception):
    pass


def _auth_url(url: str, token: str) -> str:
    """Inject a token into an https git URL for private repos."""
    if token and url.startswith("https://") and "@" not in url.split("//", 1)[1]:
        return url.replace("https://", f"https://{token}@", 1)
    return url


def _dominant_language(files: list[dict]) -> str:
    if not files:
        return "python"
    counts: dict[str, int] = {}
    for f in files:
        counts[f["language"]] = counts.get(f["language"], 0) + 1
    return max(counts, key=counts.get)


def pull_repo(repo_url: str, branch: str = "", token: str = "") -> dict:
    """Clone `repo_url` (shallow) and return filtered source files.

    Returns: {files: [{path, content, language}], language, truncated, skipped}
    Raises RepoError on bad URL / clone failure / no reviewable files.
    """
    repo_url = (repo_url or "").strip()
    if not _URL_RE.match(repo_url):
        raise RepoError("Invalid repo URL. Use an https git URL, e.g. https://github.com/user/repo")

    token = token or settings.github_token
    tmp = tempfile.mkdtemp(prefix="repopull_")
    try:
        cmd = ["git", "clone", "--depth", "1", "--single-branch"]
        if branch:
            cmd += ["--branch", branch]
        cmd += [_auth_url(repo_url, token), tmp]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        if proc.returncode != 0:
            err = (proc.stderr or "clone failed").strip().splitlines()[-1]
            # never leak an injected token back to the client
            if token:
                err = err.replace(token, "***")
            raise RepoError(f"git clone failed: {err}")

        root = Path(tmp)
        picked: list[dict] = []
        total = 0
        truncated = False
        skipped = 0

        for p in sorted(root.rglob("*")):
            if not p.is_file():
                continue
            rel = p.relative_to(root)
            if any(part in REPO_SKIP_DIRS for part in rel.parts):
                continue
            if p.suffix.lower() not in ALLOWED_EXTENSIONS:
                continue
            size = p.stat().st_size
            if size == 0 or size > REPO_MAX_FILE_BYTES:
                skipped += 1
                continue
            if len(picked) >= REPO_MAX_FILES or total + size > REPO_MAX_TOTAL_BYTES:
                truncated = True
                break
            try:
                content = p.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                skipped += 1
                continue
            picked.append({
                "path": str(rel),
                "content": content,
                "language": LANG_MAP.get(p.suffix.lower(), "python"),
            })
            total += size

        if not picked:
            raise RepoError("No reviewable source files found (checked .py/.js/.ts/.java/.cpp/.c/.go).")

        return {
            "files": picked,
            "language": _dominant_language(picked),
            "truncated": truncated,
            "skipped": skipped,
        }
    except subprocess.TimeoutExpired:
        raise RepoError("Clone timed out — repo too large for a small-project pull.")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def concat_files(files: list[dict]) -> str:
    """Join files into one blob with path markers for whole-project AI review."""
    parts = []
    for f in files:
        parts.append(f"# ===== FILE: {f['path']} =====\n{f['content']}")
    return "\n\n".join(parts)
