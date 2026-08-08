# Meme enchainement que le test manuel PowerShell dans C:\CarHunter-app
$ErrorActionPreference = "Stop"

$app = "C:\CarHunter-app"
$base = "C:\CarHunter"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host ">>> $Message"
}

Write-Step "CarHunter hunt-browser - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

if (-not (Test-Path "$base\.env")) {
    throw "Fichier manquant: C:\CarHunter\.env - cree-le comme en test manuel."
}

Write-Step "Sync repo vers $app"
if (-not (Test-Path "$app\.git")) {
    git clone https://github.com/m1dalee/CarHunter.git $app
}
Set-Location $app
git fetch origin main
git reset --hard origin/main
Write-Host "Commit: $(git rev-parse --short HEAD)"

Write-Step "Copie config persistante"
New-Item -ItemType Directory -Force -Path "$base\data" | Out-Null
Copy-Item "$base\.env" .env -Force
if (Test-Path "$base\data\seen.json") {
    New-Item -ItemType Directory -Force -Path data | Out-Null
    Copy-Item "$base\data\seen.json" data\seen.json -Force
}

Get-Content .env | ForEach-Object {
    if ($_ -match "^(TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID|BROWSER_PROFILE_DIR|BROWSER_HEADLESS|BROWSER_CHANNEL)=") {
        if ($_ -match "TOKEN") {
            Write-Host ($_.Split("=")[0] + "=***")
        } else {
            Write-Host $_
        }
    }
}

Write-Step "Node $(node -v) / npm $(npm -v)"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js introuvable dans le PATH - installe Node 20+ ou relance run.cmd depuis une session ou node fonctionne."
}

Write-Step "npm ci"
npm ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$playwrightBrowsers = Join-Path $env:LOCALAPPDATA "ms-playwright"
$hasChromium = $false
if (Test-Path $playwrightBrowsers) {
    $hasChromium = @(Get-ChildItem -Path $playwrightBrowsers -Directory -Filter "chromium-*" -ErrorAction SilentlyContinue).Count -gt 0
}

if (-not $hasChromium) {
    Write-Step "Installation Playwright Chromium"
    npx --yes playwright install chromium
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Host "Playwright Chromium deja installe - skip"
}

$profileLine = Get-Content .env | Where-Object { $_ -match "^BROWSER_PROFILE_DIR=" } | Select-Object -First 1
if ($profileLine) {
    $profileDir = $profileLine.Split("=", 2)[1].Trim()
    if ($profileDir -and (Test-Path $profileDir)) {
        Write-Host "Profil navigateur: $profileDir"
    } elseif ($profileDir) {
        Write-Host "ATTENTION: profil navigateur absent, creation: $profileDir"
        New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
    }
}

$chrome = Get-Process chrome -ErrorAction SilentlyContinue
if ($chrome) {
    Write-Host "ATTENTION: Chrome deja ouvert ($($chrome.Count) processus). Ferme Chrome si le hunt echoue (verrou profil)."
}

if (-not $env:HUNT_SITES) {
    $env:HUNT_SITES = "leboncoin,lacentrale"
}

Write-Step "npm run hunt (HUNT_SITES=$($env:HUNT_SITES))"
npm run hunt
$exitCode = $LASTEXITCODE

Write-Step "Sauvegarde seen.json"
if (Test-Path data\seen.json) {
    Copy-Item data\seen.json "$base\data\seen.json" -Force
    Write-Host "OK - data\seen.json copie vers C:\CarHunter\data\"
}

Write-Host ""
Write-Host "Termine - code sortie: $exitCode"
exit $exitCode
