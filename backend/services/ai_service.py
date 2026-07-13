import json
from cerebras.cloud.sdk import Cerebras
from config import settings

client = Cerebras(api_key=settings.cerebras_api_key)

MODEL = "llama-3.3-70b"

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

Return only valid JSON. No markdown fences, no extra text."""

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


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(raw[start:end])
        return {"error": "Failed to parse response", "raw": raw[:500]}


def ai_review_code(code: str, language: str = "python") -> dict:
    resp = client.chat.completions.create(
        model=MODEL,
        max_tokens=4096,
        messages=[
            {"role": "system", "content": REVIEW_PROMPT},
            {"role": "user", "content": f"Language: {language}\n\nCode:\n```{language}\n{code}\n```"},
        ],
    )
    return _parse_json(resp.choices[0].message.content)


def suggest_code(code: str, language: str = "python", focus: str = "") -> dict:
    focus_text = f"\nFocus on: {focus}" if focus else ""
    resp = client.chat.completions.create(
        model=MODEL,
        max_tokens=4096,
        messages=[
            {"role": "system", "content": SUGGEST_PROMPT},
            {"role": "user", "content": f"Language: {language}{focus_text}\n\nCode:\n```{language}\n{code}\n```"},
        ],
    )
    return _parse_json(resp.choices[0].message.content)


def generate_documentation(code: str, language: str = "python") -> dict:
    resp = client.chat.completions.create(
        model=MODEL,
        max_tokens=2048,
        messages=[
            {"role": "system", "content": DOC_PROMPT},
            {"role": "user", "content": f"Language: {language}\n\nCode:\n```{language}\n{code}\n```"},
        ],
    )
    return _parse_json(resp.choices[0].message.content)


PROFILE_PROMPT = """You are an encouraging coding coach. Given a user's code review statistics, generate a motivational insight.

Return JSON:
{
  "level": "<skill level: Beginner/Intermediate/Advanced/Expert>",
  "encouragement": "<2-3 sentence personalized encouragement based on their stats>",
  "quote": "<an inspiring programming or coding quote with attribution>",
  "tip": "<one specific actionable coding tip based on their performance>"
}

Return only valid JSON."""

def generate_profile_insight(stats: dict) -> dict:
    resp = client.chat.completions.create(
        model=MODEL,
        max_tokens=512,
        messages=[
            {"role": "system", "content": PROFILE_PROMPT},
            {"role": "user", "content": f"User stats: {json.dumps(stats)}"},
        ],
    )
    return _parse_json(resp.choices[0].message.content)
