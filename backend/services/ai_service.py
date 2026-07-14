"""Multi-provider AI layer.

Routing (per project spec):
  - Codestral (Mistral)   -> writing code: suggest_code, documentation
  - gpt-oss  (Cerebras)   -> analysis:     review, profile insights
  - Groq                  -> automatic fallback if the primary provider errors

Mistral + Groq are OpenAI-compatible (plain httpx). Cerebras uses its SDK.
No OpenAI. Missing keys just mean that provider is skipped in the fallback chain.
"""
import json

import httpx
from cerebras.cloud.sdk import Cerebras

from config import settings

# ---- provider model ids ----
CEREBRAS_MODEL = "gpt-oss-120b"
MISTRAL_MODEL = "codestral-latest"
GROQ_MODEL = "llama-3.3-70b-versatile"

REASONING_EFFORT = "low"  # gpt-oss reasoning; keep light so tokens go to JSON

# Max source chars sent to a model in one call (~4 chars/token). Guards against
# oversized multi-file repo blobs (Groq rejects big payloads with HTTP 413).
MAX_INPUT_CHARS = 40_000


def _clip(code: str) -> str:
    if len(code) <= MAX_INPUT_CHARS:
        return code
    return code[:MAX_INPUT_CHARS] + "\n\n# ... [truncated for review — project exceeds size budget] ..."

_cerebras = Cerebras(api_key=settings.cerebras_api_key) if settings.cerebras_api_key else None


# ---------- provider callers (each returns raw string or raises) ----------
def _call_cerebras(system: str, user: str, max_tokens: int) -> str:
    if not _cerebras:
        raise RuntimeError("Cerebras key not configured")
    resp = _cerebras.chat.completions.create(
        model=CEREBRAS_MODEL,
        reasoning_effort=REASONING_EFFORT,
        max_tokens=max_tokens,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
    )
    return resp.choices[0].message.content


def _openai_compatible(base_url: str, key: str, model: str,
                       system: str, user: str, max_tokens: int) -> str:
    if not key:
        raise RuntimeError(f"{base_url} key not configured")
    r = httpx.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "max_tokens": max_tokens,
            "temperature": 0.2,
            "messages": [{"role": "system", "content": system},
                         {"role": "user", "content": user}],
        },
        timeout=90,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def _call_mistral(system: str, user: str, max_tokens: int) -> str:
    return _openai_compatible("https://api.mistral.ai/v1", settings.mistral_api_key,
                              MISTRAL_MODEL, system, user, max_tokens)


def _call_groq(system: str, user: str, max_tokens: int) -> str:
    return _openai_compatible("https://api.groq.com/openai/v1", settings.groq_api_key,
                              GROQ_MODEL, system, user, max_tokens)


# provider name -> caller
_PROVIDERS = {
    "codestral": _call_mistral,
    "gpt-oss": _call_cerebras,
    "groq": _call_groq,
}


def _chat(primary: str, system: str, user: str, max_tokens: int) -> dict:
    """Try `primary`, then Groq, then any other configured provider.

    Falling through *every* provider (not just Groq) means a single missing key
    never breaks a feature as long as one provider is configured — e.g. if
    Mistral + Groq keys are absent, code-writing calls still fall back to gpt-oss.
    """
    chain = [primary, "groq"] + [p for p in _PROVIDERS if p not in (primary, "groq")]
    last_err = None
    for name in dict.fromkeys(chain):  # preserve order, drop dups
        try:
            raw = _PROVIDERS[name](system, user, max_tokens)
            return _parse_json(raw)
        except Exception as e:  # noqa: BLE001 - fall through to next provider
            last_err = e
            continue
    return {"error": f"All AI providers failed: {last_err}"}


# ---------- prompts ----------
REVIEW_PROMPT = """You are a Senior Software Engineer conducting a thorough code review.

Analyze the provided code and return a JSON object with this exact structure:
{
  "score": <integer 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "time_complexity": "<Big-O time complexity, e.g. O(n log n)>",
  "space_complexity": "<Big-O space complexity, e.g. O(n)>",
  "complexity_explanation": "<Brief explanation of the complexity analysis>",
  "bugs": [{"issue": "...", "line": <int or null>, "suggestion": "..."}],
  "security_issues": [{"issue": "...", "severity": "high|medium|low", "line": <int or null>, "suggestion": "..."}],
  "code_smells": [{"issue": "...", "line": <int or null>, "suggestion": "..."}],
  "performance": [{"issue": "...", "line": <int or null>, "suggestion": "..."}],
  "best_practices": [{"issue": "...", "suggestion": "..."}],
  "naming_suggestions": [{"original": "...", "suggested": "...", "reason": "..."}],
  "refactoring": [{"description": "...", "benefit": "..."}],
  "improvements_summary": "<concise top 3 improvements>"
}

If the input contains multiple files (marked by "# ===== FILE: path ====="),
review the project as a whole and mention the file path inside each issue's text.
Return only valid JSON. No markdown fences, no extra text."""

