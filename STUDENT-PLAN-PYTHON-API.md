# Race Pulse — Python API: learning path and delivery plan

Hi 👋

This document is your roadmap for the next few weeks. It has two goals, in
this order:

1. **Build your skills** in modern Python and FastAPI — not by skimming, but
   by actually building something.
2. **Ship two endpoints** that will feed a real product, used every day on a
   wall display in a call center.

Read it calmly, in order. Don't skip steps even if a section looks obvious to
you: each step lays a brick the next one needs.

At the end of every step there's a **✅ Checkpoint** block. Until you can tick
every line of a checkpoint, don't move on. That's the only truly strict rule
in this document.

And most importantly: **when you're stuck for more than 30 minutes on
something, ask.** Being stuck is normal and part of the job. Being stuck for
three days in silence is not. Write your questions down as you go in a
`QUESTIONS.md` file, and we'll go through them together.

---

## 1. What we're building, and why

### The product

There's already a web app that displays a **3D kart race** on a wall screen.
Each kart represents a call center agent, and its position on the track
reflects that agent's performance for the day. It's a team motivation tool,
not a surveillance tool — keep that in mind, it drives some technical choices
further down.

Right now the app runs on **simulated data** (fake numbers generated in
JavaScript). It's ready to consume real data: there's already an HTTP client
written that expects a specific JSON format.

**Your job: build the service that produces that JSON from the real data
stored in Supabase.**

### The big picture

```
┌────────────────┐         ┌─────────────────┐        ┌──────────────┐
│   Telforce     │  sync   │                 │  SQL   │   Your API   │
│  (telephony)   │────────▶│    Supabase     │◀───────│   FastAPI    │
└────────────────┘(existing│   (PostgreSQL)  │        │   (Python)   │
                    cron)  └─────────────────┘        └──────┬───────┘
                                                             │ JSON
                                                             │ HTTP
                                                             ▼
                                                   ┌──────────────────┐
                                                   │  Race Pulse 3D   │
                                                   │  (wall display)  │
                                                   └──────────────────┘
```

What you are **not** doing: the Telforce synchronization (it already exists),
nor the 3D rendering (it already exists). You're building the middle piece,
on the read side.

### Why Python and not JavaScript?

Fair question — always ask it. Three reasons here:

- It's an **isolated** component: if you break something, you don't break the
  main application. For a first real production project, that's exactly what
  we want.
- The team wants to move, in the medium term, to a **React front / Python
  back** architecture. This project is the trial run for that shift.
- Python + FastAPI is an industry standard for data APIs. It's a skill that
  will serve you elsewhere.

---

## 2. Step 0 — Set up your environment

**Estimated time: half a day.**

### 2.1 Python

Check what you have:

```bash
python3 --version
```

You need **Python 3.12 or newer**. If you're below that, or have nothing,
we'll let `uv` handle it (next step).

### 2.2 uv — the project manager

Historically, Python had a well-earned reputation for dependency management
being a nightmare: `pip`, `virtualenv`, `pyenv`, `poetry`, `conda`… each
solving part of the problem. **`uv` replaces all of that** with a single
tool, and it's very fast.

Install (macOS / Linux):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

On Windows (PowerShell):

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Close and reopen your terminal, then check:

```bash
uv --version
```

### 2.3 Create the project

```bash
mkdir race-pulse-api
cd race-pulse-api
uv init --python 3.12
uv add fastapi uvicorn[standard] pydantic pydantic-settings supabase python-dotenv
uv add --dev pytest httpx ruff
```

Take thirty seconds to understand what you just installed — never copy a
command without knowing what it does:

| Package | What it's for |
| --- | --- |
| `fastapi` | The web framework. It turns a Python function into an HTTP endpoint. |
| `uvicorn` | The server that runs your FastAPI app. FastAPI alone can't listen on a port. |
| `pydantic` | Data validation and schema definition. The core of FastAPI's safety. |
| `pydantic-settings` | Reads configuration from environment variables. |
| `supabase` | The official client for talking to Supabase from Python. |
| `python-dotenv` | Loads a `.env` file in development. |
| `pytest` | For writing tests. |
| `httpx` | HTTP client — used by FastAPI's test client. |
| `ruff` | Linter + formatter. The Python equivalent of ESLint/Prettier. |

