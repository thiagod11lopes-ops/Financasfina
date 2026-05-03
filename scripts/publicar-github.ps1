# Publica este projeto no GitHub (cria repositório remoto e faz push do ramo atual).
# Uso, na raiz do projeto:
#   powershell -ExecutionPolicy Bypass -File .\scripts\publicar-github.ps1
# Na primeira vez: login no browser com gh auth login.

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

if (-not (Test-Path (Join-Path $root ".git"))) {
  Write-Host "Pasta .git não encontrada em $root"
  exit 1
}

$ghPath = Join-Path ${env:ProgramFiles} "GitHub CLI\gh.exe"
if (Test-Path $ghPath) {
  $env:Path = "$(Split-Path $ghPath -Parent);$env:Path"
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "GitHub CLI (gh) não encontrado. Instale com: winget install GitHub.cli"
  exit 1
}

gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "`n=== Iniciar sessão no GitHub (abre o browser) ===`n"
  gh auth login -h github.com -p https -w
}

$defaultName = Split-Path $root -Leaf
$repoName = Read-Host "Nome do repositório no GitHub [Enter = '$defaultName']"
if ([string]::IsNullOrWhiteSpace($repoName)) { $repoName = $defaultName }

if (git remote get-url origin 2>$null) {
  Write-Host "Remote 'origin' já existe. A fazer push..."
  git push -u origin HEAD
} else {
  gh repo create $repoName --public --source=. --remote=origin --push
}

$user = gh api user --jq .login 2>$null
if ($user) {
  Write-Host "`nConcluído. Repositório: https://github.com/$user/$repoName"
} else {
  Write-Host "`nConcluído. Veja o repositório na sua conta em github.com"
}