FIX_PROMPT = """You are an expert software engineer. You are given source code and a list of
issues found during code review. Analyze the code's structure, then rewrite it to FIX the
reported bugs and issues while preserving behavior and public interfaces.

Rules:
- Fix real bugs, security issues, and correctness problems first.
- Keep the code runnable and self-consistent; do not leave TODOs or placeholders.
- Preserve the original language, style, and formatting conventions.
- If the input contains multiple files (marked "# ===== FILE: path ====="), keep that same
  file-marker layout in the fixed output so each file stays identifiable.

Return only valid JSON, no markdown fences:
{
  "fixed_code": "<the full corrected code as a string>",
  "changes": [{"issue": "<what was wrong>", "fix": "<what you changed>", "line": <int or null>}],
  "summary": "<2-3 sentence summary of the fixes>",
  "unresolved": ["<any issue you could not safely fix, or empty>"]
}"""

SUGGEST_PROMPT = """You are an expert code optimizer. Given source code, return an improved version with a JSON response:
{
  "improved_code": "<the full improved code as a string>",
  "changes": [{"line": <int>, "original": "...", "suggested": "...", "reason": "..."}],
  "time_complexity": "<Big-O>",
  "space_complexity": "<Big-O>",
  "summary": "<what was improved>"
}
Return only valid JSON. No markdown fences."""

DOC_PROMPT = """You are a documentation expert. Generate documentation for the provided code.

Return JSON:
{
  "functions": [{"name": "...", "signature": "...", "description": "...", "params": [], "returns": "..."}],
  "classes": [{"name": "...", "description": "...", "methods": []}],
  "module_summary": "...",
  "readme_snippet": "..."
}

Return only valid JSON."""

PROFILE_PROMPT = """You are an encouraging coding coach. Given a user's code review statistics, generate a motivational insight.

Return JSON:
{
  "level": "<skill level: Beginner/Intermediate/Advanced/Expert>",
  "encouragement": "<2-3 sentence personalized encouragement based on their stats>",
  "quote": "<an inspiring programming or coding quote with attribution>",
  "tip": "<one specific actionable coding tip based on their performance>"
}

Return only valid JSON."""


def _parse_json(raw: str) -> dict:
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(raw[start:end])
            except json.JSONDecodeError:
                pass
        return {"error": "Failed to parse response", "raw": raw[:500]}


# ---------- public API (routing baked in) ----------
def ai_review_code(code: str, language: str = "python") -> dict:
    user = f"Language: {language}\n\nCode:\n```{language}\n{_clip(code)}\n```"
    return _chat("gpt-oss", REVIEW_PROMPT, user, 4096)


def suggest_code(code: str, language: str = "python", focus: str = "") -> dict:
    focus_text = f"\nFocus on: {focus}" if focus else ""
    user = f"Language: {language}{focus_text}\n\nCode:\n```{language}\n{_clip(code)}\n```"
    return _chat("codestral", SUGGEST_PROMPT, user, 4096)


def fix_code(code: str, language: str = "python", issues: str = "") -> dict:
    issues_text = f"\n\nReported issues to fix:\n{issues}" if issues.strip() else ""
    user = f"Language: {language}{issues_text}\n\nCode:\n```{language}\n{_clip(code)}\n```"
    return _chat("codestral", FIX_PROMPT, user, 4096)


def generate_documentation(code: str, language: str = "python") -> dict:
    user = f"Language: {language}\n\nCode:\n```{language}\n{_clip(code)}\n```"
    return _chat("codestral", DOC_PROMPT, user, 2048)


def generate_profile_insight(stats: dict) -> dict:
    return _chat("gpt-oss", PROFILE_PROMPT, f"User stats: {json.dumps(stats)}", 1500)
