# Horrific cleanup script to use to make investigating re-creating forensic scenarios easier and quicker by reducing the amount of historical artifacts
# Wont remove everything (e.g slackspace), no substitute to a clean install

# Helper: reg.exe reports failures on stdout, so -ErrorAction SilentlyContinue never suppresses them
function Remove-RegEntry {
    param([string]$Path, [string]$Value)
    if ($Value) { reg delete "$Path" /v "$Value" /f 2>&1 | Out-Null }
    else { reg delete "$Path" /f 2>&1 | Out-Null }
}

# ==============================================================================
# 1. Stop Applications & Services (Release Locks & Prevent In-Memory Re-Flushing)
# ==============================================================================

# Browsers and editors (must be closed first or SQLite/WAL files stay locked)
Get-Process -Name chrome,msedge,firefox,brave,Code -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Stop Explorer so IconCache, ThumbCache, JumpLists, UserAssist, and ShellBags are not locked or flushed back on exit
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue

# Stop Search, PCA, SysMain, and DiagTrack so Windows.db, PcaAppLaunchDic.txt, Prefetch, and SRUDB.dat locks are released
Stop-Service WSearch,PcaSvc,SysMain,DiagTrack -Force -ErrorAction SilentlyContinue

# ==============================================================================
# 2. Disk Cleanup, Driver Folders, System & Application Caches
#    (Run BEFORE walking $env:USERPROFILE so we don't scan 100k+ cached files)
# ==============================================================================

# Delete windows update files (start cleanmgr and wait, otherwise it races the rest of the script)
Start-Process -FilePath cleanmgr.exe -ArgumentList '/autoclean' -Wait -WindowStyle Hidden -ErrorAction SilentlyContinue

# Run with the default settings (interactive dialog)
Start-Process -FilePath cleanmgr.exe -ArgumentList '/lowdisk' -Wait -ErrorAction SilentlyContinue

# Clear all user recycling bins (all volumes; leave the S-1-5-* folders in place or the bin breaks)
Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue | ForEach-Object {
    Clear-RecycleBin -DriveLetter $_.Name -Force -ErrorAction SilentlyContinue
}

# Delete hiberfil.sys by turning off hibernation
powercfg.exe -h off

# Delete Driver Folders
Remove-Item C:\AMD -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item C:\NVIDIA -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item C:\INTEL -Recurse -Force -ErrorAction SilentlyContinue

# Update, BITS, Delivery Optimization, and upgrade leftovers
bitsadmin.exe /reset /allusers 2>&1 | Out-Null
Remove-Item -Path "$env:windir\SoftwareDistribution\Download\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:ProgramData\Microsoft\Network\Downloader\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path 'C:\$WINDOWS.~BT\*' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path 'C:\$WINDOWS.~BT' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path 'C:\Windows.old\*' -Recurse -Force -ErrorAction SilentlyContinue
# Package Cache holds installer repair/uninstall payloads (Not Recommended if applications must stay supportable)
Remove-Item -Path "$env:ProgramData\Package Cache\*" -Recurse -Force -ErrorAction SilentlyContinue

# Delete System log, crash dump, and TEMP files
Remove-Item -Path "$env:ProgramData\Microsoft\Windows\WER\*" -Recurse -Force -ErrorAction SilentlyContinue
# CBS.log and WindowsUpdate logs are TrustedInstaller owned and normally locked in a live session
Get-ChildItem -Path "$env:windir\Logs" -Filter *.log -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\Logs\WindowsUpdate\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\CbsTemp\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\System32\LogFiles\WMI\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\System32\LogFiles\Sum\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\System32\spool\PRINTERS\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\PerfLogs\*" -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path "$env:windir\System32\WDI\LogFiles\StartupInfo" -Filter *.log -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\Minidump\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\MEMORY.DMP" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\LiveKernelReports\*" -Recurse -Force -ErrorAction SilentlyContinue

# Delete User Temp files and Cache
Remove-Item -Path "$env:LOCALAPPDATA\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\WER\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\CrashDumps\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\D3DSCache\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\Temporary Internet Files\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\WebCache\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\INetCache\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Office\16.0\GrooveFileCache\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\AppData\LocalLow\Microsoft\CryptnetUrlCache\*" -Recurse -Force -ErrorAction SilentlyContinue

