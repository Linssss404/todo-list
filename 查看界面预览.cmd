@echo off
chcp 65001 >nul
title Linsssside 界面预览
cd /d "%~dp0"

if not exist "preview\index.html" (
  echo.
  echo   预览页还没生成。在项目目录执行：pnpm preview
  echo.
  pause
  exit /b 1
)

start "" "%~dp0preview\index.html"
