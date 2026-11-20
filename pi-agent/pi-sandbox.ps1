<#
.SYNOPSIS
    Launch an interactive shell inside a rootless, hardened Arch Linux Podman sandbox for Pi Coding Agent.

.DESCRIPTION
    Supports both an interactive prompt menu (when run with no arguments) and direct CLI flags.
    Drops into the image's default shell (Containerfile CMD, e.g. /bin/bash or /bin/zsh) so you can
    run `pi`, inspect diffs/outputs, or use forensics/dev tools before exiting.

    Defaults:
      - Mount mode:  rw (Read/Write workspace) | overlay (:O copy-on-write) | ro (Read-only)
                     add -Scratch with overlay/ro to mount a writable .scratch folder
      - Network:     host (Internet + local llama-swap on 127.0.0.1:8080)
                     or -Offline (NO internet, ONLY 127.0.0.1:8080 via pasta --splice-only)
      - Lifecycle:   ephemeral (--rm) unless -Name is given (persistent container with its own Pi sessions)
      - Cache:       pi-cache volume (:rw when online, :ro when -Offline)
      - Auth:        ~/.pi/agent/auth.json mounted :ro when online (omitted when -Offline)

.EXAMPLE
    .\pi-sandbox.ps1
    Launches the interactive configuration menu.

.EXAMPLE
    .\pi-sandbox.ps1 -Mode overlay -Offline
    Copy-on-write overlay (:O), NO internet, local llama-swap only, ephemeral (--rm).

.EXAMPLE
    .\pi-sandbox.ps1 -Mode rw -Name refactor-auth
    Creates a persistent container (pi-sbx-refactor-auth) with its own Pi sessions.

.EXAMPLE
    .\pi-sandbox.ps1 -Resume refactor-auth
    Re-enters the persistent container pi-sbx-refactor-auth (use /resume inside Pi to load a session).

.EXAMPLE
    .\pi-sandbox.ps1 -List
    Lists all persistent pi-sbx-* containers.
#>

#Requires -Version 7.0

