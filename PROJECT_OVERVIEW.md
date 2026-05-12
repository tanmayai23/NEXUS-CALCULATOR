# NEXUS CALCULATOR — Project Overview

> A consolidated, single-page mental model of the system, generated from a full code scan.
> Companion docs: [`README.md`](./README.md) (setup) · [`docs/SYSTEM_FLOW.md`](./docs/SYSTEM_FLOW.md) (architecture flowcharts).

---

## 1. What this is

NEXUS CALCULATOR is an **answer-first mathematics learning platform** for Indian school students (NCERT classes 9–12) with an integrated **AIMO3 (AI Mathematical Olympiad) competition solver**. It combines a fast calculator engine, an AI-routed multi-tier solver, behavior-driven weakness diagnosis, NCERT-aligned daily practice plans, timed challenges, and a leaderboard — wrapped in a single React app.

**Three audiences served by one product:**
- **Students** — type a question, get final answer + steps + visualization; let the coach diagnose weak chapters and serve adaptive practice.
- **Institutes** — class/institute-scoped dashboards and CSV exports of student progress.
- **AIMO3 competitors** — chain-of-thought + multi-sample + majority-voting solver backed by per-class fine-tuned LoRA adapters on Qwen2.5-Math-7B.

---

## 2. Three-layer architecture

```
                 ┌────────────────────────────────────────────────────┐
                 │                  Browser (Student)                 │
                 └────────────────────────────────────────────────────┘
                                          │
                                          │  HTTP (port 8084)
                                          ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  FRONTEND   nexus-math-weaver/   (Vite + React 18 + TS + shadcn-ui)  │
 │   • Solve view   • Chapter Coach view   • Advanced (tools)           │
 │   • AIMO3 Solver panel                                               │
 └──────────────────────────────────────────────────────────────────────┘
                                          │
                                          │  fetch  →  http://localhost:3001
                                          ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  BACKEND    backend/server.ts    (Express + TS, port 3001)           │
 │   • /calculate, /api/solve/auto  (tier1/2/3 routing)                 │
 │   • /api/aimo3/*                 (spawns Python solver)              │
 │   • /api/auth/*                  (OTP + Google OAuth)                │
 │   • /api/students/*              (profiles, weakness, plans, ...)    │
 │   • /api/institutes/*            (dashboards, CSV exports)           │
 │   • /api/curriculum/ncert        (chapter/formula registry)          │
 └──────────────────────────────────────────────────────────────────────┘
            │                                          │
            │  spawn('python', ['aimo3/api/solve.py']) │  read/write JSON
            ▼                                          ▼
 ┌──────────────────────────┐              ┌──────────────────────────┐
 │  ML PIPELINE   aimo3/    │              │  STATE   backend/data/   │
 │   • api/solve.py         │              │   • student_profiles.json│
 │   • models/{base,        │              │   • users.json           │
 │       inference,         │              │   • auth_otps.json       │
 │       verifier}.py       │              └──────────────────────────┘
 │   • training/train_      │
 │       class{9..12}.py    │              ┌──────────────────────────┐
 │   • outputs/             │◀─ trained on │  CURRICULUM PDFs         │
 │       (LoRA checkpoints) │              │   class 9/, class 10/,   │
 └──────────────────────────┘              │   class 11/, class 12    │
                                           │   part 1/, part 2/       │
                                           │   (NCERT textbooks +     │
                                           │    answers + solutions)  │
                                           └──────────────────────────┘
```

---

## 3. What each layer does

### Frontend — `nexus-math-weaver/`
- **Stack:** Vite, React 18, TypeScript, shadcn-ui (Radix), Tailwind CSS, React Router, TanStack Query, mathjs, recharts.
- **Entry:** `src/main.tsx` → `src/App.tsx` → `src/pages/Index.tsx` → `src/components/NexusLayout.tsx`.
- **Three top-level views** (header buttons in `NexusLayout.tsx`):
  1. **Solve Question** — input box + answer card (final answer, solver mode, route, steps, key formula, mistake alerts) + optional visualization canvas.
  2. **Chapter Coach** — `NexusLearningCoach.tsx`: weakness heatmap, daily plan, timed challenges, leaderboards, OTP/Google sign-in.
  3. **Advanced** — `NexusTools.tsx`: coordinate plotter, lines/angles, triangle congruence, circles, surface/volume nets, 2D graph, wave/quantum.
- **Floating panel:** `AIMO3Solver.tsx` — competition-grade solver with chain-of-thought, multi-sample voting, verifier.
- **Dev port:** `8084` (set in `vite.config.ts`).

