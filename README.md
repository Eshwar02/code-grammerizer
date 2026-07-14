<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=32&pause=1000&color=4361EE&center=true&vCenter=true&width=650&lines=Code-Grammerizer+%F0%9F%A7%A0;AI+Code+Review+%2B+Live+Collaboration;Analyze.+Collaborate.+Ship." alt="Typing SVG" />

<br/>

**AI-powered code review meets real-time, multiplayer coding.**
Catch bugs, security holes, and complexity in seconds — then fix them *together*, live, with your team.

<br/>

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://code-grammerizer.vercel.app)
[![Backend](https://img.shields.io/badge/API-Render-46E3B7?style=for-the-badge&logo=render)](https://code-grammerizer-api.onrender.com/health)
[![Database](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![AI](https://img.shields.io/badge/AI-Multi--Provider-FF6B6B?style=for-the-badge&logo=lightning)](#-multi-provider-ai--model-routing)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](#-license)

</div>

---

## 🚩 The Problem

Code review is slow, solo, and disconnected from where code actually gets written. You paste code into a tool, get feedback, then context-switch back to your editor to fix it — alone. Teams reviewing the same code juggle screen-shares and stale copies.

**Code-Grammerizer** closes that loop: instant AI + static analysis **and** a shared, low-latency collaborative editor where a whole team edits the same file at once — every keystroke synced, every change logged.

---

## ✨ What's Inside

<table>
<tr>
<td width="50%">

### 👥 Real-Time Team Collaboration `NEW`
- **Isolated team workspaces** — private rooms per team
- **Multiplayer editing** — 2+ users, one file, live
- **Live cursors** with per-user color + name label
- **Presence** avatars of everyone in the room
- **Change history** — every edit logged with username
- **Invite by email** (roles: owner / editor / viewer) **or share link**

</td>
<td width="50%">

### 🤖 AI-Powered Review
- Bug detection & fix suggestions
- Security vulnerability scanning
- Performance & complexity insights
- Code smell + naming/refactor advice
- Auto-generated documentation
- Inline AI code suggestions
- **Multi-provider AI** with automatic fallback

</td>
</tr>
<tr>
<td>

### 🔬 Static Analysis
- **Pylint** — quality & style
- **Bandit** — security scanning
- **Radon** — cyclomatic complexity, maintainability index, function length

</td>
<td>

### 📄 Reports & Dashboard
- Full / Executive / Security / Complexity **PDFs**
- Markdown & HTML export
- Search, score-filter, and manage all past reviews

</td>
</tr>
<tr>
<td>

### 🖊️ Live Code Editor
- Monaco (VSCode-grade) engine
- Live lint as you type
- Edit reviewed code & re-run analysis
- One-click **"Collaborate"** → spin up a live room from any review

</td>
<td>

### 🔐 Secure by Default
- JWT auth
- **Row-Level Security** on every table
- Backend-only `service_role` access; anon key locked out
- Per-workspace membership enforced server-side

</td>
</tr>
<tr>
<td>

### 📦 Pull a Git Repo `NEW`
- Review a **small project straight from its Git URL** — no zip, no copy-paste
- Shallow clone, source-file filtering, whole-project AI review
- Works **solo** (personal projects) **or team** (import into a collaborative workspace)
- **Public repos need no auth** — paste any URL; optional token for private repos

</td>
<td>

</td>
</tr>
</table>

---

## ⚡ How Real-Time Collaboration Works

Built for **low latency and low bandwidth** — the two things that make or break a collaborative editor.

```
 Browser A ─┐                                   ┌─ Browser B
 (Monaco +  │   binary CRDT deltas over WS      │   Monaco +
  Yjs +     ├──────────►  FastAPI  ◄────────────┤   Yjs +
  IndexedDB)│         (stateless relay)         │   IndexedDB)
            │                                    │
            └────►  Supabase (snapshot + change log)  ◄────┘
```

| Design choice | Why it matters |
|---|---|
| **Yjs CRDT** | Edits apply locally first, then merge conflict-free — no lag, no lost keystrokes |
| **Binary delta sync** | Only the *diff* crosses the wire, not the whole file → tiny payloads |
| **Stateless WebSocket relay** | FastAPI just broadcasts deltas between peers — no heavy server-side doc state, trivial to scale |
| **IndexedDB cache (`y-indexeddb`)** | Reopening a file loads instantly from local cache, offline-first |
| **Supabase snapshots** | Debounced autosave persists the CRDT state + a per-edit change log with username |

### 📈 Load & stress tested

Relay benchmarked with a concurrent WebSocket harness (`backend/tests/load_test_collab.py`):

| Scenario | Connections | Delivery | p95 latency | Throughput |
|---|---|---|---|---|
| Realistic typing cadence | 30 | **100%** | **3.6 ms** | 210 msg/s |
| Large room (15 peers) | 45 | **100%** | 5.9 ms | 543 msg/s |
| Many concurrent rooms | **600** | **100%** | 60 ms | 2,565 msg/s |
| Burst (no think-time) | 80 | **100%** | 140 ms | **4,800 msg/s** |

> Zero dropped frames, sub-6 ms under real typing load.

**REST API** benchmarked with an async `httpx` harness against the FastAPI backend:

| Scenario | Requests | Concurrency | Errors | p50 | p95 | Throughput |
|---|---|---|---|---|---|---|
| Authenticated read (`GET /projects/`) | 500 | 50 | **0** | 427 ms | 672 ms | **108 req/s** |
| Repo pull (`POST /projects/repo`, shallow clone) | 12 | 6 | **0** | 1.5 s | 1.55 s | 4.2 pulls/s |

> Load testing surfaced (and fixed) a real concurrency bug: the shared Supabase client reused one HTTP/2 connection pool across FastAPI's worker threads, corrupting concurrent writes. The client is now **thread-local**, taking concurrent repo pulls from ~50% failures to **0 errors**.

---

## 📦 Review a Git Repo

Point Code-Grammerizer at a **small project's Git URL** and it pulls the code for you — no zip upload, no copy-paste.

- **Solo** — `POST /projects/repo` with `{ repo_url, project_name?, branch?, token? }`. Runs a shallow `git clone --depth 1`, keeps source files (`.py .js .ts .jsx .tsx .java .cpp .c .go`), and skips `node_modules`, `.git`, `venv`, `dist`, `build`, etc. Guardrails: **40 files max**, **100 KB per file**, **500 KB total**. The result is stored as a multi-file project (new `project_files` table) plus a concatenated blob used for a **whole-project AI review**. `GET /projects/{id}/files` lists the imported files.
- **Team** — `POST /workspaces/{id}/import-repo` pulls the same way directly into collaborative workspace files.
- **Public repos need no auth** — paste any user's public repo URL and it works. The optional `token` is only for private repos.

> On repo projects, single-file static tools (Pylint / Bandit / Radon) are skipped — line numbers are meaningless on a concatenated blob, so review is AI-only.

**In the UI**
- **Upload page** — a new **"Pull Repo"** tab (repo URL + optional branch / token).
- **Workspace detail** — a Git-import button next to the Files **`+`**.

---

## 🧠 Multi-Provider AI & Model Routing

The AI layer is **multi-provider with automatic fallback** — the right model for each job, and a safety net if a provider errors. No OpenAI is used anywhere.

| Task | Provider | Model |
|---|---|---|
| **Code writing** — `/suggest`, documentation generation | Codestral (Mistral) | `codestral-latest` |
| **Analysis** — code review, profile insights | gpt-oss (Cerebras) | `gpt-oss-120b` |
| **Fallback** — used automatically if the primary provider errors | Groq | `llama-3.3-70b-versatile` |

> AI input is clipped to a **~40k-character budget** per call to stay under provider payload limits.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Editor** | Monaco (VSCode engine) |
| **Realtime** | Yjs (CRDT) · `y-websocket` · `y-monaco` · `y-indexeddb` |
| **Backend** | FastAPI (Python 3.11) · WebSockets |
| **AI** | Codestral (Mistral) · Cerebras (`gpt-oss-120b`) · Groq (fallback) |
| **Database** | Supabase (PostgreSQL + RLS) |
| **Static Analysis** | Pylint · Bandit · Radon |
| **Reports** | ReportLab (PDF) |
| **Auth** | JWT (python-jose) |
| **Deploy** | Vercel · Render · Supabase |

---

## 🏗️ Project Structure

```
code-grammerizer/
├── backend/
│   ├── app.py                     # FastAPI entry point
│   ├── config.py                  # Settings (pydantic-settings)
│   ├── migrations/
│   │   ├── 001_initial.sql        # Core tables
│   │   ├── 002_collab.sql         # Workspaces, members, invites, files, change log
│   │   └── 003_project_files.sql  # Multi-file projects (Git repo pull)
│   ├── routes/
│   │   ├── auth.py                # Register, login, profile, stats
│   │   ├── review.py · report.py · lint.py · suggest.py
│   │   ├── upload.py              # Uploads + Git repo pull → multi-file project + files list
│   │   ├── workspace.py           # Workspaces, membership, invites, files, repo import, change log
│   │   └── collab.py              # WebSocket CRDT relay  ← real-time sync
│   ├── services/                  # Multi-provider AI (Codestral/Cerebras/Groq) + Pylint/Bandit/Radon/live-lint
│   ├── models/supabase_client.py  # Supabase client (service_role, RLS-safe)
│   └── tests/load_test_collab.py  # Collaboration load/stress harness
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx · Upload.jsx · ReviewDetail.jsx · Profile.jsx
        │   ├── Workspaces.jsx      # Team workspace list / create / join
        │   ├── WorkspaceDetail.jsx # Live editor, files, presence, invites, history
        │   └── JoinWorkspace.jsx   # Share-link join
        ├── components/
        │   ├── CodeEditor.jsx      # Monaco wrapper (review editor)
        │   ├── CollabEditor.jsx    # Monaco + Yjs binding + live cursors
        │   └── Navbar.jsx
        └── services/
            ├── api.js              # REST client
            └── collab.js           # Yjs doc, WS provider, IndexedDB cache
```

---

## ⚙️ Local Development

### Prerequisites
- Python 3.11+ · Node.js 18+ · Git (for repo pull)
- A [Supabase](https://supabase.com) project
- A [Cerebras](https://cerebras.ai) API key
- A [Mistral](https://mistral.ai) and a [Groq](https://groq.com) API key

### 1. Backend

```bash
git clone https://github.com/Eshwar02/code-grammerizer.git
cd code-grammerizer/backend

python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env              # then fill in your keys
```

### 2. Database

Run all migrations in your Supabase SQL editor, in order:

```
backend/migrations/001_initial.sql        # users, projects, reviews, findings
backend/migrations/002_collab.sql         # workspaces, members, invites, files, change log
backend/migrations/003_project_files.sql  # multi-file projects (Git repo pull)
```

> RLS is enabled on all tables; the backend connects with the `service_role` key and gates access in code. Never expose the service key to the frontend.

### 3. Run

```bash
# backend
uvicorn app:app --reload --port 8000

# frontend (new terminal)
cd ../frontend
npm install
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** 🎉 — the Vite dev proxy forwards both REST and WebSocket traffic to the backend automatically.

---

## 🌐 Deployment

| Service | Platform | Config |
|---------|----------|--------|
| Frontend | Vercel | `vercel.json` (proxies REST → Render) |
| Backend | Render | `backend/render.yaml` |
| Database | Supabase | `backend/migrations/` |

### Environment Variables

**Render (backend)**
```
CEREBRAS_API_KEY=            # gpt-oss-120b — analysis (review, profile insights)
MISTRAL_API_KEY=            # codestral-latest — code writing (suggest, docs)
GROQ_API_KEY=               # llama-3.3-70b-versatile — automatic fallback
GITHUB_TOKEN=               # optional — default token for private repo pulls
SECRET_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=        # service_role — bypasses RLS, backend only
FRONTEND_URL=https://your-app.vercel.app
```

> **Model routing:** Codestral (Mistral) writes code, gpt-oss (Cerebras) analyzes it, and Groq is the automatic fallback if the primary provider errors. See [Multi-Provider AI & Model Routing](#-multi-provider-ai--model-routing).

**Vercel (frontend)** — optional; `vercel.json` already proxies REST to Render.
```
VITE_WS_URL=wss://your-api.onrender.com   # only if your API host differs from the default
```

> WebSocket traffic goes **directly** to the backend (Vercel can't proxy WS); the frontend defaults to the Render host in production.

---

## 🗺️ Roadmap

- [ ] Multi-worker relay scale-out via Redis pub/sub
- [ ] AI review on collaborative files, inline in the room
- [ ] Voice / comment threads per line
- [ ] GitHub PR import & export
- [ ] Playback / time-travel through change history

---

## 📜 License

MIT © [Eshwar](https://github.com/Eshwar02)

---

<div align="center">

Built with **Yjs** · **Codestral / Cerebras / Groq AI** · **FastAPI** · **React** · **Supabase**

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=14&pause=1000&color=4361EE&center=true&vCenter=true&width=520&lines=Review+together.+Ship+faster.+%F0%9F%9A%80" alt="footer" />

</div>
