import subprocess
import json
import tempfile
import os


def run_bandit(code: str) -> dict:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        tmp_path = f.name

    try:
        result = subprocess.run(
            ["bandit", "-r", tmp_path, "-f", "json", "-q"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        data = {}
        try:
            data = json.loads(result.stdout) if result.stdout.strip() else {}
        except json.JSONDecodeError:
            pass

        issues = data.get("results", [])
        findings = []
        for issue in issues:
            findings.append({
                "severity": issue.get("issue_severity", "").lower(),
                "confidence": issue.get("issue_confidence", "").lower(),
                "issue": issue.get("issue_text", ""),
                "test_id": issue.get("test_id", ""),
                "test_name": issue.get("test_name", ""),
                "line": issue.get("line_number", 0),
                "code": issue.get("code", ""),
            })

        metrics = data.get("metrics", {})
        return {"findings": findings, "metrics": metrics}
    finally:
        os.unlink(tmp_path)
