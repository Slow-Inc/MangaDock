[CmdletBinding()]
param([switch]$Publish)

$ErrorActionPreference = 'Stop'
$repo = 'Slow-Inc/MangaDock'
$docs = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../docs'))
$plan = Get-Content -LiteralPath (Join-Path $docs '2026-10-02-native-mobile-migration-plan.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$outputDir = Join-Path $docs 'native-migration-publish'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$encoding = New-Object System.Text.UTF8Encoding($false)
$statePath = Join-Path $outputDir 'published.json'
$state = if (Test-Path -LiteralPath $statePath) { Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json } else { [pscustomobject]@{ parent = $null; slices = @() } }

function Save-State {
    [System.IO.File]::WriteAllText($statePath, (($state | ConvertTo-Json -Depth 12) + [Environment]::NewLine), $encoding)
}

function Publish-Issue([string]$Title, [string]$BodyPath, [string]$Label) {
    $result = & $script:ghPath issue create --repo $repo --title $Title --body-file $BodyPath --label $Label
    if ($LASTEXITCODE -ne 0) { throw "gh failed creating $Title; inspect GitHub before retrying an ambiguous network failure." }
    $url = ($result | Select-Object -Last 1).Trim()
    if ($url -notmatch '^https://github\.com/Slow-Inc/MangaDock/issues/\d+$') { throw 'Unexpected gh result; inspect GitHub before retrying.' }
    return $url
}

$parentBody = Get-Content -LiteralPath (Join-Path $docs '2026-10-02-native-mobile-migration-prd.md') -Encoding UTF8 -Raw
$parentBody = $parentBody.Replace('Status: Draft for module/testing review; not published; product implementation has not started.', 'Status: Approved for phased TDD implementation; delivery is subject to acceptance criteria.')
$parentBody = $parentBody.Replace('สถานะ: ร่างสำหรับ review modules/การทดสอบ ยังไม่เผยแพร่ และยังไม่เริ่ม implement ผลิตภัณฑ์', 'สถานะ: อนุมัติให้ implement เป็น phase ด้วย TDD โดยการส่งมอบขึ้นกับเกณฑ์รับงาน')
$parentBody = [regex]::Replace($parentBody, '\]\(\.\./\.\./([^)]+)\)', '](https://github.com/Slow-Inc/MangaDock/blob/main/$1)')
$parentPath = Join-Path $outputDir 'parent.md'
[System.IO.File]::WriteAllText($parentPath, $parentBody, $encoding)

if ($Publish) {
    $script:ghPath = (Get-Command gh -ErrorAction Stop).Source
    if (-not $state.parent) { $state.parent = Publish-Issue $plan.prdTitle $parentPath 'ready-for-agent'; Save-State }
}

foreach ($slice in $plan.slices) {
    $existing = @($state.slices | Where-Object { $_.slice -eq $slice.n })
    if ($Publish -and $existing.Count -gt 0) { continue }
    $parent = if ($state.parent) { $state.parent } else { 'Native migration PRD (preview)' }
    $blockers = @()
    foreach ($dependency in $slice.deps) {
        $match = @($state.slices | Where-Object { $_.slice -eq $dependency })
        if ($match.Count -gt 0) { $blockers += $match[0].url }
        elseif ($Publish) { throw "Missing published blocker S$dependency for S$($slice.n)" }
        else { $blockers += "S$dependency (preview)" }
    }
    $label = if ($slice.type -eq 'AFK') { 'ready-for-agent' } else { 'ready-for-human' }
    $bodyParts = @()
    for ($language = 0; $language -lt 2; $language++) {
        $headers = if ($language -eq 0) { @('EN','Parent','What to build','Acceptance criteria','Blocked by') } else { @('TH','Parent / งานหลัก','สิ่งที่จะสร้าง','เกณฑ์รับงาน','ติดบล็อกโดย') }
        $criteria = ($slice.ac | ForEach-Object { '- [ ] ' + $_[$language] }) -join "`n"
        $depends = if ($blockers.Count) { ($blockers | ForEach-Object { '- ' + $_ }) -join "`n" } else { if ($language -eq 0) { 'None - can start immediately' } else { 'ไม่มี - เริ่มได้ทันที' } }
        $scope = if ($language -eq 0) { 'Scope: Mobile only; reuse existing APIs, business rules, and data. Preserve Frontend/Backend/MIT and the shared bridge.' } else { 'Scope: Mobile เท่านั้น ใช้ APIs กฎธุรกิจ และข้อมูลเดิม รักษา Frontend/Backend/MIT และ shared bridge' }
        $method = if ($language -eq 0) { 'TDD: One observable behavior through public interfaces at a time, with real Mobile code and external-boundary mocks. Record RED -> GREEN; refactor only while GREEN. Release-only work verifies device evidence.' } else { 'TDD: พฤติกรรมที่สังเกตได้ผ่าน public interfaces ทีละข้อ ใช้ Mobile code จริงและ mock ขอบภายนอก บันทึก RED -> GREEN และ refactor เฉพาะขณะ GREEN ส่วนงาน release อย่างเดียวตรวจหลักฐานอุปกรณ์' }
        $bodyParts += "## $($headers[0])`n`n## $($headers[1])`n`n$parent`n`nPhase: $($slice.phase) | Type: $($slice.type) | User stories: $($slice.stories -join ', ')`n`n## $($headers[2])`n`n$($slice.desc[$language])`n`n$scope`n`n$method`n`n## $($headers[3])`n`n$criteria`n`n## $($headers[4])`n`n$depends`n"
    }
    $bodyPath = Join-Path $outputDir ('S{0:d2}.md' -f $slice.n)
    [System.IO.File]::WriteAllText($bodyPath, ($bodyParts -join "`n---`n`n"), $encoding)
    if ($Publish) {
        $url = Publish-Issue $slice.title $bodyPath $label
        $state.slices += [pscustomobject]@{ slice = $slice.n; url = $url; type = $slice.type; phase = $slice.phase }
        Save-State
        Write-Output "S$($slice.n): $url"
    }
}
if (-not $Publish) { Write-Output "Prepared parent + $($plan.slices.Count) bilingual issue bodies in $outputDir. Use -Publish in an environment with authenticated gh and write access." }
