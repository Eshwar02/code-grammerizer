import ast
import subprocess
import tempfile
import json
import os


def live_lint_python(code: str) -> list[dict]:
    findings = []

    # 1. Syntax check via ast (instant)
    try:
        ast.parse(code)
    except SyntaxError as e:
        findings.append({
            "line": e.lineno or 1,
            "col": e.offset or 0,
            "severity": "error",
            "symbol": "syntax-error",
            "message": str(e.msg),
            "source": "syntax",
        })
        return findings  # syntax error blocks further analysis

    # 2. Pylint errors + warnings only (fast subset)
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        tmp = f.name
    try:
        result = subprocess.run(
            [
                "pylint", tmp,
                "--output-format=json",
                "--disable=all",
                "--enable=E,W,C0301,C0303,C0114,C0116",
                "--score=no",
            ],
            capture_output=True,
            text=True,
            timeout=8,
        )
        try:
            messages = json.loads(result.stdout) if result.stdout.strip() else []
        except json.JSONDecodeError:
            messages = []

        for m in messages:
            sev = m.get("type", "")
            findings.append({
                "line": m.get("line", 0),
                "col": m.get("column", 0),
                "severity": "error" if sev in ("error", "fatal") else "warning" if sev == "warning" else "info",
                "symbol": m.get("symbol", ""),
                "message": m.get("message", ""),
                "source": "pylint",
            })
    except subprocess.TimeoutExpired:
        pass
    finally:
        os.unlink(tmp)

    return findings


def live_lint(code: str, language: str) -> list[dict]:
    if language == "python":
        return live_lint_python(code)
    # For other languages: basic line-length check only
    findings = []
    for i, line in enumerate(code.splitlines(), 1):
        if len(line) > 120:
            findings.append({
                "line": i, "col": 120, "severity": "info",
                "symbol": "line-too-long",
                "message": f"Line too long ({len(line)} > 120 chars)",
                "source": "basic",
            })
    return findings
