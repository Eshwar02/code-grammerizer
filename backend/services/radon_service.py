import subprocess
import json
import tempfile
import os


def run_radon(code: str) -> dict:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        tmp_path = f.name

    try:
        cc_result = subprocess.run(
            ["radon", "cc", tmp_path, "-j", "-s"],
            capture_output=True, text=True, timeout=30,
        )
        mi_result = subprocess.run(
            ["radon", "mi", tmp_path, "-j"],
            capture_output=True, text=True, timeout=30,
        )
        raw_result = subprocess.run(
            ["radon", "raw", tmp_path, "-j"],
            capture_output=True, text=True, timeout=30,
        )

        cc_data = {}
        mi_data = {}
        raw_data = {}
        try:
            cc_data = json.loads(cc_result.stdout) if cc_result.stdout.strip() else {}
            mi_data = json.loads(mi_result.stdout) if mi_result.stdout.strip() else {}
            raw_data = json.loads(raw_result.stdout) if raw_result.stdout.strip() else {}
        except json.JSONDecodeError:
            pass

        functions = []
        total_complexity = 0
        count = 0
        for file_data in cc_data.values():
            for block in file_data:
                functions.append({
                    "name": block.get("name", ""),
                    "type": block.get("type", ""),
                    "complexity": block.get("complexity", 0),
                    "rank": block.get("rank", ""),
                    "line": block.get("lineno", 0),
                })
                total_complexity += block.get("complexity", 0)
                count += 1

        avg_complexity = round(total_complexity / count, 2) if count else 0

        mi_score = None
        for val in mi_data.values():
            if isinstance(val, dict):
                mi_score = val.get("mi", None)
                break

        raw_metrics = {}
        for val in raw_data.values():
            if isinstance(val, dict):
                raw_metrics = val
                break

        fn_only = [f for f in functions if f["type"] in ("function", "method")]
        sloc = raw_metrics.get("sloc", 0)
        avg_fn_length = round(sloc / len(fn_only), 1) if fn_only else 0

        return {
            "cyclomatic_complexity": avg_complexity,
            "maintainability_index": mi_score,
            "functions": functions,
            "loc": raw_metrics.get("loc", 0),
            "sloc": sloc,
            "comments": raw_metrics.get("comments", 0),
            "num_classes": sum(1 for f in functions if f["type"] == "class"),
            "num_functions": len(fn_only),
            "avg_function_length": avg_fn_length,
        }
    finally:
        os.unlink(tmp_path)
