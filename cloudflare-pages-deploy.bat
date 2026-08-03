@echo off
setlocal

set "ROOT=%~dp0"
set "OUT=%ROOT%unpackage\dist\build\web"
set "CF=%ROOT%cloudflare-pages"

if not exist "%OUT%\index.html" (
  echo Build output not found: %OUT%
  echo Please build the web version in HBuilderX first.
  exit /b 1
)

copy /Y "%CF%\_headers" "%OUT%\_headers" >nul

echo Cloudflare Pages files prepared in:
echo %OUT%
echo.
echo Upload this folder in Cloudflare Pages, or deploy with:
echo npx wrangler pages deploy "%OUT%"
