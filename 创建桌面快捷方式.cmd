@echo off
chcp 65001 >nul
title 创建桌面快捷方式
cd /d "%~dp0"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $desktop = [Environment]::GetFolderPath('Desktop'); $lnk = $ws.CreateShortcut((Join-Path $desktop 'Linsssside.lnk')); $lnk.TargetPath = Join-Path (Get-Location) '启动 Linsssside.cmd'; $lnk.WorkingDirectory = (Get-Location).Path; $lnk.IconLocation = Join-Path (Get-Location) 'build\icon.ico'; $lnk.Description = 'Linsssside 个人生活助手'; $lnk.Save(); Write-Host '桌面快捷方式已创建'"

echo.
pause
