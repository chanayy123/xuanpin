param(
  [string]$Repository = 'chanayy123/xuanpin',
  [string]$Workflow = 'sync-catalog.yml',
  [string]$Branch = 'feature/catalog-sync-dashboard',
  [int]$Port = 4173
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BuildDir = Join-Path $ProjectRoot '.local-build'
$NextBuildDir = Join-Path $ProjectRoot '.local-build-next'
$PidFile = Join-Path $ProjectRoot '.local-build-server.pid'
$OutputLogFile = Join-Path $ProjectRoot '.local-build-server.log'
$ErrorLogFile = Join-Path $ProjectRoot '.local-build-server.error.log'
$ServerScript = Join-Path $PSScriptRoot 'serve_dist.js'
$DashboardUrl = "http://127.0.0.1:$Port/"

function Assert-ChildPath {
  param([string]$Candidate)
  $root = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  $resolved = [IO.Path]::GetFullPath($Candidate)
  if (-not $resolved.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
    throw "拒绝操作项目目录以外的路径：$resolved"
  }
}

function Test-LocalServer {
  try {
    $response = Invoke-WebRequest -Uri $DashboardUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw '未找到 GitHub CLI（gh）。请先安装：https://cli.github.com/'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw '未找到 Node.js。请先安装 Node.js 20 或更高版本：https://nodejs.org/'
}

& gh auth status --hostname github.com *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host '首次使用需要登录 GitHub，浏览器将打开授权页面。' -ForegroundColor Yellow
  & gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) { throw 'GitHub 登录未完成。' }
}

Write-Host "查找 $Branch 分支最新的成功构建..." -ForegroundColor Cyan
$runsJson = & gh run list --repo $Repository --workflow $Workflow --branch $Branch --status success --limit 1 --json databaseId,createdAt,headBranch,displayTitle
if ($LASTEXITCODE -ne 0) { throw '读取 GitHub Actions 运行记录失败。' }
$runs = @($runsJson | ConvertFrom-Json)
if ($runs.Count -eq 0) {
  throw "尚未找到成功构建。请确认新分支已推送，并等待 GitHub Actions 完成后重试。"
}
$run = $runs[0]

$artifactsJson = & gh api "repos/$Repository/actions/runs/$($run.databaseId)/artifacts"
if ($LASTEXITCODE -ne 0) { throw '读取构建产物列表失败。' }
$artifact = ($artifactsJson | ConvertFrom-Json).artifacts |
  Where-Object { -not $_.expired -and $_.name -like 'xuanpin-dashboard-*' } |
  Select-Object -First 1
if (-not $artifact) { throw '最新成功任务中没有可下载的选品站构建产物。' }

Assert-ChildPath $NextBuildDir
Assert-ChildPath $BuildDir
if (Test-Path -LiteralPath $NextBuildDir) {
  Remove-Item -LiteralPath $NextBuildDir -Recurse -Force
}
New-Item -ItemType Directory -Path $NextBuildDir | Out-Null

Write-Host "下载构建产物 $($artifact.name)..." -ForegroundColor Cyan
& gh run download $run.databaseId --repo $Repository --name $artifact.name --dir $NextBuildDir
if ($LASTEXITCODE -ne 0) { throw '构建产物下载失败。' }
if (-not (Test-Path -LiteralPath (Join-Path $NextBuildDir 'index.html'))) {
  throw '构建产物校验失败：缺少 index.html。'
}

if (Test-Path -LiteralPath $BuildDir) {
  Remove-Item -LiteralPath $BuildDir -Recurse -Force
}
Move-Item -LiteralPath $NextBuildDir -Destination $BuildDir

if (-not (Test-LocalServer)) {
  if (Test-Path -LiteralPath $PidFile) {
    $oldPid = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue
    if ($oldPid -match '^\d+$') {
      Stop-Process -Id ([int]$oldPid) -ErrorAction SilentlyContinue
    }
  }
  $server = Start-Process -FilePath 'node' `
    -ArgumentList @($ServerScript, $BuildDir, $Port) `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutputLogFile `
    -RedirectStandardError $ErrorLogFile `
    -PassThru
  Set-Content -LiteralPath $PidFile -Value $server.Id -Encoding ascii

  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    Start-Sleep -Milliseconds 250
    if (Test-LocalServer) { $ready = $true; break }
    if ($server.HasExited) { break }
  }
  if (-not $ready) {
    throw "本地服务器未能启动，请查看日志：$ErrorLogFile"
  }
}

Write-Host "已更新到 GitHub Actions 构建：$($run.displayTitle)（$($run.createdAt)）" -ForegroundColor Green
Write-Host "正在打开 $DashboardUrl" -ForegroundColor Green
Start-Process $DashboardUrl
