# Pop a Windows toast. Called by watch.mjs when the hourly sweep finds
# something new, so you do not have to go looking for the digest.
#
#   powershell -ExecutionPolicy Bypass -File scripts/notify.ps1 -Title "..." -Body "..."
#
# Uses the built-in WinRT toast API rather than a module, so there is nothing to
# install. If the toast fails for any reason the sweep must not fail with it,
# so every path here swallows its own errors.
param(
  [string]$Title = "Job watcher",
  [string]$Body  = "New roles found."
)

try {
  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
  [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null

  # PowerShell is registered as an app id on every Windows install, which saves
  # having to register one of our own just to raise a toast.
  $appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'

  $esc = { param($s) $s -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;' }
  $xml = @"
<toast activationType="protocol" launch="file:///$($PSScriptRoot -replace '\\','/')/../applications/_watch/LATEST.md">
  <visual>
    <binding template="ToastGeneric">
      <text>$(& $esc $Title)</text>
      <text>$(& $esc $Body)</text>
    </binding>
  </visual>
</toast>
"@

  $doc = New-Object Windows.Data.Xml.Dom.XmlDocument
  $doc.LoadXml($xml)
  $toast = New-Object Windows.UI.Notifications.ToastNotification $doc
  [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
  exit 0
} catch {
  # Toast unavailable (locked session, policy, headless). Not worth failing over.
  Write-Output "toast unavailable: $($_.Exception.Message)"
  exit 0
}
