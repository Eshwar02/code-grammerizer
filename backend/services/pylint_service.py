import subprocess
import json
import tempfile
import os
from pathlib import Path


def run_pylint(code: str, filename: str = "code.py") -> dict:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        tmp_path = f.name

    try:
        result = subprocess.run(
            ["pylint", tmp_path, "--output-format=json", "--score=yes"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        messages = []
        score = 0.0
        try:
            messages = json.loads(result.stdout) if result.stdout.strip() else []
        except json.JSONDecodeError:
            pass

        for line in result.stderr.splitlines():
            if "Your code has been rated at" in line:
                try:
                    score = float(line.split("at ")[1].split("/")[0])
                except (IndexError, ValueError):
                    pass

        findings = []
        for msg in messages:
            findings.append({
                "type": msg.get("type", ""),
                "symbol": msg.get("symbol", ""),
                "message": msg.get("message", ""),
                "line": msg.get("line", 0),
                "column": msg.get("column", 0),
                "severity": _map_severity(msg.get("type", "")),
            })

        return {"score": score, "findings": findings, "raw": result.stdout}
    finally:
        os.unlink(tmp_path)


def _map_severity(pylint_type: str) -> str:
    return {
        "error": "high",
        "fatal": "high",
        "warning": "medium",
        "convention": "low",
        "refactor": "low",
    }.get(pylint_type, "info")
