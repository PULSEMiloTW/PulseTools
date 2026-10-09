$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
Set-Location -LiteralPath $projectRoot
$nodeVersion = & node --version
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v24\.') { throw '請先安裝 Node.js 24 LTS。' }
& npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci 失敗。' }
if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
& npm.cmd run check
if ($LASTEXITCODE -ne 0) { throw '必要檢查失敗。' }
Write-Host '安裝與離線檢查完成。請在本機填入 .env、準備 PostgreSQL，再依文件執行 migration 及指令註冊。'
