@echo off
chcp 65001 >nul
title 跨境智卖 - 开发服务器

echo ============================
echo   跨境智卖 开发服务器启动中...
echo ============================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo [1/2] 正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装失败！
        pause
        exit /b 1
    )
    echo.
)

echo [2/2] 启动开发服务器...
echo 访问地址: http://localhost:3000
echo.
echo 按 Ctrl+C 可停止服务器
echo.

call npm run dev

pause