### Backend — `backend/`
- **Stack:** Express 4, TypeScript, mathjs, google-auth-library, plain-JSON persistence.
- **Entry:** `backend/server.ts` (~2080 lines, 27 routes).
- **Run:** `nodemon server.ts` via `ts-node`.
- **Dev port:** `3001`.
- **Persistence:** flat JSON files in `backend/data/` (no DB).

### Solver / knowledge layer — `aimo3/`
- **`aimo3/api/solve.py`** — the deterministic CAS solver (SymPy-backed), invoked by the backend via `child_process.spawn('python', ...)`. Handles arithmetic, algebra (factor/expand/simplify), equation & system solving, quadratics, calculus (derivatives, indefinite/definite integrals, limits), matrices (det/inverse/transpose), and common word problems (HCF/LCM, sum of n, nCr/nPr, factorial, mean/median/mode, Heron's area, circle/square/rectangle mensuration). Returns `{answer, solution, steps[], confidence, method, chapter, grade, relevant_formulas[]}`. Always emits one line of JSON, even on error.
- **`aimo3/api/knowledge.py`** — lightweight NCERT retrieval (TF-IDF over curriculum + PDF excerpts; no embeddings model). `retrieve(question)` → best chapter + formulas; `lookup_chapter(grade, name)` → a specific chapter chunk. Solver method names map deterministically to NCERT chapters via `_METHOD_TO_CHAPTER` in `solve.py`.
- **`aimo3/data/ncert_knowledge_index.json`** — the prebuilt index (56 chapters; 47 with PDF text). Rebuild with `python aimo3/data/build_knowledge_index.py`.
- **Tier routing** (`detectSolveTier` in `server.ts`): pure arithmetic → tier1 (in-process mathjs, instant); everything else (equations, algebra, calculus, word/conceptual questions) → tier2 → `solve.py`; explicit olympiad/JEE/proof keywords → tier3 (same pipeline, larger budget).
- **Dependencies:** `pip install sympy` (required for the CAS). PyPDF2 (already present) is used only by the one-shot index builder. The legacy Qwen-7B + LoRA training scripts in `aimo3/training/` and `aimo3/models/` remain but are not on the runtime path.
- **Legacy training data:** `aimo3/data/class{9..12}_training_data.json` + `ncert_curriculum_9_12.json` (the latter is the live source for the knowledge index).

### Curriculum assets — `class 9/`, `class 10/`, `class 11/`, `class 12 part 1/`, `class 12 part 2/`
Raw NCERT PDFs (textbook chapters + answers + practice + solutions). Source material for the Python training pipeline; not loaded at runtime.

---

## 4. Frontend views (what the user sees)

| View | Component | Key features |
|---|---|---|
| **Solve Question** | `NexusLayout.tsx` (default) | Input → `/api/solve/auto` → answer card with `tier`, `route`, `estimatedSolveDepth`; optional visualization canvas |
| **Chapter Coach** | `NexusLearningCoach.tsx` | OTP / Google login, weakness snapshot, daily practice plan, timed challenges, leaderboards, profile history |
| **Advanced** | `NexusTools.tsx` + `NexusCanvas.tsx` | Tool palette + matching visualization (coordinate plotter, lines/angles, triangles, circles, 3D nets, 2D graph, quantum) |
| **AIMO3 Solver** (panel) | `AIMO3Solver.tsx` | Competition mode — chain-of-thought, multi-sample, majority voting, verifier |
| **Assistant** (sidebar) | `NexusAssistant.tsx` | Context-aware hints based on current formula/result |

---

## 5. Backend API surface (27 routes)

### Calculator & solver
| Method | Path | Purpose |
|---|---|---|
| POST | `/calculate` | Direct mathjs evaluation |
| POST | `/api/solve/auto` | Auto-tier router (tier1 calc engine / tier2-3 AI solver) |

### AIMO3 (spawns Python)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/aimo3/solve` | Run competition solver on a problem |
| GET  | `/api/aimo3/status` | Solver process / model status |
| GET  | `/api/aimo3/models` | List available models |

### Auth
| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/auth/config` | Discover OAuth client ID, providers |
| POST | `/api/auth/request-otp` | Email OTP request |
| POST | `/api/auth/verify-otp` | Email OTP verify → session |
| POST | `/api/auth/google` | Google ID-token login |
| POST | `/api/auth/restore` | Restore session from token |

### Student state (most require `x-student-token` header)
| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/curriculum/ncert` | Class/chapter/formula registry |
| POST | `/api/students` | Create / restore student profile |
| POST | `/api/students/:id/alias` | Set display alias / institute / class |
| GET  | `/api/students/:id/weakness` | Weakness snapshot per chapter |
| POST | `/api/students/:id/weakness/update` | Log attempt + mistake type |
| POST | `/api/students/:id/chapters/mark-hard` | Self-mark a chapter as hard |
| GET  | `/api/students/:id/profile/history` | Plan completions + challenge attempts |
| GET  | `/api/students/:id/practice/daily` | Light daily practice |
| GET  | `/api/students/:id/plan/daily` | Adaptive daily plan |
| POST | `/api/students/:id/plan/complete` | Mark plan complete |
| POST | `/api/students/:id/activity/score` | Award activity points (calculator/coach/etc.) |
| POST | `/api/students/:id/challenge/start` | Start 10-question timed challenge |
| POST | `/api/students/:id/challenge/submit` | Submit + score challenge |
| GET  | `/api/students/leaderboard` | Global / class / institute / chapter board |

### Institute
| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/institutes/:name/dashboard` | Aggregate student progress |
| GET  | `/api/institutes/:name/export/students.csv` | CSV export |

### Misc
| Method | Path | Purpose |
|---|---|---|
| GET  | `/` | Health check |

---

## 6. Persisted state — `backend/data/`

| File | Holds |
|---|---|
| `student_profiles.json` | Per-student weakness, attempts, mistake tags, plan completions, challenge attempts, scores, activity counts |
| `users.json` | Auth accounts (OTP / Google), session tokens, linked `studentId` |
| `auth_otps.json` | Pending OTP codes (email → code, expiry, attempts) |

All three are autocreated on first run (`ensureStudentDb()` in `server.ts`).

---

## 7. Environment variables (optional)

Auth gracefully falls back to OTP / guest mode if these are unset.

| Variable | Where | Used for |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `backend/.env` | Verify Google ID tokens server-side |
| `VITE_GOOGLE_CLIENT_ID` | `nexus-math-weaver/.env` | Render Google sign-in button on frontend |
| `PORT` | `backend/.env` | Override default `3001` |
| `NODE_ENV` | `backend/.env` | `production` toggles cookie / OTP-display behavior |

`.env.example` files exist in both `backend/` and `nexus-math-weaver/`.

---

## 8. Run the project

```powershell
# From the project root  C:\Users\tanma\OneDrive\Desktop\Startup\NEXUS CALCULATOR

# Terminal 1 — backend  (port 3001)
npm --prefix backend run dev

# Terminal 2 — frontend (port 8084)
npm --prefix nexus-math-weaver run dev

# Then open
# http://localhost:8084
```

**Dependencies are already installed** in both `backend/node_modules` and `nexus-math-weaver/node_modules` — no `npm install` needed unless `package.json` changes.

The root `package.json` also exposes:
- `npm run dev` → frontend only
- `npm run dev:backend` → backend only
- `npm run dev:frontend` → frontend only
- `npm run build` → frontend production build
- `npm run preview` → preview production build
- `npm run lint` → frontend ESLint

### Solver prerequisites (the CAS path — tier2/tier3 and `/api/aimo3/solve`)
```powershell
pip install sympy            # required for the deterministic CAS solver
# (PyPDF2 is already installed; only the one-shot index builder uses it)
python aimo3/data/build_knowledge_index.py   # (re)build the NCERT knowledge index
```
The backend shells out to `python aimo3/api/solve.py`, so `python` must be on PATH and have `sympy` importable. The legacy GPU/LLM training scripts (`aimo3/training/`, `aimo3/requirements.txt`) are optional and not on the runtime path.

---

## 9. Health checklist (smoke test in 5 steps)

Adapted from `docs/SYSTEM_FLOW.md` §5–6:

1. Backend up on `:3001` with no port conflict.
2. Frontend up on `:8084` and connecting to backend base URL.
3. `aimo3` Python deps installed in active interpreter (only if testing AIMO3).
4. `backend/data/student_profiles.json` writable.
5. Open app → create/restore profile → run one calculator request → run one AIMO3 solve → verify a coach step → load daily plan + leaderboard.

If all five pass, the system is end-to-end healthy.

---

## 10. Where to look next

- **Backend routes & tier logic** — `backend/server.ts`
- **Three-view shell** — `nexus-math-weaver/src/components/NexusLayout.tsx`
- **Coach + protected APIs** — `nexus-math-weaver/src/components/NexusLearningCoach.tsx`
- **AIMO3 solver UI** — `nexus-math-weaver/src/components/AIMO3Solver.tsx`
- **Deterministic CAS solver** — `aimo3/api/solve.py` (SymPy)
- **NCERT retrieval** — `aimo3/api/knowledge.py` + `aimo3/data/build_knowledge_index.py`
- **NCERT curriculum mapping** — `aimo3/data/ncert_curriculum_9_12.json` (source for the index)
- **Legacy LLM training scripts** — `aimo3/training/train_class{9..12}.py` (not on runtime path)
- **Existing architecture flowcharts** — `docs/SYSTEM_FLOW.md`
- **Build roadmap / TODOs** — `docs/BUILD_ROADMAP_TODO.md`
