<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=32&pause=1000&color=4361EE&center=true&vCenter=true&width=600&lines=Code-Grammerizer+%F0%9F%A7%A0;AI+Code+Review+Assistant;Analyze.+Improve.+Ship." alt="Typing SVG" />

<br/>

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://code-grammerizer.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?style=for-the-badge&logo=render)](https://code-grammerizer-api.onrender.com/health)
[![Database](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![AI](https://img.shields.io/badge/AI-Cerebras-FF6B6B?style=for-the-badge&logo=lightning)](https://cerebras.ai)

<br/>

> **An AI-powered full-stack code review assistant** that analyses your code for bugs, security vulnerabilities, complexity issues, and coding style — all in seconds.

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🤖 AI-Powered Review
- Bug detection & fix suggestions
- Security vulnerability scanning
- Performance improvement tips
- Code smell detection
- Naming & refactoring advice
- Auto-generated documentation

</td>
<td width="50%">

### 🔬 Static Analysis
- **Pylint** — code quality & style
- **Bandit** — security scanning
- **Radon** — cyclomatic complexity, maintainability index, avg function length

</td>
</tr>
<tr>
<td>

### 📊 Review Dashboard
- Search & filter all past reviews
- Filter by score range
- Delete reviews
- Detailed per-review reports

</td>
<td>

### 📄 Export Reports
- 📋 Full Review PDF
- 📝 Executive Summary PDF
- 🔒 Security Report PDF
- 📈 Complexity Analysis PDF
- ⬇️ Markdown & HTML export

</td>
</tr>
<tr>
<td>

### 🖊️ Live Code Editor
- Monaco Editor (VSCode-grade)
- Live lint as you type
- Edit reviewed code & re-run analysis
- AI suggestions inline

</td>
<td>

### 👤 Smart Profile
- DiceBear avatars + custom upload
- AI-generated skill level & encouragement
- Code quality rankings & stats
- Motivational coding quotes

</td>
</tr>
</table>

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Editor** | Monaco Editor (VSCode engine) |
| **Backend** | FastAPI (Python 3.11) |
| **AI** | Cerebras (`llama-3.3-70b`) |
| **Database** | Supabase (PostgreSQL) |
| **Static Analysis** | Pylint, Bandit, Radon |
| **PDF Reports** | ReportLab |
| **Auth** | JWT (python-jose) |
| **Deploy** | Vercel + Render + Supabase |

---

## 🏗️ Project Structure

```
code-grammerizer/
├── backend/
│   ├── app.py                  # FastAPI entry point
│   ├── config.py               # Settings (pydantic-settings)
│   ├── requirements.txt
│   ├── render.yaml             # Render deploy config
│   ├── routes/
│   │   ├── auth.py             # Register, login, profile, stats
│   │   ├── review.py           # Trigger, list, filter, delete, re-run
│   │   ├── report.py           # PDF / Markdown / HTML export
│   │   ├── lint.py             # Live lint endpoint
│   │   ├── suggest.py          # AI code suggestions
│   │   └── upload.py           # File & snippet upload
│   ├── services/
│   │   ├── ai_service.py       # Cerebras LLM calls
│   │   ├── pylint_service.py
│   │   ├── bandit_service.py
│   │   ├── radon_service.py
│   │   └── live_lint_service.py
│   └── models/
│       └── supabase_client.py  # Supabase client singleton
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.jsx   # Review list + search/filter
    │   │   ├── Upload.jsx      # Submit code (snippet or file)
    │   │   ├── ReviewDetail.jsx# Full review + editable code tab
    │   │   └── Profile.jsx     # Avatar, AI stats, rankings
    │   ├── components/
    │   │   ├── CodeEditor.jsx  # Monaco editor wrapper
    │   │   └── Navbar.jsx      # Dark mode toggle + avatar
    │   └── hooks/
    │       ├── useAuth.jsx
    │       └── useTheme.jsx    # Dark / light mode
    └── vercel.json
```

---

## ⚙️ Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Cerebras](https://cerebras.ai) API key

### 1. Clone & setup backend

```bash
git clone https://github.com/Eshwar02/code-grammerizer.git
cd code-grammerizer/backend

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Fill in your keys in .env
```

### 2. Set up the database

Run `backend/migrations/001_initial.sql` in your Supabase SQL editor, then:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
```

### 3. Start the backend

```bash
uvicorn app:app --reload --port 8000
```

### 4. Start the frontend

```bash
cd ../frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) 🎉

---

## 🌐 Deployment

| Service | Platform | Config |
|---------|----------|--------|
| Frontend | Vercel | `frontend/vercel.json` |
| Backend | Render | `backend/render.yaml` |
| Database | Supabase | `backend/migrations/` |

### Environment Variables

**Render (backend):**
```
CEREBRAS_API_KEY=
SECRET_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
FRONTEND_URL=https://your-app.vercel.app
```

**Vercel (frontend):**
```
VITE_API_URL=https://your-api.onrender.com
```

---

## 📜 License

MIT © [Eshwar](https://github.com/Eshwar02)

---

<div align="center">

Made with ❤️ using **Cerebras AI** · **FastAPI** · **React** · **Supabase**

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=14&pause=1000&color=4361EE&center=true&vCenter=true&width=500&lines=Keep+coding.+Keep+improving.+%F0%9F%9A%80" alt="footer" />

</div>
