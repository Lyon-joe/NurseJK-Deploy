$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeCandidates = @(
  "node",
  "$env:LOCALAPPDATA\OpenAI\Codex\bin\node.exe"
)

$nodePath = $null

foreach ($candidate in $nodeCandidates) {
  $command = Get-Command $candidate -ErrorAction SilentlyContinue

  if ($command) {
    $nodePath = $command.Source
    break
  }
}

if (-not $nodePath) {
  throw "Node.js was not found. Install Node.js or use the Codex bundled Node at $env:LOCALAPPDATA\OpenAI\Codex\bin\node.exe."
}

Set-Location "$projectRoot\backend"
& $nodePath "server.js"
