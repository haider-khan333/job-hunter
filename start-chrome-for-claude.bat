@echo off
REM Launches Chrome with remote debugging so Claude can drive YOUR browser.
REM Chrome 136+ blocks remote debugging on the default profile, so this uses
REM a dedicated profile folder. REM Log into LinkedIn, Bayt, Indeed and any ATS you use ONCE in this profile.
REM Those sessions persist, and they are the only reason portal applications
REM work at all. See docs/02-portal-access.md.
REM RUN THIS BEFORE STARTING CLAUDE CODE. The chrome-devtools MCP server
REM attaches to this Chrome at boot; if the port is not up first it dies with
REM CONNECT_TIMEOUT and cannot be revived without restarting Claude Code.
set PROFILE=%USERPROFILE%\chrome-claude-profile

netstat -ano | findstr /C:"127.0.0.1:9222" | findstr /C:"LISTENING" >nul
if %ERRORLEVEL%==0 (
  echo Port 9222 is ALREADY listening. Chrome is ready, nothing to do.
  echo Start Claude Code now.
  ping -n 6 127.0.0.1 >nul
  exit /b 0
)

echo Starting Chrome with remote debugging on port 9222...
echo Profile: %PROFILE%
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir="%PROFILE%" ^
  --no-first-run ^
  --no-default-browser-check

REM Wait for the port to actually bind, rather than assuming it did.
set TRIES=0
:wait
set /a TRIES+=1
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr /C:"127.0.0.1:9222" | findstr /C:"LISTENING" >nul
if %ERRORLEVEL%==0 goto ready
if %TRIES% LSS 15 goto wait

echo.
echo *** FAILED: port 9222 never came up after 15 seconds. ***
echo Chrome may already be running on the default profile and refusing the
echo debug port. Close ALL Chrome windows, then run this again.
pause
exit /b 1

:ready
echo.
echo OK: port 9222 is listening. Chrome is ready.
echo Now start Claude Code (restart it if it is already open).
ping -n 6 127.0.0.1 >nul
