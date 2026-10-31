@echo off
chcp 65001 >nul
title Linsssside
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="

if not exist "dist\index.html" goto nobuild
if not exist "node_modules\electron\dist\electron.exe" goto noruntime

start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
exit /b 0

:nobuild
echo.
echo   界面文件还没构建（dist 目录不存在）。
echo   在这台机器上执行：pnpm install ^&^& pnpm build
echo.
pause
exit /b 1

:noruntime
echo.
echo   找不到 Electron 运行时（node_modules\electron）。
echo   在项目目录执行：pnpm install
echo.
pause
exit /b 1
