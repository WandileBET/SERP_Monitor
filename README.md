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

## Dashboard
The React dashboard supports keyword selection, date ranges, trend resolution, hourly-day analysis, horizontal trend scrolling, date-based heatmap selection, PDF export, and a visible bot-detection alert based on each keyword workbook's real Capture Status.

## Backend
Create `.env` in the project root with `DATABASE_URL=...` and optionally `SERP_SCRIPTS_DIR=...`. Start FastAPI from `backend` with `python -m uvicorn app.main:app --reload --port 8000`.

## Frontend
From `frontend`: `npm install` then `npm run dev`.
"# SERP_Monitor" 
