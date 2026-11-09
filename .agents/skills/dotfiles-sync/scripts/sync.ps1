# Dotfiles synchronization script for Pi Agent and Antigravity
param(
    [switch]$SkipNpm = $false
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
$piSource = Join-Path $repoRoot "pi-agent\Pi_Config\agent"
$piTarget = Join-Path $HOME ".pi\agent"
$geminiTarget = Join-Path $HOME ".gemini\config\skills"

Write-Host "Syncing from repository root: $repoRoot"

# 1. Ensure target directories exist
if (!(Test-Path $piTarget)) {
    New-Item -ItemType Directory -Path $piTarget -Force | Out-Null
}
if (!(Test-Path $geminiTarget)) {
    New-Item -ItemType Directory -Path $geminiTarget -Force | Out-Null
}

# 2. Clean up any stray root files in gemini skills
$straySkill = Join-Path $geminiTarget "SKILL.md"
if (Test-Path $straySkill) {
    Remove-Item $straySkill -Force
}

# 3. Sync all configuration, extensions, prompts, and skills to Pi Agent
Write-Host "Syncing to Pi Agent ($piTarget)..."
Copy-Item -Path (Join-Path $piSource "*") -Destination $piTarget -Recurse -Force

# 4. Sync portable skills to Antigravity global custom skills
Write-Host "Syncing portable skills to Antigravity ($geminiTarget)..."
$portableSkills = Get-ChildItem -Directory (Join-Path $piSource "skills")

foreach ($skill in $portableSkills) {
    $dest = Join-Path $geminiTarget $skill.Name
    Copy-Item -Path $skill.FullName -Destination $dest -Recurse -Force
}

# 5. Optional NPM install for Pi Agent extensions
if (-not $SkipNpm) {
    $npmDir = Join-Path $piTarget "npm"
    if (Test-Path (Join-Path $npmDir "package.json")) {
        Write-Host "Installing NPM dependencies for Pi Agent extensions in $npmDir..."
        npm --prefix $npmDir install --no-fund --no-audit
    }
}

# 6. Verification
Write-Host "`n=== Verification ==="
Write-Host "Antigravity skills count: $((Get-ChildItem -Directory $geminiTarget).Count)"
Get-ChildItem -Directory $geminiTarget | Select-Object -ExpandProperty Name

Write-Host "`nPi Agent skills count: $((Get-ChildItem -Directory (Join-Path $piTarget 'skills')).Count)"
Get-ChildItem -Directory (Join-Path $piTarget "skills") | Select-Object -ExpandProperty Name
