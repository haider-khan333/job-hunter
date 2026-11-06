# Register (or remove) the hourly job watcher as a Windows Scheduled Task.
#
# This is the durable half of the system. It runs whether or not Claude Code is
# open, because a Scheduled Task is owned by Windows rather than by a session.
#
#   powershell -ExecutionPolicy Bypass -File scripts/watch-install.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/watch-install.ps1 -Remove
#   powershell -ExecutionPolicy Bypass -File scripts/watch-install.ps1 -Minutes 30
#
# No admin rights needed: it registers under the current user and runs only
# when that user is logged on, which is what we want anyway since the sweep
# writes into his repo.
param(
  [switch]$Remove,
  [int]$Minutes = 60,
  [string]$TaskName = "JobWatcher"
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

if ($Remove) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Output "Removed scheduled task '$TaskName'."
  } else {
    Write-Output "No scheduled task named '$TaskName' to remove."
  }
  exit 0
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Error "node is not on PATH; cannot register the task."; exit 1 }

# WakeToRun is set because the laptop stays on but may still sleep; without it
# a sleeping machine silently skips hours, and StartWhenAvailable only catches
# up once something else wakes it.

# A window twice the interval, so a single missed or slow run does not lose a
# posting. Duplicates are filtered by seen.json, not by the window.
$hours = [math]::Max(2, [math]::Ceiling(($Minutes * 2) / 60))

$action = New-ScheduledTaskAction -Execute $node `
  -Argument "scripts\watch.mjs --quiet --notify --hours $hours" `
  -WorkingDirectory $repo

# Start at the next whole interval, then repeat forever. The duration is set to
# the maximum rather than left unset, because an unset duration makes the
# repetition fire once and stop on some Windows builds.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) `
  -RepetitionInterval (New-TimeSpan -Minutes $Minutes) `
  -RepetitionDuration ([TimeSpan]::FromDays(3650))

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 20) `
  -WakeToRun `
  -MultipleInstances IgnoreNew `
  -RunOnlyIfNetworkAvailable

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Output "Replaced the existing '$TaskName' task."
}

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Settings $settings `
  -Description "Sweeps LinkedIn, NaukriGulf and every verified ATS board for new UAE engineering roles, scores them against profile/resume.json, and writes applications/_watch/LATEST.md. Installed from scripts/watch-install.ps1." | Out-Null

Write-Output ""
Write-Output "Registered '$TaskName': every $Minutes minutes, looking back $hours hours."
Write-Output "  repo    $repo"
Write-Output "  node    $node"
Write-Output "  digest  $repo\applications\_watch\LATEST.md"
Write-Output "  log     $repo\applications\_watch\watch.log"
Write-Output ""
Write-Output "Run it once now:    Start-ScheduledTask -TaskName $TaskName"
Write-Output "Check it:           Get-ScheduledTaskInfo -TaskName $TaskName"
Write-Output "Stop it:            powershell -File scripts\watch-install.ps1 -Remove"
Write-Output ""
