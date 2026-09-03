# Horrific cleanup script to use to make investigating re-creating forensic scenarios easier and quicker by reducing the amount of historical artifacts
# Wont remove everything (e.g slackspace), no substitute to a clean install

# Delete windows update files
cleanmgr.exe /autoclean

# Run with the default settings
cleanmgr.exe /lowdisk

# Clear all user recycling bins
Get-ChildItem 'C:\$Recycle.Bin\' -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# Delete System log and TEMP files
Remove-Item -Path "$env:ProgramData\Microsoft\Windows\WER\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\Logs\*" -Recurse -Include *.log -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\System32\WDI\LogFiles\StartupInfo\*" -Recurse -Include *.log -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\Minidump\*"  -Recurse -Force -ErrorAction SilentlyContinue

# Clear Eventlog (Classic and Operational channels)
wevtutil el | ForEach-Object { wevtutil cl "$_" 2>$null }
Get-WinEvent -ListLog * -Force -ErrorAction SilentlyContinue | ForEach-Object {
    try { [System.Diagnostics.Eventing.Reader.EventLogSession]::GlobalSession.ClearLog($_.LogName) } catch {}
}

# Delete hiberfil.sys by turning off hibernation
powercfg.exe -h off

# Delete Prefetch files (Not Recommended)
Remove-Item -Path "$env:windir\Prefetch\*.pf" -ErrorAction SilentlyContinue

# Delete Shadow Copies (Not Recommended)
vssadmin delete shadows /all

# Find and Delete stray thumbs.db files
Get-ChildItem -Path $env:USERPROFILE -Include thumbs.db -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
#Get-ChildItem -Path $env:USERPROFILE -Include *.tmp -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force

# Delete and Rebuild Windows desktop search history and index
Stop-Service WSearch -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:ProgramData\Microsoft\Search\Data\Applications\Windows\Windows.edb" -Force -ErrorAction SilentlyContinue
Start-Service WSearch -ErrorAction SilentlyContinue

# Delete Driver Folders
Remove-Item C:\AMD -Force -ErrorAction SilentlyContinue
Remove-Item C:\NVIDIA -Force -ErrorAction SilentlyContinue
Remove-Item C:\INTEL -Force -ErrorAction SilentlyContinue

# Delete User Temp files and Cache
Remove-Item -Path "$env:LOCALAPPDATA\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\WER\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\CrashDumps\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\Temporary Internet Files\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\WebCache\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\INetCache\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Office\16.0\GrooveFileCache\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\AppData\LocalLow\Microsoft\CryptnetUrlCache\*" -Recurse -Force -ErrorAction SilentlyContinue

# Explorer icon and thumbnail caches (requires killing explorer to release file locks)
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\IconCache.db" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_*.db" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_*.db" -Force -ErrorAction SilentlyContinue
Start-Process explorer.exe

# JumpLists and Recent Items
Remove-Item -Path "$env:APPDATA\Microsoft\Windows\Recent\*.lnk" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\Microsoft\Windows\Recent\AutomaticDestinations\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\Microsoft\Windows\Recent\CustomDestinations\*" -Recurse -Force -ErrorAction SilentlyContinue
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Search\JumpListData" /f

# System & User AppCompat, ShimCache, Amcache, and MRUs
reg delete "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\AppCompatCache" /v AppCompatCache /f
reg delete "HKLM\SYSTEM\ControlSet001\Control\Session Manager\AppCompatCache" /v AppCompatCache /f
reg delete "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags" /f
Remove-Item -Path "$env:windir\appcompat\Programs\Amcache.hve*" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\appcompat\Programs\RecentFileCache.bcf" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\AppCache\*" -Recurse -Force -ErrorAction SilentlyContinue
reg delete "HKCU\Software\Microsoft\Internet Explorer\LowRegistry\Audio\PolicyConfig\PropertyStore" /f
reg delete "HKCU\Software\Microsoft\UserData\UninstallTimes" /f
reg delete "HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\AutoplayHandlers\KnownDevices" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\ComDlg32" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FeatureUsage" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FindComputerMRU" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Map Network Drive MRU" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\MountPoints2" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\RecentDocs" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\TypedPaths" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\WordWheelQuery" /f

# Typed URLs
reg delete "HKCU\Software\Microsoft\Internet Explorer\TypedURLs" /f
reg delete "HKCU\Software\Microsoft\Internet Explorer\TypedURLsHistory" /f

# Remote Desktop (RDP) Connection History
reg delete "HKCU\Software\Microsoft\Terminal Server Client\Default" /f
reg delete "HKCU\Software\Microsoft\Terminal Server Client\Servers" /f
Remove-Item -Path "$env:USERPROFILE\Documents\Default.rdp" -Force -ErrorAction SilentlyContinue

# ShellBags
reg delete "HKCU\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\Bags" /f
reg delete "HKCU\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\BagMRU" /f
reg delete "HKCU\Software\Microsoft\Windows\Shell\BagMRU" /f
reg delete "HKCU\Software\Microsoft\Windows\Shell\Bags" /f

# PowerShell Console History
Remove-Item -Path "$env:APPDATA\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\Microsoft\PowerShell\PSReadLine\ConsoleHost_history.txt" -Force -ErrorAction SilentlyContinue
Clear-History -ErrorAction SilentlyContinue

# Clipboard History
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\Clipboard\*" -Recurse -Force -ErrorAction SilentlyContinue
cmd.exe /c "echo off | clip" 2>$null

# Software specific
reg delete "HKCU\Software\7-Zip\FM" /f
reg delete "HKCU\Software\Martin Prikryl\WinSCP 2\Configuration\CDCache" /f
reg delete "HKCU\Software\Martin Prikryl\WinSCP 2\Configuration\History" /f
reg delete "HKCU\Software\Martin Prikryl\WinSCP 2\Configuration\LastFingerprints" /f
reg delete "HKCU\Software\Martin Prikryl\WinSCP 2\SshHostKeys" /f
reg delete "HKCU\Software\SimonTatham\PuTTY\SshHostKeys" /f
reg delete "HKCU\Software\sqlitebrowser\sqlitebrowser\General\recentFileList" /f
Remove-Item -Path "$env:LOCALAPPDATA\calibre-cache\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\calibre\viewer\annots\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\calibre\history.plist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\calibre\viewer-webengine.json" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\.ollama\history" -Recurse -Force -ErrorAction SilentlyContinue

# Delete Windows notification history
Get-Service -DisplayName  "Windows Push Notification*" | Stop-Service
Get-Service -DisplayName  "WpnUserService*" | Stop-Service
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\Notifications\*" -Recurse -Force -ErrorAction SilentlyContinue
Get-Service -DisplayName  "Windows Push Notification*" | Start-Service
Get-Service -DisplayName  "WpnUserService*" | Start-Service

# Clean free space
sdelete -c C:
