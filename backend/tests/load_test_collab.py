"""Load / stress test for the collaboration WebSocket relay (routes/collab.py).

Isolates relay performance: auth + Supabase membership are stubbed so we measure
the broadcast path only (the thing that must be low-latency / low-network).

Each "room" gets N clients. One publisher per room sends timestamped binary
frames; every other client in the room receives them (fan-out = N-1), matching
how y-websocket peers relay updates to each other. We record end-to-end delivery
latency, delivery ratio, throughput and connection setup time.

Run:  python tests/load_test_collab.py
"""
import asyncio
import statistics
import struct
import sys
import threading
import time

import uvicorn
import websockets
from fastapi import FastAPI

# --- stub out auth + membership so arbitrary clients may connect ---
import routes.collab as collab
collab._auth = lambda token: 1
collab._is_member = lambda workspace_id, user_id: True

app = FastAPI()
app.include_router(collab.router)

HOST, PORT = "127.0.0.1", 8899
STAMP = struct.Struct("<d")  # 8-byte send timestamp prefix


def start_server():
    config = uvicorn.Config(app, host=HOST, port=PORT, log_level="error", ws_ping_interval=None)
    server = uvicorn.Server(config)
    threading.Thread(target=server.run, daemon=True).start()
    while not server.started:
        time.sleep(0.05)
    return server


async def run_scenario(name, rooms, clients_per_room, msgs_per_pub, interval, payload_bytes):
    url = f"ws://{HOST}:{PORT}/ws/collab"
    pad = b"x" * max(0, payload_bytes - STAMP.size)
    latencies = []            # seconds, end-to-end delivery
    received = 0
    sent = 0
    conn_times = []
    subs_per_room = clients_per_room - 1
    expected = rooms * msgs_per_pub * subs_per_room

    async def client(room, is_pub):
        nonlocal received, sent
        t0 = time.perf_counter()
        ws = await websockets.connect(f"{url}/{room}?token=t", max_size=None)
        conn_times.append(time.perf_counter() - t0)
        try:
            if is_pub:
                await asyncio.sleep(0.2)  # let subscribers attach
                for _ in range(msgs_per_pub):
                    await ws.send(STAMP.pack(time.perf_counter()) + pad)
                    sent += 1
                    if interval:
                        await asyncio.sleep(interval)
                await asyncio.sleep(1.0)  # drain
            else:
                deadline = time.perf_counter() + msgs_per_pub * (interval or 0.001) + 5
                while received < expected and time.perf_counter() < deadline:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                    except asyncio.TimeoutError:
                        break
                    now = time.perf_counter()
                    latencies.append(now - STAMP.unpack(msg[:STAMP.size])[0])
                    received += 1
        finally:
            await ws.close()

    tasks = []
    for r in range(rooms):
        room = f"1:{r}"  # workspace_id 1, file r
        tasks.append(asyncio.create_task(client(room, is_pub=True)))
        for _ in range(subs_per_room):
            tasks.append(asyncio.create_task(client(room, is_pub=False)))

    t_start = time.perf_counter()
    await asyncio.gather(*tasks)
    wall = time.perf_counter() - t_start

    ms = sorted(l * 1000 for l in latencies)

    def pct(p):
        return ms[min(len(ms) - 1, int(len(ms) * p))] if ms else 0.0

    print(f"\n=== {name} ===")
    print(f"  rooms={rooms}  clients/room={clients_per_room}  "
          f"total_conns={rooms*clients_per_room}  payload={payload_bytes}B")
    print(f"  connections opened : {len(conn_times)}  "
          f"(setup avg {statistics.mean(conn_times)*1000:.1f}ms / max {max(conn_times)*1000:.1f}ms)")
    print(f"  frames published   : {sent}")
    print(f"  frames delivered   : {received} / {expected} expected "
          f"({(received/expected*100 if expected else 0):.1f}% delivery)")
    print(f"  wall time          : {wall:.2f}s   throughput {received/wall:.0f} msg/s")
    if ms:
        print(f"  delivery latency   : p50 {pct(0.50):.2f}ms  p95 {pct(0.95):.2f}ms  "
              f"p99 {pct(0.99):.2f}ms  max {ms[-1]:.2f}ms")
    return {"delivery": received / expected if expected else 0, "p95": pct(0.95)}


async def main():
    print(f"relay listening on ws://{HOST}:{PORT}")
    # 1) latency baseline: small fan-out, realistic typing cadence
    await run_scenario("latency: typing cadence", rooms=10, clients_per_room=3,
                       msgs_per_pub=50, interval=0.05, payload_bytes=64)
    # 2) fan-out: many peers per room (large team on one file)
    await run_scenario("fan-out: big room", rooms=3, clients_per_room=15,
                       msgs_per_pub=40, interval=0.02, payload_bytes=128)
    # 3) connection stress: hundreds of concurrent sockets
    await run_scenario("stress: many concurrent rooms", rooms=200, clients_per_room=3,
                       msgs_per_pub=20, interval=0.01, payload_bytes=128)
    # 4) burst throughput: no think-time, hammer the relay
    await run_scenario("burst: max throughput", rooms=20, clients_per_room=4,
                       msgs_per_pub=200, interval=0, payload_bytes=256)


if __name__ == "__main__":
    start_server()
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
