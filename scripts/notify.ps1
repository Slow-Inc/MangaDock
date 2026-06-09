<#
.SYNOPSIS
  Pop a Windows toast notification (used to ping the dev when a long task finishes
  or needs a decision, so they don't have to watch the terminal).

.DESCRIPTION
  Claude Code's built-in terminal notification does not surface as an OS toast on
  this Win11 + VS Code setup. This sends a real WinRT toast instead, which lands
  in the Action Center and is forwarded to the phone via Phone Link.

  WinRT projections only load under Windows PowerShell 5.1, so this script (run by
  pwsh 7) shells out to powershell.exe and emits the toast under the well-known
  Windows PowerShell AppId (it has a Start shortcut, which toasts require).

.EXAMPLE
  pwsh -File scripts/notify.ps1 -Message "build done: 137 tests green"
  pwsh -File scripts/notify.ps1 -Title "MangaDock" -Message "need a decision on #166"
#>
param(
  [string]$Title = 'MangaDock',
  [Parameter(Mandatory)][string]$Message
)

$ps51 = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
if (-not (Test-Path $ps51)) { Write-Error "Windows PowerShell 5.1 not found at $ps51"; exit 1 }

# Escape so a '<' or '&' in the text can't break the toast XML.
$t = [System.Security.SecurityElement]::Escape($Title)
$m = [System.Security.SecurityElement]::Escape($Message)

# Backticks escape the inner-script's own $ so they survive this double-quoted here-string.
$inner = @"
[void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
[void][Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime]
[void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime]
`$AppId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
`$doc = New-Object Windows.Data.Xml.Dom.XmlDocument
`$doc.LoadXml('<toast><visual><binding template="ToastGeneric"><text>$t</text><text>$m</text></binding></visual></toast>')
`$toast = New-Object Windows.UI.Notifications.ToastNotification `$doc
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier(`$AppId).Show(`$toast)
"@

& $ps51 -NoProfile -Command $inner