### 2.4 Starting structure

Create this layout:

```
race-pulse-api/
├── app/
│   ├── __init__.py
│   ├── main.py            # FastAPI entry point
│   ├── config.py          # configuration (env vars)
│   ├── schemas.py         # Pydantic models = the JSON contract
│   ├── db.py              # Supabase connection
│   ├── cache.py           # in-memory cache
│   └── routers/
│       ├── __init__.py
│       └── race.py        # your endpoints
├── tests/
│   └── test_race.py
├── .env                   # secrets — NEVER committed
├── .env.example           # template without secrets — committed
├── .gitignore
└── pyproject.toml         # created by uv
```

The `__init__.py` files can be empty — they tell Python the folder is an
importable "package".

**Right now**, before writing a single line of code, create your
`.gitignore`:

```gitignore
.env
.venv/
__pycache__/
*.pyc
.pytest_cache/
.ruff_cache/
```

> ⚠️ **The rule with no exceptions**: a secret (password, API key, token)
> **never** goes into Git. If it happens, treat the key as compromised and
> have it rotated — removing it in a later commit is not enough, it stays in
> the history.

### ✅ Checkpoint 0

- [ ] `uv --version` responds
- [ ] The `race-pulse-api/` folder exists with the structure above
- [ ] `.gitignore` contains `.env`
- [ ] You can explain in one sentence what each of the 8 packages does

---

## 3. Step 1 — Your first endpoint

**Estimated time: half a day.**

### 3.1 Hello world

`app/main.py`:

```python
from fastapi import FastAPI

app = FastAPI(title="Race Pulse API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

Run it:

```bash
uv run uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/health — you should see `{"status":"ok"}`.

Now open http://localhost:8000/docs. **Take a moment to look at this page.**
FastAPI generated interactive documentation automatically from your code. You
can test your endpoints from the browser. This is one of the framework's
great strengths and it will become your daily working tool.

### 3.2 What you actually need to understand here

Three concepts, and they matter:

**1. The `@app.get("/health")` decorator**

In Python, an `@something` above a function is called a *decorator*: it wraps
your function to add behavior to it. Here it tells FastAPI "when an HTTP GET
request arrives at `/health`, call this function". Your function stays a
normal Python function that you can test directly.

**2. The `-> dict[str, str]` type annotation**

Python doesn't require type hints, but FastAPI **uses** your annotations to
validate data, generate documentation, and convert to JSON. In this project,
**we type everything**. It's not decoration: it's what makes half the
framework work.

**3. `--reload`**

