# fetch-issue-data.ps1 — ดึง issue bodies + comments ทั้งหมดบันทึกเป็น JSON
$env_line = Get-Content "C:\Github\MangaDock\Frontend\.env" | Where-Object { $_ -match "^GITHUB_TOKEN=" }
$token = ($env_line -split "=", 2)[1].Trim()
$headers = @{
  "Authorization" = "Bearer $token"
  "Accept" = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$BASE = "https://api.github.com/repos/Slow-Inc/MangaDock"

# Fetch all issues paginated
$all = @()
for ($page = 1; $page -le 5; $page++) {
  $batch = Invoke-RestMethod -Uri "$BASE/issues?state=all&per_page=100&page=$page" -Headers $headers
  if ($batch.Count -eq 0) { break }
  $all += $batch
  if ($batch.Count -lt 100) { break }
  Start-Sleep -Milliseconds 300
}

Write-Host "Total items: $($all.Count)"

$result = @()
$i = 0
foreach ($issue in $all) {
  $i++
  $num = $issue.number
  Write-Host "[$i/$($all.Count)] #$num fetching comments..."

  $comments = @()
  if ($issue.comments -gt 0) {
    try {
      $raw = Invoke-RestMethod -Uri "$BASE/issues/$num/comments" -Headers $headers
      foreach ($c in $raw) {
        $comments += @{
          id = $c.id
          body = $c.body
          user = $c.user.login
          hasThaiFlag = ($c.body -and $c.body.Contains('🇹🇭'))
        }
      }
      Start-Sleep -Milliseconds 300
    } catch {
      Write-Warning "#$num comments failed: $_"
    }
  }

  $result += @{
    number   = $num
    isPR     = [bool]$issue.pull_request
    title    = $issue.title
    body     = $issue.body
    hasThaiBody = ($issue.body -and $issue.body.Contains('🇹🇭'))
    comments = $comments
  }
}

$result | ConvertTo-Json -Depth 10 | Set-Content "C:\Github\MangaDock\scripts\.issue-data.json" -Encoding utf8
Write-Host "`n✅ Saved to scripts/.issue-data.json ($($result.Count) items)"
