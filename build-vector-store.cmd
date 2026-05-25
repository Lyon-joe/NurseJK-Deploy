@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
set "CODEX_NODE=%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe"

where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
  set "NODE_EXE=node"
) else if exist "%CODEX_NODE%" (
  set "NODE_EXE=%CODEX_NODE%"
) else (
  echo Node.js was not found.
  echo Install Node.js or use the Codex bundled Node at:
  echo %CODEX_NODE%
  exit /b 1
)

cd /d "%PROJECT_ROOT%backend"
"%NODE_EXE%" "--use-system-ca" "scripts\buildVectorStore.js"