The server restarts itself when you change a file. Handy in development,
**never use it in production** (it's slow and memory-hungry).

### 3.3 Exercise

Before moving on, do these three small exercises yourself. Don't read ahead.

1. Add a `GET /version` endpoint returning `{"version": "0.1.0"}`.
2. Add a `GET /hello/{name}` endpoint returning `{"message": "Hello Alice"}`
   when called with `/hello/Alice`. (Hint: the path parameter becomes an
   argument of your function.)
3. Add a `GET /add?a=3&b=4` endpoint returning `{"result": 7}`. Then try
   calling `/add?a=three&b=4` — look at the error FastAPI returns on its own.
   **That's Pydantic doing its job.**

### ✅ Checkpoint 1

- [ ] The server starts and `/health` responds
- [ ] `/docs` displays and you've tested an endpoint from that page
- [ ] All three exercises work
- [ ] You can explain the difference between a **path** parameter
      (`/hello/{name}`) and a **query** parameter (`?a=3`)

---

## 4. Step 2 — The data contract

**Estimated time: one day.**

This is the most important step in the project. Don't rush it.

### 4.1 Why a "contract"

The 3D app already exists and expects a **precise** JSON format. If your API
returns `name` where it expects `display_name`, nothing renders. That format
is therefore a **contract** between your service and theirs: once frozen, we
don't change it without telling the other side.

The contract is already defined on the frontend, in the file
`src/data/SourceApi.ts` of the `race-pulse-3d` repo (the `ReponseApi`
interface). **Go read it — it's your specification.** Here it is annotated:

```jsonc
{
  "updated_at": "2026-08-06T14:32:10Z",     // when the data was measured
  "goals": {
    "daily": 100,                             // target to reach = finish line
    "weekly": 500,
    "monthly": 2000
  },
  "agents": [
    {
      "id": "a-142",                          // STABLE identifier between calls
      "display_name": "Alice Dupont",
      "team": "North Team",
      "color": "#ff6b57",                     // kart color (optional)
      "daily_score": 73,
      "weekly_score": 310,
      "monthly_score": 1205,
      "daily_trend": 12.5,                    // % speed-up vs their average pace
      "weekly_trend": -3.0,
      "monthly_trend": 5.2
    }
  ],
  "events": [
    {
      "id": "evt-981",
      "at": "2026-08-06T14:31:02Z",
      "kind": "depassement",                  // see the warning below
      "message": "Alice overtakes Bruno",
      "agent_id": "a-142"
    }
  ]
}
```

Two things you must write down somewhere:

- **`id` must be stable.** It's the key that lets the app know Alice's kart at
  14:32 is the same one as Alice's kart at 14:33. If you generate random IDs
  on every request, the karts will jump around the track. Use the agent's
  database identifier.

- 🇫🇷 **The field names and the `kind` values stay exactly as they are — do
  not translate them.** The existing frontend is a French codebase and matches
  these strings literally. `kind` must be one of: `depart`, `depassement`,
  `boost`, `record`, `objectif`, `ralentissement`. Any other value is
  silently converted to `"objectif"` on the frontend, which gives you weird
  behavior rather than a clean error. That's the kind of bug that costs a day
  to find. Same for `display_name`, `daily_score`, etc. — the JSON keys are
  fixed by the contract, even though your Python code around them is English.

### 4.2 Writing the contract in Pydantic

`app/schemas.py`:

```python
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# These values are fixed by the frontend contract — French on purpose.
EventKind = Literal[
    "depart", "depassement", "boost", "record", "objectif", "ralentissement"
]


class Goals(BaseModel):
    daily: int
    weekly: int
    monthly: int


class ApiAgent(BaseModel):
    id: str
    display_name: str
    team: str | None = None
    color: str | None = None

    daily_score: float = 0
    weekly_score: float = 0
    monthly_score: float = 0

    daily_trend: float = 0
    weekly_trend: float = 0
    monthly_trend: float = 0


class ApiEvent(BaseModel):
    id: str
    at: datetime
    kind: EventKind
    message: str
    agent_id: str | None = None


class SnapshotResponse(BaseModel):
    """The full contract expected by Race Pulse 3D."""

    updated_at: datetime
    goals: Goals
    agents: list[ApiAgent]
    events: list[ApiEvent] = Field(default_factory=list)
```

Look at what Pydantic gives you for free:

- `Literal[...]`: if you try to produce an event with `kind="explosion"`,
  **Pydantic raises an error on your side**, instead of letting invalid data
  travel all the way to the wall display.
- `str | None = None`: the field is optional.
- `datetime`: Pydantic automatically serializes to ISO 8601, the expected
  format.
- `Field(default_factory=list)`: the default value is a **new** list for each
  instance. If you wrote `= []`, every instance would share the same list —
  that's a classic Python trap, and it produces bugs that are very hard to
  understand. Remember it.

### 4.3 Wiring the contract to an endpoint (with fake data)

In `app/routers/race.py`, write an endpoint that returns **hardcoded** data.
Yes, hardcoded: we validate the contract before touching the database. That's
a working method — advancing in small verifiable steps — not laziness.

```python
from datetime import UTC, datetime

from fastapi import APIRouter

from app.schemas import ApiAgent, Goals, SnapshotResponse

router = APIRouter(prefix="/v1", tags=["race"])


@router.get("/race/snapshot", response_model=SnapshotResponse)
def snapshot() -> SnapshotResponse:
    return SnapshotResponse(
        updated_at=datetime.now(UTC),
        goals=Goals(daily=100, weekly=500, monthly=2000),
        agents=[
            ApiAgent(
                id="demo-1",
                display_name="Alice Dupont",
                team="North",
                daily_score=73,
                daily_trend=12.5,
            ),
            ApiAgent(
                id="demo-2",
                display_name="Bruno Martin",
                team="South",
                daily_score=51,
                daily_trend=-4.0,
            ),
        ],
        events=[],
    )
```

And register the router in `app/main.py`:

```python
from fastapi import FastAPI

from app.routers import race

app = FastAPI(title="Race Pulse API", version="0.1.0")
app.include_router(race.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

### 4.4 🎉 The satisfying moment

You can now **plug the real 3D app into your API**. In the `race-pulse-3d`
repo, create a `.env.local` file:

```
VITE_RACE_PULSE_API_URL=http://localhost:8000/v1/race/snapshot
```

Then run `npm run dev`. If everything is right, you'll see two karts, named
Alice and Bruno, moving according to the scores you hardcoded.

Change `daily_score=73` to `daily_score=95`, save, wait ten seconds:
**Alice's kart moves forward.** That's it. The rest of the project is
replacing those hardcoded values with real data.

> If it doesn't work, it's almost certainly **CORS** — we fix that in step 6.
> Open the browser console (F12): if you see a message containing
> `Access-Control-Allow-Origin`, that's it. Jump to section 8.1 and come back
> here.

### ✅ Checkpoint 2

- [ ] `app/schemas.py` defines the full contract
- [ ] `/v1/race/snapshot` returns valid JSON with hardcoded data
- [ ] You've seen that JSON in `/docs`
- [ ] **You've seen the karts move in the 3D app**
- [ ] You can explain why we write `Field(default_factory=list)` instead of
      `= []`

---

## 5. Step 3 — Connecting to Supabase

**Estimated time: one day.**

### 5.1 Configuration and secrets

**Never** put a URL or a key directly in the code. Use environment variables.

`.env.example` (committed, no real values):

```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOi...
ALLOWED_ORIGINS=http://localhost:5173
CACHE_TTL_SECONDS=30
```

`.env` (never committed): the same file with the real values. Ask your
supervisor for them — don't go hunting for them in a dashboard yourself.

`app/config.py`:

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_service_key: str
    allowed_origins: str = "http://localhost:5173"
    cache_ttl_seconds: int = 30

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
```

`@lru_cache` means `Settings()` is built **only once**: we don't re-read the
`.env` file on every request.

> 🔑 **Two Supabase keys — don't mix them up.**
> The **anon** key is public, meant for the browser, and subject to RLS (Row
> Level Security) rules. The **service_role** key bypasses all security rules
> — it has full access to the database.
> Your API uses the **service_role** key because it runs on a server. So it
> must **never** be exposed to the browser, never end up in Git, never appear
> in a log. If you see it printed anywhere, stop and report it.

### 5.2 The client

`app/db.py`:

```python
from functools import lru_cache

from supabase import Client, create_client

from app.config import settings


@lru_cache
def supabase() -> Client:
    config = settings()
    return create_client(config.supabase_url, config.supabase_service_key)
```

### 5.3 Explore the database before writing code

**Don't write anything until you understand the data.** Open the Supabase SQL
Editor and explore:

```sql
-- What tables exist?
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- What does a given table look like?
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'TABLE_NAME'
order by ordinal_position;

-- And most importantly: look at real rows.
select * from TABLE_NAME limit 20;
```

Write in `QUESTIONS.md`:
- Which table holds the agents? Which column is the stable identifier?
- Which table holds daily activity (calls, dispositions)?
- Which column carries the date? In what timezone is it stored?
- How do we tell an active agent from a former employee?

Ask your supervisor these questions. That's normal and expected — nobody
guesses a database schema.

### ✅ Checkpoint 3

- [ ] `.env` exists locally, `.env.example` is committed, `.env` is not
- [ ] You can run a query from Python and print a real row from the database
- [ ] You've filled `QUESTIONS.md` with what you understood about the schema
      and what you didn't
- [ ] You can explain the difference between the `anon` and `service_role` keys

---

## 6. Step 4 — Score calculation, and **where** to do it

**Estimated time: two days. This is the technical heart of the project.**

### 6.1 The business rule

An agent's score for one day:

```
score =  1 × (number of calls longer than 10 seconds)
       + 5 × (number of SS)
       + 3 × (number of OFFERT)
       + 2 × (number of RETOUR)
       + 10 × (number of SOLD)
```

Default daily target: **100 points** (that's the finish line).

⚠️ **These weights are not set in stone**, and the exact mapping between these
names (SS, OFFERT, RETOUR, SOLD) and the real database columns must be
**confirmed with your supervisor** before you code. Don't guess: a wrong score
is worse than no score, because nobody notices immediately.

Plan from the start for these weights to be **configurable** rather than
hardcoded in the middle of a query — we'll want to tune them after a few
weeks of real use.

### 6.2 The important architectural decision

Here's the question you need to answer, and it's more interesting than it
looks:

> **Where do we compute the score? In Python, or in SQL?**

Think about it for thirty seconds before reading on.

Three options:

| Where | How | Verdict |
| --- | --- | --- |
| **In Python** | Fetch all the call rows and sum them in a loop. | ❌ You transfer thousands of rows over the network to produce 30 numbers. Slow and expensive. |
| **In SQL, per request** | A SQL view that aggregates. The database does the work, you fetch 30 rows. | ✅ Good. This is what we do. |
| **In SQL, once a day** | A table of pre-computed scores, filled by a scheduled job. | ✅✅ Better long-term, but more complex. **Phase 2.** |

**The general principle to remember, and it will serve you your whole career:**
*let the database do the aggregation work, and transfer as little data over
the network as possible.* A database spends its life optimizing `SUM` and
`GROUP BY` — it will always do it better than a Python loop.

### 6.3 Creating the SQL view

In the Supabase SQL Editor. **Adapt the table and column names** to what you
discovered in step 3 — the code below is a template, not a copy-paste answer.

```sql
create or replace view daily_score_view as
select
    a.id                                as agent_id,
    a.display_name,
    a.team,
    d.day,
    -- The score, with the business weights
    ( 1  * coalesce(d.calls_over_10s, 0)
    + 5  * coalesce(d.ss_count, 0)
    + 3  * coalesce(d.offert_count, 0)
    + 2  * coalesce(d.retour_count, 0)
    + 10 * coalesce(d.sold_count, 0)
    )::numeric                          as score
from agents a
join daily_activity d on d.agent_id = a.id
where a.is_active = true;
```

Watch out for:

- **`coalesce(x, 0)`**: if the column is `NULL`, treat it as zero. Without it,
  `1 * NULL + 5 * 3` evaluates to `NULL` in SQL — not `15`. This is a very
  common source of bugs. In SQL, `NULL` is contagious.
- **The timezone.** The company is in Belgium: the business "day" is the one
  in the `Europe/Brussels` timezone, not UTC. A call placed at 00:30 Belgian
  time in winter is timestamped 23:30 UTC the previous day. Ignore this and
  your scores will be off by a day for part of the year. Use
  `(timestamp at time zone 'Europe/Brussels')::date` to derive the day.

Then the weekly and monthly aggregates:

```sql
create or replace view period_scores_view as
select
    agent_id,
    display_name,
    team,
    sum(score) filter (
        where day = (now() at time zone 'Europe/Brussels')::date
    ) as daily_score,
    sum(score) filter (
        where day >= date_trunc('week', (now() at time zone 'Europe/Brussels')::date)
    ) as weekly_score,
    sum(score) filter (
        where day >= date_trunc('month', (now() at time zone 'Europe/Brussels')::date)
    ) as monthly_score
from daily_score_view
group by agent_id, display_name, team;
```

`sum(...) filter (where ...)` is a very handy PostgreSQL syntax: it computes
several conditional aggregates **in a single pass** over the data, rather than
running three separate queries. Note it down, you'll reuse it.

### 6.4 Verify your results by hand

Before wiring anything up: take **one** agent, **one** day, and recompute
their score with a calculator from the raw rows. Compare with what your view
returns.

If it doesn't match, find out why now. A wrong score that reaches production
is very hard to walk back: people will have believed it.

### ✅ Checkpoint 4

- [ ] The SQL view exists and returns coherent results
- [ ] You've verified **by hand** at least one agent's score for one day
- [ ] You've handled the `Europe/Brussels` timezone
- [ ] You can explain why we aggregate in SQL rather than in Python
- [ ] You can explain what `coalesce` does and why it's needed

---

## 7. Step 5 — Endpoint 1: the real snapshot

**Estimated time: one day.**

Now we replace the hardcoded data with the real query.

```python
from datetime import UTC, datetime

from fastapi import APIRouter

from app.db import supabase
from app.schemas import ApiAgent, Goals, SnapshotResponse

router = APIRouter(prefix="/v1", tags=["race"])

GOALS = Goals(daily=100, weekly=500, monthly=2000)


@router.get("/race/snapshot", response_model=SnapshotResponse)
def snapshot() -> SnapshotResponse:
    response = supabase().table("period_scores_view").select("*").execute()

    agents = [
        ApiAgent(
            id=str(row["agent_id"]),
            display_name=row["display_name"],
            team=row.get("team"),
            daily_score=float(row.get("daily_score") or 0),
            weekly_score=float(row.get("weekly_score") or 0),
            monthly_score=float(row.get("monthly_score") or 0),
        )
        for row in response.data
    ]

    return SnapshotResponse(
        updated_at=datetime.now(UTC),
        goals=GOALS,
        agents=agents,
        events=[],
    )
```

### 7.1 What about trends?

The `*_trend` field is a percentage: the gap between the agent's recent pace
and their average pace. It drives the visual "boost" effect on screen (above
+14%, the kart lights up).

A simple, good-enough definition to start with:

```
daily_trend = (today_score / average_of_last_7_days - 1) × 100
```

With two mandatory guardrails:
- if the average is zero, return `0` (**never** divide by zero);
- clamp the result, for example between −100 and +100, otherwise an agent
  starting at 2 points against an average of 0.1 produces a trend of +1900%
  and an absurd visual effect.

You can compute this in the SQL view (recommended) or in Python. Start by
returning `0` everywhere if you're short on time: the screen works without
it, it'll just be less lively.

### 7.2 What about events?

The event feed ("Alice overtakes Bruno", "New record!") is what brings the
screen to life. Two approaches:

- **Simple, for v1**: return an empty list `[]`. The screen works.
- **Better**: on each refresh, compare the ranking to the previous one (kept
  in memory) and generate overtake events. That's a good exercise once the
  rest is stable.

Don't do the complicated thing first. **Ship the endpoint that works, then
enrich it.**

### ✅ Checkpoint 5

- [ ] `/v1/race/snapshot` returns the **real** agents with their **real**
      scores
- [ ] The 3D app displays those agents and their karts are positioned
      correctly
- [ ] The displayed scores match what you verified by hand

---

## 8. Step 6 — Performance: cache and CORS

**Estimated time: half a day.**

### 8.1 CORS (do this first if you hit the error)

A browser refuses, by default, to let a page served from
`http://localhost:5173` call an API on `http://localhost:8000`. That
protection is called the *same-origin policy*. The API has to explicitly
allow the frontend's origin.

In `app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import race

app = FastAPI(title="Race Pulse API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings().origins_list,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(race.router)
```

> ⚠️ You'll find `allow_origins=["*"]` everywhere on the internet. **Don't do
> that** outside local development: it lets any website in the world call your
> API from your users' browsers. List the allowed origins explicitly — that's
> what the `ALLOWED_ORIGINS` variable is for.

### 8.2 The cache — the real optimization

Think about what actually happens:

- The wall display polls the API **every 10 seconds**.
- With 3 screens, that's **18 requests per minute**.
- But the underlying data only changes when the Telforce sync runs — which is
  **far less often**.

So we're querying the database dozens of times to return exactly the same
result. That's pure waste.

**The fix: an in-memory cache with a short time-to-live.**

`app/cache.py`:

```python
import time
from typing import Any, Callable

_entries: dict[str, tuple[float, Any]] = {}


def with_cache(key: str, ttl_seconds: int, producer: Callable[[], Any]) -> Any:
    """Return the cached value if still fresh, otherwise recompute it."""
    now = time.monotonic()
    entry = _entries.get(key)

    if entry is not None:
        expires_at, value = entry
        if now < expires_at:
            return value

    value = producer()
    _entries[key] = (now + ttl_seconds, value)
    return value


def clear() -> None:
    _entries.clear()
```

Usage:

```python
@router.get("/race/snapshot", response_model=SnapshotResponse)
def snapshot() -> SnapshotResponse:
    return with_cache(
        "snapshot",
        settings().cache_ttl_seconds,
        _build_snapshot,   # the function that does the real work
    )
```

With a 30-second cache: **regardless of how many screens are connected**, the
database is queried at most twice a minute. You just divided the load by ten
or more, with twenty lines of code.

Two details that matter:

- `time.monotonic()` rather than `time.time()`: `monotonic` never goes
  backwards, even if the server clock is adjusted. For measuring a duration,
  it's always the right choice.
- This cache is **per-process**. If you run multiple workers, each has its
  own. That's acceptable here (the data is identical), but it's a limitation
  to be aware of.

### ✅ Checkpoint 6

- [ ] The 3D app calls the API without CORS errors
- [ ] The cache works: temporarily add a `print()` inside the function that
      queries the database, and verify it is **not** called on every HTTP
      request
- [ ] You can explain why `allow_origins=["*"]` is dangerous
- [ ] You can explain the difference between `time.time()` and
      `time.monotonic()`

---

## 9. Step 7 — Endpoint 2: an agent's history

**Estimated time: half a day.**

The second endpoint feeds an agent detail card: their score evolution over the
last N days (to draw a small sparkline).

```
GET /v1/agents/{agent_id}/history?days=30
```

```python
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel


class HistoryPoint(BaseModel):
    day: date
    score: float


class HistoryResponse(BaseModel):
    agent_id: str
    display_name: str
    points: list[HistoryPoint]


@router.get("/agents/{agent_id}/history", response_model=HistoryResponse)
def history(
    agent_id: str = Path(..., min_length=1),
    days: int = Query(30, ge=1, le=365),
) -> HistoryResponse:
    since = date.today() - timedelta(days=days)

    response = (
        supabase()
        .table("daily_score_view")
        .select("agent_id, display_name, day, score")
        .eq("agent_id", agent_id)
        .gte("day", since.isoformat())
        .order("day")
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Unknown agent or no activity")

    return HistoryResponse(
        agent_id=agent_id,
        display_name=response.data[0]["display_name"],
        points=[
            HistoryPoint(day=row["day"], score=float(row["score"] or 0))
            for row in response.data
        ],
    )
```

What this endpoint teaches you that's new:

- **`Query(30, ge=1, le=365)`**: automatic validation. If someone calls
  `?days=99999`, FastAPI returns a clean 422 error **before** your function
  runs. Without that bound, a curious person can make you load ten years of
  data and bring the service to its knees. **Always bound anything coming
  from outside** — that's a security rule, not a convenience.
- **`HTTPException(404)`**: returning the right HTTP status code is part of
  the contract. An empty list and a non-existent agent don't mean the same
  thing.
- **`.order("day")`**: never rely on the natural row order of a database.
  Without `ORDER BY`, the order is **not guaranteed**, even if it looks stable
  in testing.

### ✅ Checkpoint 7

- [ ] The endpoint works for an existing agent
- [ ] It returns 404 for an unknown identifier
- [ ] It returns 422 for `?days=0` and `?days=99999`
- [ ] You can explain why bounding a query parameter is a security concern

---

## 10. Step 8 — Tests

**Estimated time: one day.**

Tests aren't administrative busywork: they're what will let you change your
code in three months without being afraid.

`tests/test_race.py`:

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_snapshot_matches_the_contract():
    response = client.get("/v1/race/snapshot")
    assert response.status_code == 200

    body = response.json()
    assert "updated_at" in body
    assert "goals" in body
    assert isinstance(body["agents"], list)

    for agent in body["agents"]:
        assert agent["id"]                      # non-empty identifier
        assert agent["display_name"]
        assert isinstance(agent["daily_score"], (int, float))


def test_history_bounds_the_days_parameter():
    assert client.get("/v1/agents/x/history?days=0").status_code == 422
    assert client.get("/v1/agents/x/history?days=99999").status_code == 422
```

Run them:

```bash
uv run pytest -v
```

Also write a **pure unit test** on the trend calculation (no database, no
HTTP) — that's the fastest and most useful kind of test:

```python
from app.scores import compute_trend


def test_trend_with_zero_average_does_not_divide_by_zero():
    assert compute_trend(score=10, average=0) == 0


def test_trend_is_clamped():
    assert compute_trend(score=1000, average=1) == 100
```

### ✅ Checkpoint 8

- [ ] `uv run pytest` is green
- [ ] There's at least one test per endpoint
- [ ] There's at least one pure unit test (no HTTP, no database)
- [ ] You've tested at least one **error** case, not just the happy path

---

## 11. Step 9 — Going live

**Estimated time: half a day. Do this with your supervisor.**

Prepare what's needed:

`Dockerfile`:

```dockerfile
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY app/ ./app/

ENV PORT=8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Points to discuss with your supervisor before deploying:

- **Where to host** — a host with a long-running process (Railway, Render,
  Fly.io, Scaleway) fits better than a *serverless* platform here: your
  in-memory cache only makes sense if the process stays alive, and a
  serverless cold start adds latency to every request after an idle period.
- **Where the data lives** — the company is in Belgium and handles employee
  data. Server location within the EU is a question to raise, not to decide
  alone.
- **Secrets** — configured in the host's interface, never in the Docker image
  or in Git.
- **Logs** — make sure your `service_role` key never appears in them.

### ✅ Checkpoint 9

- [ ] The Docker image builds and starts locally
- [ ] The API responds when deployed
- [ ] No secret is present in the Git repository
- [ ] `/health` responds from outside

---

## 12. Path summary

| Step | Content | Time |
| --- | --- | --- |
| 0 | Environment, `uv`, structure | ½ d |
| 1 | First endpoint, `/docs` | ½ d |
| 2 | Pydantic contract + karts moving | 1 d |
| 3 | Supabase connection, schema exploration | 1 d |
| 4 | Score in SQL, timezone | 2 d |
| 5 | **Endpoint 1** — real snapshot | 1 d |
| 6 | CORS + cache | ½ d |
| 7 | **Endpoint 2** — agent history | ½ d |
| 8 | Tests | 1 d |
| 9 | Deployment | ½ d |

**Total: roughly 8 to 9 days of effective work.** Plan generously: a beginner
learning while shipping moves slower, and that's normal. Better to announce
three weeks and deliver in two than the other way around.

---

## 13. The five ideas to take away from all this

If you only kept five things from this project:

1. **Contract first.** Define and freeze the exchange format before writing
   the logic. That's what lets two people work in parallel without stepping on
   each other.
2. **Data work belongs in the database.** Don't pull thousands of rows just to
   sum them.
3. **Don't do the same work twice.** A thirty-line cache divides the load by
   ten here.
4. **Never trust outside input.** Validate, bound, type. `Query(30, ge=1,
   le=365)` is a line of security.
5. **Advance in small verifiable steps.** Hardcoded data → validated contract
   → real database → cache. At every stage, something works. That's the
   difference between a project that moves and a project that stalls.

---

## 14. Going further (after delivery)

If you have the time and the appetite, in this order:

- **Generate overtake events** by comparing successive rankings — that's what
  will really bring the screen to life.
- **Pre-compute scores** into a dedicated table rather than a view, with a
  scheduled job (`pg_cron`). Performance gain, and it lets you freeze
  history.
- **Replace polling with SSE** (Server-Sent Events): instead of the screen
  asking "anything new?" every 10 seconds, the API pushes the update when it
  arrives. FastAPI handles this very well and it's an excellent exercise.
- **Add authentication** if the game becomes accessible from individual
  workstations and not just the wall display.

Good luck — and again: **ask questions.** 🏁
