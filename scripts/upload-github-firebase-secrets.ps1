# Envia as variáveis VITE_FIREBASE_* do .env local para os Secrets do repositório GitHub
# (para o workflow Deploy GitHub Pages fazer build com Firebase).
#
# Requisitos: GitHub CLI instalado e sessão iniciada (`gh auth login`).
# Uso: na raiz do projeto:
#   powershell -ExecutionPolicy Bypass -File .\scripts\upload-github-firebase-secrets.ps1

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

$ghPath = Join-Path ${env:ProgramFiles} "GitHub CLI\gh.exe"
if (Test-Path $ghPath) {
  $env:Path = "$(Split-Path $ghPath -Parent);$env:Path"
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "Instale o GitHub CLI: winget install GitHub.cli"
  exit 1
}

$null = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Execute primeiro no terminal: gh auth login"
  exit 1
}

$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) {
  Write-Host "Ficheiro .env não encontrado em $envFile"
  exit 1
}

$lines = Get-Content $envFile -Encoding UTF8
$map = @{}
foreach ($line in $lines) {
  $t = $line.Trim()
  if ($t -eq "" -or $t.StartsWith("#")) { continue }
  $i = $t.IndexOf("=")
  if ($i -lt 1) { continue }
  $k = $t.Substring(0, $i).Trim()
  $v = $t.Substring($i + 1).Trim().Trim('"')
  $v = ($v -replace "[\t\r\n]+", "").Trim()
  if ($k.StartsWith("VITE_FIREBASE_")) {
    $map[$k] = $v
  }
}

$required = @(
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
)

foreach ($name in $required) {
  if (-not $map[$name] -or $map[$name] -eq "") {
    Write-Host "Em falta no .env: $name"
    exit 1
  }
  Write-Host "A definir secret: $name"
  $map[$name] | gh secret set $name
}

Write-Host "`nSecrets atualizados. Faça push para disparar o Deploy GitHub Pages."
