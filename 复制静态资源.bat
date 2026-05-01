@echo off
title 文件复制工具（覆盖同名文件）

:: ==================== 请在这里设置您的目录路径 ====================
set "源目录=D:\projects\personalweb\personalweb\static"
set "目标目录=D:\projects\personalweb\personalweb\unpackage\dist\build\web\static"
:: ================================================================

:: 检查源目录是否存在
if not exist "%源目录%\" (
    echo 错误：源目录 "%源目录%" 不存在！
    echo 请检查脚本中的「源目录」路径是否正确。
    pause
    exit /b 1
)

:: 如果目标目录不存在，则自动创建
if not exist "%目标目录%\" (
    echo 目标目录不存在，正在创建：%目标目录%
    mkdir "%目标目录%"
)

:: 执行复制（覆盖同名文件）
echo 正在从 "%源目录%" 复制到 "%目标目录%" ...
xcopy "%源目录%\*" "%目标目录%\" /E /Y /I /C

:: 判断复制结果
if %errorlevel% equ 0 (
    echo 复制成功完成！
) else (
    echo 复制过程中出现错误（错误代码：%errorlevel%），请检查权限或路径。
)

echo.
echo 按任意键退出...
pause >nul
exit /b