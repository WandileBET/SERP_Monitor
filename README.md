# SERP Monitor

Production React + FastAPI + PostgreSQL SERP monitoring application with real Excel-based hourly collectors.

## Included collectors
- `scripts/SEO_SERP_Monitor_aviator.py`
- `scripts/SEO_SERP_Monitor_lucky_numbers.py`
- `scripts/SEO_SERP_Monitor_online_slots.py`
- `scripts/SEO_SERP_Monitor_soccer_betting.py`

Each collector uses the original working SERP extraction logic and captures up to the Top 10 organic results. A capture only fails when Google is blocked or no organic results are extracted; partial captures such as 9 of 10 are saved with a warning.

## Hourly automation
Use `scripts/run_capture_and_sync.bat` in Windows Task Scheduler. It runs all four keyword collectors once each, synchronizes successful workbook data into PostgreSQL, records any failures in `scripts/failed_scrapers.txt`, waits 15 minutes, retries only the failed collectors, and synchronizes again so successful retry data is imported immediately.

## Google search URL mode
Use the full URL mode when you want the scraper to behave consistently across scheduled runs, with South Africa targeting and personalization disabled:

```python
url = (
    "https://www.google.com/search"
    f"?q={quote_plus(keyword)}"
    f"&hl={GOOGLE_HL}&gl={GOOGLE_GL}&num={GOOGLE_NUM}&pws=0"
)
```

Use the plain URL mode when you want the scraper to be closer to a normal manual browser search:

```python
url = "https://www.google.com/search" f"?q={quote_plus(keyword)}"
```

## Dashboard
The React dashboard supports keyword selection, date ranges, trend resolution, hourly-day analysis, horizontal trend scrolling, date-based heatmap selection, PDF export, and a visible bot-detection alert based on each keyword workbook's real Capture Status.

## Run locally on Windows
The app needs a PostgreSQL database. Create the local environment file once from the project root and set `DATABASE_URL` to a reachable database:

```powershell
Copy-Item .env.example .env
```

Install and start the backend from the project root (the API reads this root `.env` even when launched from another directory):

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

In a second PowerShell window, start the frontend:

```powershell
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. Keep both terminals running. If PowerShell blocks virtual environment activation, use `py -m pip install -r backend\requirements.txt` and `py -m uvicorn app.main:app --app-dir backend --reload --port 8000` without activating it.


## Run with Docker
The compose file reads `.env` from the project root. Create it from `.env.docker.example` once and set its `DATABASE_URL` to your reachable PostgreSQL database. Then run from the project root:

```powershell
Copy-Item .env.docker.example .env
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=30 backend
```

## Run collectors manually
From the project root in PowerShell:

```powershell
.\scripts\run_capture_and_sync.bat
```

## Sync an existing clone after the history cleanup
The `main` and `SERP_Moniter_V2` branches were rewritten to remove generated workbooks, browser profiles, logs, and caches from Git history. Existing clones should fetch the updated branch and reset their local branch to it.

On `SERP_Moniter_V2`, run from the project root:

```powershell
git fetch origin
git reset --mixed origin/SERP_Moniter_V2
```

On `main`, use `git reset --mixed origin/main` instead. The `--mixed` reset updates the branch and Git index while leaving local files in place, so existing spreadsheets and Chrome profiles remain on that machine and are ignored by Git. Avoid `git reset --hard`, which can delete local files. Back up any unpushed commits before resetting.
