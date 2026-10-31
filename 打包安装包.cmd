@echo off
chcp 65001 >nul
title 打包 Linsssside
cd /d "%~dp0"

echo 正在构建界面并打包 Windows 安装包...
echo 首次运行会下载打包工具，可能需要几分钟，请耐心等待。
echo.

call pnpm build
if errorlevel 1 goto fail

call pnpm exec electron-builder --win nsis portable
if errorlevel 1 goto fail

echo.
echo 打包完成，安装包在 release\ 目录里。
start "" "%~dp0release"
pause
exit /b 0

:fail
echo.
echo 打包失败。请确认已安装 Node.js 和 pnpm，并且网络能访问 npm 源。
pause
exit /b 1
