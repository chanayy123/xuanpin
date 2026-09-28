param(
  [string]$Repository = 'chanayy123/xuanpin',
  [string]$Workflow = 'sync-catalog.yml',
  [string]$Branch = 'feature/catalog-sync-dashboard',
  [int]$Port = 4173,
  [switch]$UpdateOnly,
  [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BuildDir = Join-Path $ProjectRoot '.local-build'
$NextBuildDir = Join-Path $ProjectRoot '.local-build-next'
$OutputLogFile = Join-Path $ProjectRoot '.local-build-server.log'
$ErrorLogFile = Join-Path $ProjectRoot '.local-build-server.error.log'
$ServerScript = Join-Path $PSScriptRoot 'serve_dist.js'
$DashboardUrl = "http://127.0.0.1:$Port/"
$CurrentFile = Join-Path $BuildDir 'current.json'
$StatusFile = Join-Path $BuildDir 'update-status.json'

function Assert-ChildPath {
  param([string]$Candidate)
  $root = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  $resolved = [IO.Path]::GetFullPath($Candidate)
  if (-not $resolved.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
    throw "拒绝操作项目目录以外的路径：$resolved"
  }
}
function Write-AtomicJson {
  param([string]$File, $Value)
  $temp = "$File.tmp"
  [IO.File]::WriteAllText($temp, ($Value | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
  if (Test-Path -LiteralPath $File) { [IO.File]::Replace($temp, $File, $null) }
  else { [IO.File]::Move($temp, $File) }
}
function Test-LocalServer {
  try {
    $response = Invoke-RestMethod -Uri "${DashboardUrl}__dashboard/status.json" -TimeoutSec 2
    return $response.server -eq 'xuanpin-local'
  } catch { return $false }
}
function Invoke-GhJson {
  param([string]$Endpoint)
  $result = & gh api $Endpoint 2>$null
  if ($LASTEXITCODE -ne 0) { throw "GitHub API 请求失败：$Endpoint" }
  return ($result | ConvertFrom-Json)
}

Assert-ChildPath $BuildDir
Assert-ChildPath $NextBuildDir
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
try { $updateLock = [IO.File]::Open((Join-Path $BuildDir 'update.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
catch {
  if ($UpdateOnly) { return }
  throw '选品站正在检查新版本，请稍后重新打开。'
}
try {
$previous = if (Test-Path -LiteralPath $CurrentFile) { Get-Content -Raw -Encoding UTF8 -LiteralPath $CurrentFile | ConvertFrom-Json }
  elseif (Test-Path -LiteralPath (Join-Path $BuildDir 'index.html')) { @{ runId = 'legacy-local'; directory = '.'; downloadedAt = (Get-Item -LiteralPath (Join-Path $BuildDir 'index.html')).LastWriteTimeUtc.ToString('o') } }
  else { $null }
$updateStatus = @{ lastCheckAt = [DateTime]::UtcNow.ToString('o'); updateStatus = 'checking'; error = $null; buildVersion = $previous.runId; lastUpdateAt = $previous.downloadedAt }
try {
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw '未找到 GitHub CLI（gh），请先安装并登录。' }
  & gh auth status --hostname github.com *> $null
  if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI 尚未登录，请在终端完成 gh auth login 后重新启动。' }
  $encodedBranch = [Uri]::EscapeDataString($Branch)
  $runs = (Invoke-GhJson "repos/$Repository/actions/workflows/$Workflow/runs?branch=$encodedBranch&status=completed&per_page=20").workflow_runs
  $artifact = $null
  $run = $null
  foreach ($candidate in $runs) {
    $artifacts = (Invoke-GhJson "repos/$Repository/actions/runs/$($candidate.id)/artifacts").artifacts
    $artifact = $artifacts | Where-Object { -not $_.expired -and $_.name -like 'xuanpin-dashboard-*' } | Select-Object -First 1
    if ($artifact) { $run = $candidate; break }
  }
  if (-not $artifact) { throw '最近 20 次任务中没有可下载的构建产物。' }
  $updateStatus.latestRun = @{ id = $runs[0].id; conclusion = $runs[0].conclusion; url = $runs[0].html_url; createdAt = $runs[0].created_at }
  if ([string]$previous.runId -ne [string]$run.id) {
    if (Test-Path -LiteralPath $NextBuildDir) { Remove-Item -LiteralPath $NextBuildDir -Recurse -Force }
    New-Item -ItemType Directory -Path $NextBuildDir | Out-Null
    Write-Host "下载构建产物 $($artifact.name)..." -ForegroundColor Cyan
    & gh run download $run.id --repo $Repository --name $artifact.name --dir $NextBuildDir
    if ($LASTEXITCODE -ne 0) { throw '构建产物下载失败。' }
    foreach ($required in @('index.html', 'release.json', 'data/catalog.json', 'data/daily-sync.json')) {
      if (-not (Test-Path -LiteralPath (Join-Path $NextBuildDir $required))) { throw "构建产物缺少 $required" }
    }
    $catalog = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $NextBuildDir 'data/catalog.json') | ConvertFrom-Json
    if (-not $catalog.products -or -not $catalog.catalogHash) { throw '构建产物目录数据无效。' }
    $versionDir = Join-Path $BuildDir "versions/$($run.id)"
    Assert-ChildPath $versionDir
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $versionDir) | Out-Null
    if (Test-Path -LiteralPath $versionDir) { Remove-Item -LiteralPath $versionDir -Recurse -Force }
    Move-Item -LiteralPath $NextBuildDir -Destination $versionDir
    $previous = @{ runId = [string]$run.id; directory = "versions/$($run.id)"; downloadedAt = [DateTime]::UtcNow.ToString('o'); url = $run.html_url }
    Write-AtomicJson $CurrentFile $previous
    $updateStatus.lastUpdateAt = $previous.downloadedAt
    $updateStatus.buildVersion = $previous.runId
  }
  $updateStatus.updateStatus = if ($runs[0].id -ne $run.id) { 'latest-run-no-artifact' } else { 'current' }
  if ($runs[0].id -ne $run.id) { $updateStatus.error = '最新任务没有可用构建，保留前一次可用版本。' }
} catch {
  $updateStatus.updateStatus = 'failed'
  $updateStatus.error = $_.Exception.Message
  Write-Warning $updateStatus.error
  if (-not $previous) { Write-AtomicJson $StatusFile $updateStatus; throw }
  Write-Host '继续使用本机上次可用版本。' -ForegroundColor Yellow
}
Write-AtomicJson $StatusFile $updateStatus
} finally { $updateLock.Dispose() }
if ($UpdateOnly) { return }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw '未找到 Node.js，请先安装 Node.js 20 或更高版本。' }
if (-not (Test-LocalServer)) {
  $arguments = @('"' + $ServerScript + '"', '"' + $BuildDir + '"', $Port, '--auto-update')
  $server = Start-Process -FilePath 'node' -ArgumentList $arguments -WindowStyle Hidden -RedirectStandardOutput $OutputLogFile -RedirectStandardError $ErrorLogFile -PassThru
  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    Start-Sleep -Milliseconds 250
    if (Test-LocalServer) { $ready = $true; break }
    if ($server.HasExited) { break }
  }
  if (-not $ready) { throw "本地服务器未能启动，请查看 $ErrorLogFile" }
}
Write-Host "已打开可用版本 $($previous.runId)。本地服务每小时检查新版本。" -ForegroundColor Green
if (-not $NoOpen) { Start-Process $DashboardUrl }
