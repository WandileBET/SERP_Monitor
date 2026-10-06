@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
set "LOG_FILE=%SCRIPT_DIR%run_capture_and_sync.log"
set "CURRENT_LOG=%SCRIPT_DIR%run_current.log"
set "FAILED_LIST=%SCRIPT_DIR%failed_scrapers.txt"
set "RETRY_LIST=%SCRIPT_DIR%retry_scrapers.txt"
set "SYNC=%SCRIPT_DIR%sync_excel.py"
set "KNOWN_PYTHON=C:\Users\WandileK\AppData\Local\Microsoft\WindowsApps\PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0\python.exe"
set "OVERALL_ERROR=0"

goto :main

:main

call :log "============================================================"
call :log "[%date% %time%] CAPTURE + SYNC START"
call :log "============================================================"

if exist "%FAILED_LIST%" del /q "%FAILED_LIST%" >nul 2>&1
if exist "%RETRY_LIST%" del /q "%RETRY_LIST%" >nul 2>&1

where python >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    set "PYTHON_CMD=python"
) else (
    where py >nul 2>&1
    if "%ERRORLEVEL%"=="0" (
        set "PYTHON_CMD=py -3"
    ) else if exist "%KNOWN_PYTHON%" (
        set "PYTHON_CMD=%KNOWN_PYTHON%"
    ) else (
        call :log "ERROR: No Python launcher was found. Checked PATH and %KNOWN_PYTHON%."
        exit /b 1
    )
)

REM ============================================================
REM VERIFY ALL SCRAPERS EXIST
REM ============================================================

for %%F in (
    "%SCRIPT_DIR%SEO_SERP_Monitor_Aviator.py"
    "%SCRIPT_DIR%SEO_SERP_Monitor_Lucky_Numbers.py"
    "%SCRIPT_DIR%SEO_SERP_Monitor_Online_Slots.py"
    "%SCRIPT_DIR%SEO_SERP_Monitor_Soccer_Betting.py"
) do (
    if not exist "%%~F" (
        call :log "ERROR: Scraper not found: %%~F"
        set "OVERALL_ERROR=1"
    )
)

REM ============================================================
REM RUN ALL KEYWORD SCRAPERS
REM ============================================================

for %%F in (
    "%SCRIPT_DIR%SEO_SERP_Monitor_Aviator.py"
    "%SCRIPT_DIR%SEO_SERP_Monitor_Lucky_Numbers.py"
    "%SCRIPT_DIR%SEO_SERP_Monitor_Online_Slots.py"
    "%SCRIPT_DIR%SEO_SERP_Monitor_Soccer_Betting.py"
) do (
    call :run_scraper "%%~F"
)

REM ============================================================
REM SYNC SUCCESSFUL FIRST-PASS WORKBOOKS TO POSTGRESQL
REM ============================================================

call :sync_excel "first pass"

REM ============================================================
REM RETRY ONLY FAILED SCRAPERS AFTER 15 MINUTES
REM ============================================================

if exist "%FAILED_LIST%" (
    call :log "------------------------------------------------------------"
    call :log "One or more scrapers failed. Waiting 15 minutes, then retrying only failed scrapers."
    timeout /t 900 /nobreak

    move /y "%FAILED_LIST%" "%RETRY_LIST%" >nul

    for /f "usebackq delims=" %%F in ("%RETRY_LIST%") do (
        call :run_scraper "%%~F"
    )

    REM Sync again so any successful retries are imported immediately.
    call :sync_excel "retry pass"

    if exist "%FAILED_LIST%" (
        call :log "ERROR: One or more scrapers still failed after the 15-minute retry."
        set "OVERALL_ERROR=1"
    )
)

REM ============================================================
REM FINAL STATUS
REM ============================================================

if "%OVERALL_ERROR%"=="0" (
    call :log "============================================================"
    call :log "[%date% %time%] CAPTURE + SYNC COMPLETE"
    call :log "============================================================"

    if exist "%CURRENT_LOG%" del /q "%CURRENT_LOG%" >nul 2>&1
    if exist "%FAILED_LIST%" del /q "%FAILED_LIST%" >nul 2>&1
    if exist "%RETRY_LIST%" del /q "%RETRY_LIST%" >nul 2>&1

    exit /b 0
)

call :log "============================================================"
call :log "[%date% %time%] CAPTURE + SYNC FINISHED WITH ERRORS"
call :log "============================================================"

if exist "%CURRENT_LOG%" del /q "%CURRENT_LOG%" >nul 2>&1
if exist "%RETRY_LIST%" del /q "%RETRY_LIST%" >nul 2>&1

exit /b 1

REM ============================================================
REM SYNC EXCEL WORKBOOKS TO POSTGRESQL
REM ============================================================

:sync_excel

set "SYNC_LABEL=%~1"
if not defined SYNC_LABEL set "SYNC_LABEL=manual"

call :log "Starting Excel to PostgreSQL sync (%SYNC_LABEL%)..."

pushd "%ROOT_DIR%"

%PYTHON_CMD% "%SYNC%" >> "%LOG_FILE%" 2>&1

set "SYNC_EXIT=%ERRORLEVEL%"

popd

if not "%SYNC_EXIT%"=="0" (
    call :log "ERROR: Excel to PostgreSQL sync failed (%SYNC_LABEL%)."
    set "OVERALL_ERROR=1"
) else (
    call :log "Excel to PostgreSQL sync completed successfully (%SYNC_LABEL%)."
)

exit /b 0


REM ============================================================
REM RUN ONE SCRAPER
REM ============================================================

:run_scraper

set "SCRAPER=%~1"
set "NAME=%~n1"

if not exist "%SCRAPER%" (
    call :log "ERROR: %NAME% was not found. Skipping."
    set "OVERALL_ERROR=1"
    exit /b 0
)

call :log "------------------------------------------------------------"
call :log "Starting %NAME%..."

if exist "%CURRENT_LOG%" del /q "%CURRENT_LOG%" >nul 2>&1

pushd "%SCRIPT_DIR%"

%PYTHON_CMD% "%SCRAPER%" > "%CURRENT_LOG%" 2>&1

set "SCRAPER_EXIT=%ERRORLEVEL%"

popd

type "%CURRENT_LOG%" >> "%LOG_FILE%"

if not "%SCRAPER_EXIT%"=="0" (
    call :log "WARNING: %NAME% failed with exit code %SCRAPER_EXIT%. Continuing with remaining keywords."
    >> "%FAILED_LIST%" echo %SCRAPER%
) else (
    call :log "%NAME% completed successfully."
)

exit /b 0


REM ============================================================
REM LOGGING
REM ============================================================

:log

echo %~1>> "%LOG_FILE%"
echo %~1

goto :eof