[CmdletBinding(DefaultParameterSetName = "Run")]
param(
    [Parameter(ParameterSetName = "Run")]
    [ValidateSet("rw", "overlay", "ro")]
    [string]$Mode,

    [Parameter(ParameterSetName = "Run")]
    [switch]$Scratch,

    [Parameter(ParameterSetName = "Run")]
    [switch]$Offline,

    [Parameter(ParameterSetName = "Run")]
    [string]$Name,

    [Parameter(ParameterSetName = "Run")]
    [string]$Workspace = (Get-Location).Path,

    [Parameter(ParameterSetName = "Run")]
    [ValidateRange(1, 65535)]
    [int]$LlamaSwapPort = 8080,

    [Parameter(ParameterSetName = "Run")]
    [switch]$NoCache,

    [Parameter(ParameterSetName = "Run")]
    [Parameter(ParameterSetName = "Rebuild")]
    [ValidateNotNullOrEmpty()]
    [string]$Image = "localhost/pi-sandbox:latest",

    [Parameter(ParameterSetName = "Resume", Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Resume,

    [Parameter(ParameterSetName = "List")]
    [switch]$List,

    [Parameter(ParameterSetName = "Remove", Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Remove,

    [Parameter(ParameterSetName = "Rebuild")]
    [switch]$Rebuild,

    [Parameter(ParameterSetName = "Help")]
    [Alias("h")]
    [switch]$Help,

    [Parameter(ParameterSetName = "HelpArg", Position = 0, Mandatory = $true)]
    [ValidateSet("--help", "/?")]
    [string]$HelpArg
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

if ($Help -or $HelpArg) {
    Get-Help $PSCommandPath -Detailed
    exit 0
}

$ContainerPrefix = "pi-sbx-"

$podmanCmd = Get-Command podman -ErrorAction SilentlyContinue
if (-not $podmanCmd) {
    throw "Podman not found on PATH. Install via: winget install -e --id RedHat.Podman"
}
$Podman = $podmanCmd.Source

function Get-ContainerName([string]$ShortOrFull) {
    $ShortOrFull.StartsWith($ContainerPrefix) ? $ShortOrFull : "$ContainerPrefix$ShortOrFull"
}

function Ensure-PodmanMachine {
    if (-not ((& $Podman machine list --format "{{.Running}}" 2>$null) -match "true")) {
        Write-Host "Starting Podman machine..." -ForegroundColor Cyan
        & $Podman machine start | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "Failed to start Podman machine." }
    }
}

function Get-SandboxContainers {
    $lines = & $Podman ps -a --filter "name=^${ContainerPrefix}" --format "{{.Names}}|{{.Status}}|{{.CreatedHuman}}" 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Failed to list Podman containers." }
    $items = @()
    foreach ($line in $lines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $parts = $line -split "\|", 3
        if ($parts.Count -lt 3 -or -not $parts[0].StartsWith($ContainerPrefix)) { continue }
        $items += [PSCustomObject]@{
            FullName  = $parts[0]
            ShortName = $parts[0].Substring($ContainerPrefix.Length)
            Status    = $parts[1]
            Created   = $parts[2]
        }
    }
    return ,$items
}

function Resume-SandboxContainer([string]$Target) {
    $running = (& $Podman inspect -f "{{.State.Running}}" $Target 2>$null)
    if ($LASTEXITCODE -ne 0) {
        throw "Container '$Target' not found. Run '.\pi-sandbox.ps1 -List' to see available containers."
    }
    if (($running -join "").Trim() -eq "true") {
        Write-Host "Attaching to running container '$Target'..." -ForegroundColor Cyan
        & $Podman attach $Target
    } else {
        Write-Host "Resuming persistent container '$Target'..." -ForegroundColor Cyan
        & $Podman start -ai $Target
    }
    exit $LASTEXITCODE
}

Ensure-PodmanMachine

# --- Management subcommands ---
switch ($PSCmdlet.ParameterSetName) {
    "List" {
        $containers = Get-SandboxContainers
        if ($containers.Count -eq 0) {
            Write-Host "No persistent Pi sandbox containers found." -ForegroundColor Yellow
        } else {
            $containers | Format-Table -Property ShortName, FullName, Status, Created -AutoSize
        }
        exit 0
    }
    "Remove" {
        if ($Remove -eq "all") {
            $containers = Get-SandboxContainers
            $exitCode = 0
            foreach ($c in $containers) {
                Write-Host "Removing $($c.FullName)..." -ForegroundColor Yellow
                & $Podman rm -f $c.FullName | Out-Null
                if ($LASTEXITCODE -ne 0) { $exitCode = 1 }
            }
            Write-Host "Processed $($containers.Count) container(s)." -ForegroundColor ($exitCode -eq 0 ? "Green" : "Red")
            exit $exitCode
        }
        & $Podman rm -f (Get-ContainerName $Remove)
        exit $LASTEXITCODE
    }
    "Rebuild" {
        $containerfile = Join-Path $PSScriptRoot "Containerfile"
        if (-not (Test-Path -LiteralPath $containerfile)) { throw "Containerfile not found at $containerfile" }
        Write-Host "Building $Image from $containerfile..." -ForegroundColor Cyan
        & $Podman build -t $Image -f $containerfile $PSScriptRoot
        exit $LASTEXITCODE
    }
    "Resume" {
        Resume-SandboxContainer (Get-ContainerName $Resume)
    }
}

# --- Verify image exists ---
& $Podman image exists $Image 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "Image '$Image' not found. Build it first with: .\pi-sandbox.ps1 -Rebuild"
}

# --- Interactive menu when no primary flags were provided ---
$isInteractive = -not ($Mode -or $Offline -or $Name -or $Scratch)

if ($isInteractive) {
    $existing = Get-SandboxContainers
    Write-Host ""
    Write-Host "Pi Podman Sandbox" -ForegroundColor Cyan -NoNewline
    Write-Host "  ($Workspace)" -ForegroundColor DarkGray
    Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

    if ($existing.Count -gt 0) {
        Write-Host "Existing persistent containers:" -ForegroundColor Yellow
        for ($i = 0; $i -lt $existing.Count; $i++) {
            Write-Host ("  [{0}] {1} ({2})" -f ($i + 1), $existing[$i].ShortName, $existing[$i].Status)
        }
        while ($true) {
            $resumeChoice = ((Read-Host "Resume one by number, or press Enter for a new session") ?? "").Trim()
            if ([string]::IsNullOrEmpty($resumeChoice)) { break }
            if ($resumeChoice -match "^\d+$") {
                $idx = [int]$resumeChoice - 1
                if ($idx -ge 0 -and $idx -lt $existing.Count) {
                    Resume-SandboxContainer $existing[$idx].FullName
                }
            }
            Write-Host "Invalid selection. Enter 1-$($existing.Count) or press Enter for a new session." -ForegroundColor Yellow
        }
    }

    # 1. Internet access
    while ($true) {
        $netInput = ((Read-Host "Internet access? [Y/n] (n = offline + local llama-swap:$LlamaSwapPort only)") ?? "").Trim().ToLower()
        if ($netInput -in @("", "y", "yes")) { break }
        if ($netInput -in @("n", "no"))      { $Offline = $true; break }
        Write-Host "Invalid selection. Enter y (online) or n (offline)." -ForegroundColor Yellow
    }

    # 2. Mount mode (default: rw)
    Write-Host "Mount mode:  [1] Read/Write (default)  [2] Overlay (:O)  [3] Read-only (:ro)"
    while (-not $Mode) {
        $modeInput = ((Read-Host "Choose [1-3] (default 1)") ?? "").Trim().ToLower()
        switch ($modeInput) {
            { $_ -in @("", "1", "rw") }  { $Mode = "rw" }
            { $_ -in @("2", "overlay") } { $Mode = "overlay" }
            { $_ -in @("3", "ro") }      { $Mode = "ro" }
            default { Write-Host "Invalid selection. Enter 1 (rw), 2 (overlay), or 3 (ro)." -ForegroundColor Yellow }
        }
    }

    if ($Mode -ne "rw") {
        $scratchInput = ((Read-Host "Mount writable .scratch folder? [y/N]") ?? "").Trim().ToLower()
        if ($scratchInput -in @("y", "yes")) { $Scratch = $true }
    }

    # 3. Lifecycle (blank = ephemeral --rm, name = persistent container)
    $Name = ((Read-Host "Container name (leave blank for ephemeral --rm)") ?? "").Trim()
}

if (-not $Mode) { $Mode = "rw" }

$resolvedWorkspace = (Resolve-Path -LiteralPath $Workspace).Path
if (-not (Test-Path -LiteralPath $resolvedWorkspace -PathType Container)) {
    throw "Workspace path '$resolvedWorkspace' is not a directory."
}

# --- Build podman run arguments ---
$podmanArgs = @(
    "run", "-it", "--init",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--ulimit=nproc=512:512"
)

# Lifecycle
if ($Name) {
    $fullName = Get-ContainerName $Name
    $podmanArgs += @("--name", $fullName)
    $lifecycleSummary = "persistent ($fullName)"
} else {
    $podmanArgs += "--rm"
    $lifecycleSummary = "ephemeral (--rm)"
}

# Networking
if ($Offline) {
    $podmanArgs += "--network=pasta:--splice-only,-T,$LlamaSwapPort"
    $podmanArgs += @("-e", "UV_OFFLINE=1", "-e", "HF_HUB_OFFLINE=1")
    $netSummary = "offline (NO internet; ONLY localhost:$LlamaSwapPort)"
} else {
    $podmanArgs += "--network=host"
    $netSummary = "host (internet + localhost:$LlamaSwapPort)"
}

# Shared Linux cache volume (uv wheels, docling/HF models)
# Online: :rw so downloaded wheels/models persist. Offline: :ro (named volumes do not support :O overlay).
if (-not $NoCache) {
    $cacheFlag = $Offline ? "ro" : "rw"
    $podmanArgs += @("-v", "pi-cache:/home/pi/.cache:$cacheFlag")
}

# Auth mount (read-only; omitted in -Offline mode)
$authPath = Join-Path $HOME ".pi\agent\auth.json"
$authMounted = $false
if (-not $Offline -and (Test-Path -LiteralPath $authPath -PathType Leaf)) {
    $podmanArgs += @("-v", "${authPath}:/home/pi/.pi/agent/auth.json:ro")
    $authMounted = $true
}

# Workspace mount (mounted under /workspace/<dir-name> so shell prompt shows the repo name)
$wsName = Split-Path -Path $resolvedWorkspace -Leaf
if ([string]::IsNullOrWhiteSpace($wsName) -or $wsName -eq "\") { $wsName = "root" }
$containerWorkspace = "/workspace/$wsName"

$wsFlag = switch ($Mode) {
    "rw"      { "rw" }
    "overlay" { "O" }
    "ro"      { "ro" }
}
$podmanArgs += @("-v", "${resolvedWorkspace}:${containerWorkspace}:${wsFlag}", "-w", $containerWorkspace)
$mountSummary = "$Mode (${containerWorkspace}:${wsFlag})"
if ($Scratch -and $Mode -ne "rw") {
    $scratchDir = Join-Path $resolvedWorkspace ".scratch"
    New-Item -ItemType Directory -Force -Path $scratchDir | Out-Null
    $podmanArgs += @("-v", "${scratchDir}:${containerWorkspace}/.scratch:rw")
    $mountSummary = "$Mode (${containerWorkspace}:${wsFlag} + .scratch:rw)"
}

# Prompt metadata for ~/.zshrc
$sandboxName = $Name ? (Get-ContainerName $Name).Substring($ContainerPrefix.Length) : "sandbox"
$sandboxMode = $Mode + (($Scratch -and $Mode -ne "rw") ? "+scratch" : "") + ($Offline ? "|offline" : "")
$podmanArgs += @("-e", "SANDBOX_NAME=$sandboxName", "-e", "SANDBOX_MODE=$sandboxMode")

# Uses the image's default CMD (e.g. /bin/zsh from Containerfile)
$podmanArgs += $Image

# --- Summary Banner ---
$cacheSummary = $NoCache ? "off" : $cacheFlag
$authSummary = $authMounted ? "ro" : "none"

Write-Host ""
Write-Host "Launching Pi Sandbox:" -ForegroundColor Green
Write-Host "  Workspace:  $resolvedWorkspace"
Write-Host "  Mount:      $mountSummary"
Write-Host "  Network:    $netSummary"
Write-Host "  Lifecycle:  $lifecycleSummary"
Write-Host "  Cache/Auth: cache=$cacheSummary, auth.json=$authSummary"
Write-Host ""

& $Podman @podmanArgs
exit $LASTEXITCODE
