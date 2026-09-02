@echo off
chcp 65001 >nul
setlocal
set "PROJECT_DIR=%~dp0"

echo 正在获取最新版选品站，请稍候...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%scripts\start_latest_dashboard.ps1"

if errorlevel 1 (
  echo.
  echo 启动失败，请查看上面的错误信息。
  pause
  exit /b 1
)

endlocal