# Browsers
$ChromiumArtifacts = @('History','History-journal','Visited Links','Top Sites','Cookies','Login Data','Web Data','Current Session','Current Tabs','Last Session','Last Tabs','Sessions','Session Storage','Local Storage','Local Settings','IndexedDB','Service Worker','Cache','Code Cache','GPUCache','blob_storage','media_cache','first_party_sets.db','shortcuts.db','Network Action Predictor','Segmentation Platform','Crashpad')
foreach ($root in @("$env:LOCALAPPDATA\Google\Chrome\User Data", "$env:LOCALAPPDATA\Microsoft\Edge\User Data", "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data")) {
    Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^(Default|Profile \d+)$' } | ForEach-Object {
        foreach ($item in $ChromiumArtifacts) { Remove-Item -Path (Join-Path $_.FullName $item) -Recurse -Force -ErrorAction SilentlyContinue }
    }
    Remove-Item -Path "$root\Crashpad\reports\*" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$root\Crash Reports\*" -Recurse -Force -ErrorAction SilentlyContinue
}

Get-ChildItem -Path "$env:APPDATA\Mozilla\Firefox\Profiles" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    foreach ($item in @('places.sqlite*','cookies.sqlite*','formhistory.sqlite','content-prefs.sqlite','permissions.sqlite','sessionstore*.jsonlz4','storage','storage-default','backups','crashes','shader-cache','startupCache.js')) {
        Remove-Item -Path (Join-Path $_.FullName $item) -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# UWP/MSIX sandbox caches (per package WebCache, INetCache, TempState and Explorer thumbnail caches)
Get-ChildItem "$env:LOCALAPPDATA\Packages" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    foreach ($item in @('AC\Temp','AC\Microsoft\Windows\WebCache','TempState','LocalCache\Local\Microsoft\Windows\INetCache','LocalCache\Roaming\Microsoft\Windows\INetCache','LocalState\Microsoft\Windows\Explorer')) {
        Remove-Item -Path (Join-Path $_.FullName $item) -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# VS Code command palette and terminal history (state.vscdb), recent projects (workspaceStorage) and editor backups
foreach ($item in @('User\History','User\workspaceStorage','User\globalStorage\state.vscdb','User\globalStorage\state.vscdb.backup','Backups','CachedData','Cache','Code Cache','GPUCache','DawnCache','Service Worker','Network','logs','Cached Profiles')) {
    Remove-Item -Path (Join-Path "$env:APPDATA\Code" $item) -Recurse -Force -ErrorAction SilentlyContinue
}

# Electron application caches (Discord, Slack and Teams keep URL, media and session caches under AppData\Roaming)
foreach ($app in @('discord','Slack','Microsoft\Teams')) {
    foreach ($item in @('Cache','Code Cache','GPUCache','blob_storage','Session Storage','Local Storage','IndexedDB','Service Worker')) {
        Remove-Item -Path (Join-Path "$env:APPDATA\$app" $item) -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Tooling and model caches; cached paths and URLs show what has been downloaded
foreach ($path in @("$env:USERPROFILE\.cache", "$env:USERPROFILE\.dspy_cache", "$env:USERPROFILE\.triton", "$env:USERPROFILE\.matplotlib", "$env:LOCALAPPDATA\pip\cache", "$env:LOCALAPPDATA\NuGet\v3-cache", "$env:LOCALAPPDATA\npm-cache", "$env:USERPROFILE\.bun\install\cache", "$env:USERPROFILE\.cargo\registry\cache")) {
    Remove-Item -Path "$path\*" -Recurse -Force -ErrorAction SilentlyContinue
}

# ==============================================================================
# 3. User Profile File Sweeps (thumbs.db & Zone.Identifier ADS)
# ==============================================================================

# Find and Delete stray thumbs.db files
Get-ChildItem -Path $env:USERPROFILE -Filter thumbs.db -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

# Strip Mark of the Web (Zone.Identifier NTFS alternate data streams)
Get-ChildItem -Path $env:USERPROFILE -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { !$_.PSIsContainer } | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Stream Zone.Identifier -ErrorAction SilentlyContinue
}
#Get-ChildItem -Path $env:USERPROFILE -Include *.tmp -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force

# ==============================================================================
# 4. Windows 11 (22H2-26H2) Execution, Search, AI & System Forensic Artifacts
# ==============================================================================

# Delete and Rebuild Windows desktop search history and index (Win11 22H2-26H2 SQLite Windows.db + legacy Windows.edb)
Remove-Item -Path "$env:ProgramData\Microsoft\Search\Data\Applications\Windows\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Packages\Microsoft.Windows.Search_cw5n1h2txyewy\LocalState\*" -Recurse -Force -ErrorAction SilentlyContinue
Start-Service WSearch -ErrorAction SilentlyContinue

# Windows 11 Recall (ukg.db vector DB & screen snapshots), Click-to-Do, Semantic Index, and Copilot artifacts (24H2-26H2)
Remove-Item -Path "$env:LOCALAPPDATA\CoreAIPlatform.00\UKP\*" -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem "$env:LOCALAPPDATA\Packages" -Directory -Filter '*Recall*' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem "$env:LOCALAPPDATA\Packages" -Directory -Filter '*Microsoft.Copilot*' -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item -Path (Join-Path $_.FullName 'LocalState\*') -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path (Join-Path $_.FullName 'TempState\*') -Recurse -Force -ErrorAction SilentlyContinue
}
Remove-Item -Path "$env:LOCALAPPDATA\Packages\MicrosoftWindows.Client.CBS_*\LocalState\Recall\*" -Recurse -Force -ErrorAction SilentlyContinue

# Delete Prefetch files (Not Recommended)
Remove-Item -Path "$env:windir\Prefetch\*.pf" -Force -ErrorAction SilentlyContinue

# Windows 11 (22H2-26H2) Program Compatibility Assistant (PCA) execution artifacts (PcaAppLaunchDic.txt & PcaGeneralDb*.txt)
Remove-Item -Path "$env:windir\appcompat\pca\PcaAppLaunchDic.txt" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\appcompat\pca\PcaGeneralDb*.txt" -Force -ErrorAction SilentlyContinue
Start-Service PcaSvc -ErrorAction SilentlyContinue

# BAM / DAM (Background Activity Moderator) per-SID binary execution history (SYSTEM owned; requires psexec -i -s)
#foreach ($svc in @('bam','dam')) {
#    Get-ChildItem "HKLM:\SYSTEM\CurrentControlSet\Services\$svc\State\UserSettings" -ErrorAction SilentlyContinue | ForEach-Object {
#        $sidKey = $_.PSPath
#        (Get-ItemProperty -Path $sidKey -ErrorAction SilentlyContinue).PSObject.Properties |
#            Where-Object { $_.Name -notmatch '^(PSPath|PSParentPath|PSChildName|PSDrive|PSProvider|Version|SequenceNumber)$' } |
#            ForEach-Object { Remove-ItemProperty -Path $sidKey -Name $_.Name -Force -ErrorAction SilentlyContinue }
#    }
#}

# System & User AppCompat, ShimCache, Amcache, and SRUM
# ShimCache value is SYSTEM/TrustedInstaller owned; from an elevated admin shell this fails (requires psexec -i -s)
#Remove-RegEntry "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\AppCompatCache" -Value 'AppCompatCache'
#Remove-RegEntry "HKLM\SYSTEM\ControlSet001\Control\Session Manager\AppCompatCache" -Value 'AppCompatCache'
Remove-RegEntry "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags"
Remove-RegEntry "HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags"
# Amcache.hve and RecentFileCache.bcf are held open by the kernel and normally survive a live delete (WinPE/offline required)
Remove-Item -Path "$env:windir\appcompat\Programs\Amcache.hve*" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\appcompat\Programs\RecentFileCache.bcf" -Force -ErrorAction SilentlyContinue
# SRUM database (SysMain and DiagTrack were stopped in section 1 to release locks)
Remove-Item -Path "$env:windir\System32\sru\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\AppCache\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-RegEntry "HKCU\Software\Microsoft\Internet Explorer\LowRegistry\Audio\PolicyConfig\PropertyStore"
Remove-RegEntry "HKCU\Software\Microsoft\UserData\UninstallTimes"

# Windows Defender scan, detection, and MPLog history (protected by MsMpEng/Tamper Protection unless Defender is disabled or offline)
Remove-Item -Path "$env:ProgramData\Microsoft\Windows Defender\Scans\History\Service\DetectionHistory\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:ProgramData\Microsoft\Windows Defender\Scans\History\Results\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:ProgramData\Microsoft\Windows Defender\Support\MPLog-*.log" -Force -ErrorAction SilentlyContinue

# Timeline / Activity History and Connected Devices Platform caches
Remove-Item -Path "$env:LOCALAPPDATA\ConnectedDevicesPlatform\*" -Recurse -Force -ErrorAction SilentlyContinue

# Capability access history (camera, microphone, location per application). Deleting also revokes consent,
# so applications will be prompted again on next access (HKLM key is SYSTEM/TrustedInstaller owned; requires psexec -i -s)
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager"
#Remove-RegEntry "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager"
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\Location\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:ProgramData\Microsoft\Windows\Location\*" -Recurse -Force -ErrorAction SilentlyContinue

# ==============================================================================
# 5. Explorer Caches, JumpLists, MRUs, UserAssist & ShellBags -> Restart Explorer
# ==============================================================================

# Explorer icon and thumbnail caches
Remove-Item -Path "$env:LOCALAPPDATA\IconCache.db" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_*.db" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_*.db" -Force -ErrorAction SilentlyContinue

# JumpLists and Recent Items
Get-ChildItem -Path "$env:APPDATA\Microsoft\Windows\Recent" -File -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\Microsoft\Windows\Recent\AutomaticDestinations\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\Microsoft\Windows\Recent\CustomDestinations\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Search\JumpListData"

# Explorer MRUs and FeatureUsage
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\AutoplayHandlers\KnownDevices"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\ComDlg32"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FeatureUsage"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FindComputerMRU"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Map Network Drive MRU"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\MountPoints2"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\RecentDocs"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\TypedPaths"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\WordWheelQuery"
# UserAssist for processes launched as SYSTEM (services, PsExec, scheduled tasks)
Remove-RegEntry "HKU\.DEFAULT\Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist"

# MUICache (executable display names and first run paths), stream MRUs, per SID recycle bin names
Remove-RegEntry "HKCU\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\Shell\OpenSavePidlMRU"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\StreamMRU"
Remove-RegEntry "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\BitBucket"

# ShellBags
Remove-RegEntry "HKCU\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\Bags"
Remove-RegEntry "HKCU\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\BagMRU"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\Shell\BagMRU"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\Shell\Bags"

# Restarting from an elevated session starts an elevated shell; from a non-interactive session Explorer never returns
Start-Process explorer.exe

# ==============================================================================
# 6. Network, RDP, Notifications, Clipboard & Third-Party Software Artifacts
# ==============================================================================

# Known networks and connection profiles (SSID and site names reveal physical locations)
netsh wlan delete profile name=* 2>&1 | Out-Null
Get-NetConnectionProfile -ErrorAction SilentlyContinue | Remove-NetConnectionProfile -ErrorAction SilentlyContinue
# NetworkList subkeys are SYSTEM/NetworkListService owned (requires psexec -i -s)
#Remove-RegEntry "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\NetworkList\Profiles"
#Remove-RegEntry "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\NetworkList\Signatures\Unmanaged"
#Remove-RegEntry "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\NetworkList\Signatures\Managed"
#Remove-RegEntry "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\NetworkList\Names"

# DNS and ARP caches
ipconfig /flushdns
arp -d * 2>&1 | Out-Null

# USB and Bluetooth insertion history (Not Recommended - existing devices re-enumerate and pairings are lost)
#Remove-RegEntry "HKLM\SYSTEM\CurrentControlSet\Enum\USBSTOR"
#Remove-RegEntry "HKLM\SYSTEM\CurrentControlSet\Enum\BTHENUM"
#Remove-Item -Path "$env:windir\INF\setupapi.dev.log" -Force -ErrorAction SilentlyContinue
# MountedDevices is deliberately left alone; removing \DosDevices\C: renders the volume unbootable

# Legacy Explorer/IE web history and zone assignments
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\History\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings\Url History"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings\5.0\Url History"
Remove-RegEntry "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings\ZoneMap"

# Typed URLs
Remove-RegEntry "HKCU\Software\Microsoft\Internet Explorer\TypedURLs"
Remove-RegEntry "HKCU\Software\Microsoft\Internet Explorer\TypedURLsHistory"

# Remote Desktop (RDP) Connection History & Bitmap Cache
Remove-RegEntry "HKCU\Software\Microsoft\Terminal Server Client\Default"
Remove-RegEntry "HKCU\Software\Microsoft\Terminal Server Client\Servers"
Remove-Item -Path "$env:USERPROFILE\Documents\Default.rdp" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Terminal Server Client\Cache\*" -Recurse -Force -ErrorAction SilentlyContinue

# Delete Windows notification history
Get-Service -DisplayName "Windows Push Notification*" -ErrorAction SilentlyContinue | Stop-Service -Force -ErrorAction SilentlyContinue
# WpnUserService_* is a per-user deferred start service and usually cannot be stopped from this session
Get-Service -DisplayName "WpnUserService*" -ErrorAction SilentlyContinue | Stop-Service -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\Notifications\*" -Recurse -Force -ErrorAction SilentlyContinue
Get-Service -DisplayName "Windows Push Notification*" -ErrorAction SilentlyContinue | Start-Service -ErrorAction SilentlyContinue
Get-Service -DisplayName "WpnUserService*" -ErrorAction SilentlyContinue | Start-Service -ErrorAction SilentlyContinue

# Clipboard History
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\Clipboard\*" -Recurse -Force -ErrorAction SilentlyContinue
cmd.exe /c "echo off | clip" 2>$null

# Software specific
Remove-RegEntry "HKCU\Software\7-Zip\FM"
Remove-RegEntry "HKCU\Software\Martin Prikryl\WinSCP 2\Configuration\CDCache"
Remove-RegEntry "HKCU\Software\Martin Prikryl\WinSCP 2\Configuration\History"
Remove-RegEntry "HKCU\Software\Martin Prikryl\WinSCP 2\Configuration\LastFingerprints"
Remove-RegEntry "HKCU\Software\Martin Prikryl\WinSCP 2\SshHostKeys"
Remove-RegEntry "HKCU\Software\SimonTatham\PuTTY\SshHostKeys"
Remove-RegEntry "HKCU\Software\sqlitebrowser\sqlitebrowser\General\recentFileList"
Remove-Item -Path "$env:LOCALAPPDATA\calibre-cache\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\calibre\viewer\annots\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\calibre\history.plist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\calibre\viewer-webengine.json" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\.ollama\history" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\.pi\agent\sessions\*" -Recurse -Force -ErrorAction SilentlyContinue

# ==============================================================================
# 7. Final Sweep: Shadow Copies, USN Journal, Event Logs, CLI History & SDelete
#    (Run LAST so file/service operations above don't leave new USN/Event trails)
# ==============================================================================

# Delete Shadow Copies (Not Recommended)
vssadmin delete shadows /for=C: /all /quiet 2>&1 | Out-Null

# NTFS change journal (not touched by free space cleaning)
fsutil usn deletejournal /D C: 2>&1 | Out-Null

# Clear Eventlog (Classic and Operational channels)
wevtutil el | ForEach-Object { wevtutil cl "$_" 2>$null }
Get-WinEvent -ListLog * -Force -ErrorAction SilentlyContinue | ForEach-Object {
    try { [System.Diagnostics.Eventing.Reader.EventLogSession]::GlobalSession.ClearLog($_.LogName) } catch {}
}

# PowerShell & CLI Console History
Remove-Item -Path "$env:APPDATA\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\Microsoft\PowerShell\PSReadLine\ConsoleHost_history.txt" -Force -ErrorAction SilentlyContinue
Clear-History -ErrorAction SilentlyContinue

# Shell and CLI history (resolve the PSReadLine path instead of hardcoding it, it is user configurable;
# PSReadLine may not be importable in a non-interactive host, hence the hardcoded defaults above)
if (Import-Module PSReadLine -PassThru -ErrorAction SilentlyContinue) {
    try {
        [Microsoft.PowerShell.PSConsoleReadLine]::ClearHistory()
        Remove-Item -Path (Get-PSReadLineOption).HistorySavePath -Force -ErrorAction SilentlyContinue
    } catch {}
}
Remove-Item -Path "$env:USERPROFILE\.bash_history" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\.python_history" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\.lesshst" -Force -ErrorAction SilentlyContinue
# WSL keeps its own shell history inside ext4.vhdx; it has to be cleared from inside the distro

# Clean free space (-z zeroes currently free clusters, -c re-cleans previously freed ones; run -z first).
# On NVMe/SSD volumes -z is largely ineffective after TRIM and wears the device; expect a long run on C:
sdelete -accepteula -z C:
sdelete -accepteula -c C:
