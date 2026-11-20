<#
.SYNOPSIS
    Unit tests for pi-sandbox.ps1 using a mocked podman shim on PATH.

.EXAMPLE
    pwsh -NoProfile -File .\pi-sandbox.Tests.ps1
#>

#Requires -Version 7.0
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ScriptPath = Join-Path $PSScriptRoot "pi-sandbox.ps1"
if (-not (Test-Path -LiteralPath $ScriptPath)) { throw "Cannot find '$ScriptPath'" }

$TestRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("pi-sandbox-tests-" + [guid]::NewGuid().ToString("N"))
$BinDir   = Join-Path $TestRoot "bin"
$LogFile  = Join-Path $TestRoot "podman-calls.jsonl"
$WorkDir  = Join-Path $TestRoot "workspace"
New-Item -ItemType Directory -Force -Path $BinDir, $WorkDir | Out-Null

# Mock podman.ps1 shim: logs every invocation as JSON and returns scripted responses via PI_MOCK_* env vars.
$MockPodman = @'
Add-Content -LiteralPath $env:PI_TEST_LOG -Value (ConvertTo-Json -InputObject @($args) -Compress) -Encoding UTF8
switch ($args[0]) {
    "machine" {
        if ($args[1] -eq "list") { ($env:PI_MOCK_MACHINE_RUNNING ?? "true") -split "`n"; exit 0 }
        exit [int]($env:PI_MOCK_MACHINE_START_EXIT ?? 0)
    }
    "image"   { exit [int]($env:PI_MOCK_IMAGE_EXISTS_EXIT ?? 0) }
    "ps"      {
        $code = [int]($env:PI_MOCK_PS_EXIT ?? 0)
        if ($code -eq 0 -and $env:PI_MOCK_PS_OUTPUT) { $env:PI_MOCK_PS_OUTPUT -split "`n" }
        exit $code
    }
    "inspect" {
        $code = [int]($env:PI_MOCK_INSPECT_EXIT ?? 0)
        if ($code -eq 0 -and $env:PI_MOCK_INSPECT_OUTPUT) { $env:PI_MOCK_INSPECT_OUTPUT }
        exit $code
    }
    "rm"      {
        if ($env:PI_MOCK_RM_FAIL_TARGET -and $args[-1] -eq $env:PI_MOCK_RM_FAIL_TARGET) { exit 1 }
        exit [int]($env:PI_MOCK_RM_EXIT ?? 0)
    }
    default   { exit 0 }
}
'@
Set-Content -LiteralPath (Join-Path $BinDir "podman.ps1") -Value $MockPodman -Encoding UTF8

$script:Passed = 0
$script:Failed = 0

function Reset-MockState {
    if (Test-Path -LiteralPath $LogFile) { Remove-Item -LiteralPath $LogFile -Force }
    $env:PI_TEST_LOG = $LogFile
    Remove-Item Env:\PI_MOCK_* -ErrorAction SilentlyContinue
}

function Get-PodmanCalls([string]$Command) {
    if (-not (Test-Path -LiteralPath $LogFile)) { return ,@() }
    $matched = @()
    foreach ($line in (Get-Content -LiteralPath $LogFile -Encoding UTF8)) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $call = @(ConvertFrom-Json -InputObject $line)
        if (-not $Command -or ($call.Count -gt 0 -and $call[0] -eq $Command)) { $matched += ,$call }
    }
    return ,$matched
}

function Get-PodmanCall([string]$Command) {
    $calls = Get-PodmanCalls $Command
    return $calls.Count -gt 0 ? $calls[0] : $null
}

function Invoke-Sandbox([hashtable]$Params, [string]$ExpectError) {
    $global:LASTEXITCODE = 0
    if ($ExpectError) {
        try {
            $null = & $ScriptPath @Params 6>&1 3>&1 2>&1
        } catch {
            if ($ExpectError -ne "*" -and $_.Exception.Message -notmatch $ExpectError) {
                throw "Expected error matching '$ExpectError', got: $($_.Exception.Message)"
            }
            return
        }
        throw "Expected error matching '$ExpectError', but command succeeded."
    }
    $out = (& $ScriptPath @Params 6>&1 3>&1 2>&1) | Out-String
    [PSCustomObject]@{ ExitCode = $LASTEXITCODE; Output = $out }
}

function Invoke-SandboxInteractive([string[]]$InputLines, [string]$WorkingDir = $WorkDir) {
    $out = ($InputLines | pwsh -NoProfile -File $ScriptPath -Workspace $WorkingDir 2>&1) | Out-String
    [PSCustomObject]@{ ExitCode = $LASTEXITCODE; Output = $out }
}

function Assert-True([bool]$Cond, [string]$Msg)         { if (-not $Cond) { throw "Assertion failed: $Msg" } }
function Assert-Equal($Actual, $Expected, [string]$Msg) { if ($Actual -ne $Expected) { throw "Assertion failed ($Msg): expected '$Expected', got '$Actual'" } }
function Assert-Contains([string[]]$Arr, [string]$Val, [string]$Msg)    { if ($Arr -notcontains $Val) { throw "Assertion failed ($Msg): missing '$Val' in: $($Arr -join ' ')" } }
function Assert-NotContains([string[]]$Arr, [string]$Val, [string]$Msg) { if ($Arr -contains $Val)    { throw "Assertion failed ($Msg): unexpected '$Val' in: $($Arr -join ' ')" } }
function Assert-ArgPair([string[]]$Arr, [string]$Flag, [string]$Val, [string]$Msg) {
    for ($i = 0; $i -lt ($Arr.Count - 1); $i++) { if ($Arr[$i] -eq $Flag -and $Arr[$i + 1] -eq $Val) { return } }
    throw "Assertion failed ($Msg): missing '$Flag $Val' in: $($Arr -join ' ')"
}

function Test-Case([string]$Name, [scriptblock]$Body) {
    Reset-MockState
    try {
        & $Body
        $script:Passed++
        Write-Host "  [PASS] $Name" -ForegroundColor Green
    } catch {
        $script:Failed++
        Write-Host "  [FAIL] $Name" -ForegroundColor Red
        Write-Host "         $($_.Exception.Message)" -ForegroundColor DarkRed
    }
}

$OrigPath = $env:PATH
$env:PATH = "$BinDir;$OrigPath"

Write-Host "`nRunning pi-sandbox.ps1 unit tests..." -ForegroundColor Cyan

try {
    Test-Case "-Help, -h, --help, and /? print detailed help without invoking podman" {
        $invocations = @(
            { & $ScriptPath -Help },
            { & $ScriptPath -h },
            { & $ScriptPath --help },
            { & $ScriptPath /? }
        )
        foreach ($inv in $invocations) {
            Reset-MockState
            $out = (& $inv 6>&1 3>&1 2>&1) | Out-String
            Assert-Equal $LASTEXITCODE 0 "ExitCode for $inv"
            Assert-True ($out -match "SYNOPSIS") "help output contains SYNOPSIS for $inv"
            Assert-Equal (Get-PodmanCalls).Count 0 "no podman calls for $inv"
        }
    }

    Test-Case "Default CLI run (-Mode rw) produces hardened ephemeral args using image default CMD" {
        $res = Invoke-Sandbox @{ Mode = "rw"; Workspace = $WorkDir }
        Assert-Equal $res.ExitCode 0 "ExitCode"

        $run = Get-PodmanCall "run"
        Assert-Contains $run "-it" "tty"
        Assert-Contains $run "--init" "init"
        Assert-Contains $run "--cap-drop=ALL" "drop caps"
        Assert-Contains $run "--security-opt=no-new-privileges" "no-new-privileges"
        Assert-Contains $run "--ulimit=nproc=512:512" "nproc limit"
        Assert-Contains $run "--rm" "ephemeral"
        Assert-Contains $run "--network=host" "host network"
        Assert-True (($run -join " ") -notmatch "pi-sessions") "no shared pi-sessions volume"
        Assert-ArgPair $run "-v" "pi-cache:/home/pi/.cache:rw" "rw cache"
        Assert-ArgPair $run "-v" "${WorkDir}:/workspace/workspace:rw" "rw workspace"
        Assert-ArgPair $run "-w" "/workspace/workspace" "workdir"
        Assert-ArgPair $run "-e" "SANDBOX_NAME=sandbox" "default SANDBOX_NAME"
        Assert-ArgPair $run "-e" "SANDBOX_MODE=rw" "default SANDBOX_MODE"
        Assert-Equal $run[-1] "localhost/pi-sandbox:latest" "ends with image (uses Containerfile CMD)"
    }

    Test-Case "-Offline + -Mode overlay uses pasta, :ro cache, and pure :O workspace (no .scratch)" {
        $ws = Join-Path $TestRoot "ws-overlay"
        New-Item -ItemType Directory -Force -Path $ws | Out-Null
        $null = Invoke-Sandbox @{ Mode = "overlay"; Offline = $true; LlamaSwapPort = 9090; Workspace = $ws }

        $run = Get-PodmanCall "run"
        Assert-Contains $run "--network=pasta:--splice-only,-T,9090" "pasta offline network"
        Assert-ArgPair $run "-e" "UV_OFFLINE=1" "UV_OFFLINE"
        Assert-ArgPair $run "-e" "HF_HUB_OFFLINE=1" "HF_HUB_OFFLINE"
        Assert-ArgPair $run "-v" "pi-cache:/home/pi/.cache:ro" "ro cache"
        Assert-ArgPair $run "-v" "${ws}:/workspace/ws-overlay:O" "overlay workspace"
        Assert-ArgPair $run "-w" "/workspace/ws-overlay" "workdir"
        Assert-ArgPair $run "-e" "SANDBOX_MODE=overlay|offline" "offline overlay mode env"
        Assert-True (($run -join " ") -notmatch "auth\.json") "auth.json omitted in offline mode"
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $ws ".scratch"))) "does not pollute repo with .scratch"
    }

    Test-Case "-Mode ro + -NoCache mounts workspace :ro and omits pi-cache" {
        $null = Invoke-Sandbox @{ Mode = "ro"; NoCache = $true; Workspace = $WorkDir }

        $run = Get-PodmanCall "run"
        Assert-ArgPair $run "-v" "${WorkDir}:/workspace/workspace:ro" "ro workspace"
        Assert-True (($run -join " ") -notmatch "pi-cache") "pi-cache omitted"
    }

    Test-Case "-Scratch creates and mounts .scratch:rw in overlay and ro modes, skipped in rw" {
        foreach ($mode in @("overlay", "ro")) {
            Reset-MockState
            $ws = Join-Path $TestRoot "ws-scratch-$mode"
            New-Item -ItemType Directory -Force -Path $ws | Out-Null
            $null = Invoke-Sandbox @{ Mode = $mode; Scratch = $true; Workspace = $ws }

            $run = Get-PodmanCall "run"
            $scratch = Join-Path $ws ".scratch"
            Assert-ArgPair $run "-v" "${scratch}:/workspace/ws-scratch-${mode}/.scratch:rw" "$mode scratch mount"
            Assert-True (Test-Path -LiteralPath $scratch -PathType Container) "$mode .scratch created"
        }

        Reset-MockState
        $wsRw = Join-Path $TestRoot "ws-scratch-rw"
        New-Item -ItemType Directory -Force -Path $wsRw | Out-Null
        $null = Invoke-Sandbox @{ Mode = "rw"; Scratch = $true; Workspace = $wsRw }
        Assert-True (((Get-PodmanCall "run") -join " ") -notmatch "\.scratch") "rw skips .scratch mount"
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $wsRw ".scratch"))) "rw does not create .scratch"
    }

    Test-Case "Persistent container (-Name) adds prefix once, omits --rm" {
        $res = Invoke-Sandbox @{ Name = "refactor-auth"; Workspace = $WorkDir }
        $run = Get-PodmanCall "run"
        Assert-ArgPair $run "--name" "pi-sbx-refactor-auth" "prefixed name"
        Assert-ArgPair $run "-e" "SANDBOX_NAME=refactor-auth" "SANDBOX_NAME env"
        Assert-NotContains $run "--rm" "no --rm"
        Assert-True ($res.Output -match "persistent \(pi-sbx-refactor-auth\)") "banner lifecycle"
    }

    Test-Case "Persistent container (-Name pi-sbx-foo) does not double-prefix in args or banner" {
        $res = Invoke-Sandbox @{ Name = "pi-sbx-foo"; Workspace = $WorkDir }
        Assert-ArgPair (Get-PodmanCall "run") "--name" "pi-sbx-foo" "single prefix"
        Assert-True ($res.Output -notmatch "pi-sbx-pi-sbx-") "no double prefix in banner"
    }

    Test-Case "-Resume <name> on stopped container calls podman start -ai" {
        $env:PI_MOCK_INSPECT_OUTPUT = "false"
        $null = Invoke-Sandbox @{ Resume = "work1" }
        Assert-Equal ((Get-PodmanCall "start") -join " ") "start -ai pi-sbx-work1" "start args"
    }

    Test-Case "-Resume <prefixed-name> does not double-prefix" {
        $env:PI_MOCK_INSPECT_OUTPUT = "false"
        $null = Invoke-Sandbox @{ Resume = "pi-sbx-work1" }
        Assert-Equal ((Get-PodmanCall "start") -join " ") "start -ai pi-sbx-work1" "single prefix"
    }

    Test-Case "-Resume <name> on running container calls podman attach" {
        $env:PI_MOCK_INSPECT_OUTPUT = "true"
        $null = Invoke-Sandbox @{ Resume = "work1" }
        Assert-Equal ((Get-PodmanCall "attach") -join " ") "attach pi-sbx-work1" "attach args"
    }

    Test-Case "-Resume <name> on missing container throws error" {
        $env:PI_MOCK_INSPECT_EXIT = "1"
        Invoke-Sandbox @{ Resume = "nope" } -ExpectError "not found"
    }

    Test-Case "-Resume rejects combining with Run-only flags" {
        Invoke-Sandbox @{ Resume = "work1"; Mode = "overlay" } -ExpectError "*"
    }

    Test-Case "Interactive menu: re-prompts on invalid choice and resumes single container [1]" {
        $env:PI_MOCK_PS_OUTPUT = "pi-sbx-solo|Exited (0)|1 hour ago"
        $env:PI_MOCK_INSPECT_OUTPUT = "false"
        $res = Invoke-SandboxInteractive @("9", "1")
        Assert-Equal $res.ExitCode 0 "ExitCode"
        Assert-True ($res.Output -match "Invalid selection") "warned on invalid choice"
        Assert-Equal ((Get-PodmanCall "start") -join " ") "start -ai pi-sbx-solo" "resumed [1]"
    }

    Test-Case "Interactive menu: Enter skips resume, re-prompts invalid net choice, overlay + default No for .scratch" {
        $env:PI_MOCK_PS_OUTPUT = "pi-sbx-old|Exited (0)|2 days ago"
        $res = Invoke-SandboxInteractive @("", "maybe", "n", "2", "", "feat-x")
        Assert-Equal $res.ExitCode 0 "ExitCode"
        Assert-True ($res.Output -match "Invalid selection") "re-prompted on invalid internet choice"
        $run = Get-PodmanCall "run"
        Assert-ArgPair $run "--name" "pi-sbx-feat-x" "named container"
        Assert-Contains $run "--network=pasta:--splice-only,-T,8080" "offline network"
        Assert-ArgPair $run "-v" "${WorkDir}:/workspace/workspace:O" "overlay mount"
        Assert-True (($run -join " ") -notmatch "\.scratch") ".scratch defaults to No"
    }

    Test-Case "Interactive menu: ro + 'y' mounts writable .scratch folder and re-prompts on invalid mount mode" {
        $ws = Join-Path $TestRoot "ws-interactive-scratch"
        New-Item -ItemType Directory -Force -Path $ws | Out-Null
        $res = Invoke-SandboxInteractive @("y", "4", "ro", "y", "") $ws
        Assert-Equal $res.ExitCode 0 "ExitCode"
        Assert-True ($res.Output -match "Invalid selection") "re-prompted on invalid mount mode"
        $run = Get-PodmanCall "run"
        Assert-ArgPair $run "-v" "${ws}:/workspace/ws-interactive-scratch:ro" "ro mount"
        Assert-ArgPair $run "-v" "$(Join-Path $ws '.scratch'):/workspace/ws-interactive-scratch/.scratch:rw" "scratch mount"
    }

    Test-Case "Throws clear error when podman ps fails" {
        $env:PI_MOCK_PS_EXIT = "1"
        Invoke-Sandbox @{ List = $true } -ExpectError "Failed to list Podman containers"
    }

    Test-Case "Rejects empty -Remove and out-of-range -LlamaSwapPort" {
        Invoke-Sandbox @{ Remove = "" } -ExpectError "*"
        Invoke-Sandbox @{ Mode = "rw"; LlamaSwapPort = 0; Workspace = $WorkDir } -ExpectError "*"
    }

    Test-Case "-List handles 0 containers cleanly" {
        $res = Invoke-Sandbox @{ List = $true }
        Assert-Equal $res.ExitCode 0 "ExitCode"
        Assert-True ($res.Output -match "No persistent") "empty message"
    }

    Test-Case "-List handles 1 container without array-unrolling crash and ignores malformed/foreign lines" {
        $env:PI_MOCK_PS_OUTPUT = "malformed-line`nother-app|Up|1m`npi-sbx-solo|Exited (0)|2 hours ago"
        $res = Invoke-Sandbox @{ List = $true }
        Assert-ArgPair (Get-PodmanCall "ps") "--filter" "name=^pi-sbx-" "name filter"
        Assert-True ($res.Output -match "solo") "lists container short name"
        Assert-True ($res.Output -notmatch "other-app") "ignores non-pi-sbx- container"
    }

    Test-Case "-Remove <name> calls podman rm -f and propagates non-zero exit code" {
        $env:PI_MOCK_RM_EXIT = "125"
        $res = Invoke-Sandbox @{ Remove = "ghost" }
        Assert-Equal $res.ExitCode 125 "propagates rm exit code"
        Assert-Equal ((Get-PodmanCall "rm") -join " ") "rm -f pi-sbx-ghost" "rm args"
        Assert-True ($null -eq (Get-PodmanCall "ps")) "no ps query for single remove"
    }

    Test-Case "-Remove all handles 0 containers cleanly" {
        $res = Invoke-Sandbox @{ Remove = "all" }
        Assert-Equal $res.ExitCode 0 "ExitCode"
        Assert-Equal (Get-PodmanCalls "rm").Count 0 "no rm calls"
    }

    Test-Case "-Remove all removes every sandbox container" {
        $env:PI_MOCK_PS_OUTPUT = "pi-sbx-one|Exited|1h`npi-sbx-two|Exited|2h"
        $res = Invoke-Sandbox @{ Remove = "all" }
        Assert-Equal $res.ExitCode 0 "ExitCode"
        $rmCalls = Get-PodmanCalls "rm"
        Assert-Equal $rmCalls.Count 2 "two rm calls"
        Assert-Equal ($rmCalls[0] -join " ") "rm -f pi-sbx-one" "first rm"
        Assert-Equal ($rmCalls[1] -join " ") "rm -f pi-sbx-two" "second rm"
    }

    Test-Case "-Remove all continues on partial failure and exits 1" {
        $env:PI_MOCK_PS_OUTPUT = "pi-sbx-bad|Exited|1h`npi-sbx-good|Exited|2h"
        $env:PI_MOCK_RM_FAIL_TARGET = "pi-sbx-bad"
        $res = Invoke-Sandbox @{ Remove = "all" }
        Assert-Equal $res.ExitCode 1 "exits 1 on partial failure"
        $rmCalls = Get-PodmanCalls "rm"
        Assert-Equal $rmCalls.Count 2 "still removes remaining container"
        Assert-Equal ($rmCalls[1] -join " ") "rm -f pi-sbx-good" "second container processed"
    }

    Test-Case "-Rebuild accepts custom -Image parameter" {
        $res = Invoke-Sandbox @{ Rebuild = $true; Image = "localhost/pi-custom:dev" }
        Assert-Equal $res.ExitCode 0 "ExitCode"
        $build = Get-PodmanCall "build"
        Assert-ArgPair $build "-t" "localhost/pi-custom:dev" "custom image tag"
        Assert-ArgPair $build "-f" (Join-Path $PSScriptRoot "Containerfile") "Containerfile path"
    }

    Test-Case "Starts Podman machine automatically when stopped" {
        $env:PI_MOCK_MACHINE_RUNNING = "false"
        $null = Invoke-Sandbox @{ List = $true }
        $machineCalls = Get-PodmanCalls "machine"
        Assert-Equal $machineCalls.Count 2 "list + start"
        Assert-Equal ($machineCalls[1] -join " ") "machine start" "machine start called"
    }

    Test-Case "Throws clear error when Podman machine start fails" {
        $env:PI_MOCK_MACHINE_RUNNING = "false"
        $env:PI_MOCK_MACHINE_START_EXIT = "1"
        Invoke-Sandbox @{ List = $true } -ExpectError "Failed to start Podman machine"
    }

    Test-Case "Throws clear error when image is missing" {
        $env:PI_MOCK_IMAGE_EXISTS_EXIT = "1"
        Invoke-Sandbox @{ Mode = "rw"; Workspace = $WorkDir } -ExpectError "not found"
    }

    Test-Case "Rejects a file path as -Workspace" {
        $filePath = Join-Path $TestRoot "not-a-dir.txt"
        Set-Content -LiteralPath $filePath -Value "hi"
        Invoke-Sandbox @{ Mode = "rw"; Workspace = $filePath } -ExpectError "not a directory"
    }
} finally {
    $env:PATH = $OrigPath
    Reset-MockState
    Remove-Item -LiteralPath $TestRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ("`nResults: {0} passed, {1} failed" -f $script:Passed, $script:Failed) -ForegroundColor ($script:Failed -eq 0 ? "Green" : "Red")
exit ($script:Failed -eq 0 ? 0 : 1)
