$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
Set-Location -LiteralPath $projectRoot
Write-Host 'PulseTools | Powered by Pulse Studio'
Write-Host '此控制台由你手動管理。按 Ctrl+C 停止；停止後再雙擊根目錄啟動檔即可重啟。'
Write-Host ''
if (-not (Test-Path -LiteralPath 'node_modules\tsx')) { throw '請先執行 deploy\windows\install.ps1 安裝依賴。' }
$nodeVersion = & node --version
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v24\.') { throw '請安裝 Node.js 24 LTS。' }
if (-not (Test-Path -LiteralPath '.env')) { throw '請先依 docs\WINDOWS_SETUP.md 建立本機 .env。' }
& node --import tsx scripts/doctor.ts
if ($LASTEXITCODE -ne 0) { throw '本機環境檢查失敗，未啟動 Bot。' }
Write-Host '正在編譯最新程式…'
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw '編譯失敗，未啟動 Bot。' }
Write-Host '正在啟動 Bot；按 Ctrl+C 停止。'
# 直接執行 Node，避免 npm 的額外 cmd 包裝影響 Ctrl+C 與退出碼。
& node dist/apps/bot/src/main.js
if ($LASTEXITCODE -ne 0) { throw 'Bot 以錯誤狀態結束，請檢查安全錯誤代碼與本機設定。' }
