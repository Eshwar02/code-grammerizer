"""Load / stress test for the HTTP API (FastAPI routes).

Goal: measure routing + handler + serialization performance and surface
per-route lags/gaps — independent of the external Supabase network, which is
stubbed so results reflect the app's own overhead (the thing we control).

What's stubbed:
  * get_current_user  -> a fixed fake user (no JWT, no DB round-trip)
  * get_supabase      -> an in-memory fake that returns synthetic rows, so
                         handlers run their full logic (filtering, formatting,
                         JSON serialization) without touching the network.

Each scenario fires a fixed number of requests at a target route using a pool
of concurrent workers, then reports latency percentiles, throughput and errors.
Routes materially slower than the /health baseline are flagged as lag hotspots.

Run:  python tests/load_test_api.py           # default concurrency sweep
      python tests/load_test_api.py 100        # override peak concurrency
"""
import asyncio
import statistics
import sys
import threading
import time

import httpx
import uvicorn

# ---------------------------------------------------------------------------
# 1) Stub Supabase with an in-memory fake BEFORE the app imports it anywhere.
# ---------------------------------------------------------------------------
import models.supabase_client as sbmod

_NOW = "2026-07-15T00:00:00+00:00"
# Synthetic datasets sized like a heavy-but-realistic single user.
_PROJECTS = [
    {"id": i, "project_name": f"project-{i}", "language": "python",
     "upload_type": "repo" if i % 3 == 0 else "snippet", "file_count": i % 40,
     "user_id": 1}
    for i in range(1, 51)
]
_REVIEWS = [
    {"id": i, "project_id": (i % 50) + 1, "review_score": i % 101,
     "summary": f"summary for review {i} " * 3, "created_at": _NOW}
    for i in range(1, 201)
]
_USERS = [{"id": 1, "name": "Load Tester", "email": "load@test.dev", "created_at": _NOW}]


class _Result:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    """Chainable no-op query that returns a canned dataset for its table."""
    def __init__(self, rows):
        self._rows = rows

    # every builder method is a no-op that preserves the chain
    def __getattr__(self, _name):
        def _chain(*_a, **_k):
            return self
        return _chain

    def execute(self):
        return _Result(list(self._rows))


class _FakeSupabase:
    _tables = {"projects": _PROJECTS, "reviews": _REVIEWS, "users": _USERS}

    def table(self, name):
        return _FakeQuery(self._tables.get(name, []))


sbmod.get_supabase = lambda: _FakeSupabase()

# ---------------------------------------------------------------------------
# 2) Build the real app and override the auth dependency.
# ---------------------------------------------------------------------------
from app import app  # noqa: E402  (import after the stub is installed)
from utils.auth import get_current_user  # noqa: E402

app.dependency_overrides[get_current_user] = lambda: {
    "id": 1, "name": "Load Tester", "email": "load@test.dev", "created_at": _NOW,
}

HOST, PORT = "127.0.0.1", 8898
BASE = f"http://{HOST}:{PORT}"

# Routes to exercise. (label, method, path)
ROUTES = [
    ("health (framework baseline)", "GET", "/health"),
    ("reviews/all/me (dashboard)",  "GET", "/reviews/all/me"),
    ("reviews/all/me + filter",     "GET", "/reviews/all/me?search=review&min_score=40&max_score=90"),
    ("projects list",               "GET", "/projects/"),
    ("workspaces list",             "GET", "/workspaces/"),
]


def start_server():
    config = uvicorn.Config(app, host=HOST, port=PORT, log_level="error")
    server = uvicorn.Server(config)
    threading.Thread(target=server.run, daemon=True).start()
    while not server.started:
        time.sleep(0.05)
    return server


async def hammer(client, label, method, path, total, concurrency):
    latencies = []
    errors = 0
    statuses = {}
    sem = asyncio.Semaphore(concurrency)

    async def one():
        nonlocal errors
        async with sem:
            t0 = time.perf_counter()
            try:
                r = await client.request(method, BASE + path, timeout=30)
                statuses[r.status_code] = statuses.get(r.status_code, 0) + 1
                if r.status_code >= 500:
                    errors += 1
            except Exception:
                errors += 1
                return
            latencies.append((time.perf_counter() - t0) * 1000)

    t_start = time.perf_counter()
    await asyncio.gather(*(one() for _ in range(total)))
    wall = time.perf_counter() - t_start

    ms = sorted(latencies)

    def pct(p):
        return ms[min(len(ms) - 1, int(len(ms) * p))] if ms else 0.0

    rps = len(latencies) / wall if wall else 0
    print(f"\n  {label}")
    print(f"    requests {total} @ concurrency {concurrency}  ->  "
          f"{rps:,.0f} req/s   statuses {statuses}   errors {errors}")
    if ms:
        print(f"    latency  p50 {pct(.50):6.2f}ms  p95 {pct(.95):6.2f}ms  "
              f"p99 {pct(.99):6.2f}ms  max {ms[-1]:6.2f}ms")
    return {"label": label, "p50": pct(.50), "p95": pct(.95), "p99": pct(.99),
            "rps": rps, "errors": errors, "n": len(ms)}


async def scenario(client, title, total, concurrency):
    print(f"\n=== {title}  (total={total}, concurrency={concurrency}) ===")
    rows = []
    for label, method, path in ROUTES:
        rows.append(await hammer(client, label, method, path, total, concurrency))
    return rows


async def main(peak):
    async with httpx.AsyncClient() as client:
        # warm each route once (JIT-free Python, but primes connections/caches)
        for _, m, p in ROUTES:
            try:
                await client.request(m, BASE + p, timeout=30)
            except Exception:
                pass

        await scenario(client, "baseline: light load", total=200, concurrency=10)
        await scenario(client, "sustained: moderate load", total=1000, concurrency=50)
        final = await scenario(client, f"stress: peak load", total=2000, concurrency=peak)

    # ---- routing lag / gap analysis vs the framework baseline ----
    base = next((r for r in final if r["label"].startswith("health")), None)
    print("\n=== routing lag analysis (stress tier, vs /health baseline) ===")
    if base and base["p95"]:
        for r in final:
            if r is base:
                continue
            factor = r["p95"] / base["p95"] if base["p95"] else 0
            flag = "  <-- LAG HOTSPOT" if factor >= 3 else ""
            print(f"  {r['label']:<32} p95 {r['p95']:7.2f}ms  "
                  f"({factor:4.1f}x baseline){flag}")
        print(f"\n  baseline /health p95 = {base['p95']:.2f}ms  "
              f"(pure routing+middleware overhead)")
    if any(r["errors"] for r in final):
        print("\n  WARNING: 5xx errors observed under peak load — see per-route rows above.")


if __name__ == "__main__":
    peak = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    start_server()
    try:
        asyncio.run(main(peak))
    except KeyboardInterrupt:
        sys.exit(0)
