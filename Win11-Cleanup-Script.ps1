# Horrific cleanup script to use to make investigating re-creating forensic scenarios easier and quicker by reducing the amount of historical artifacts
# Wont remove everything (e.g slackspace), no suspstitue to a clean install

# Delete windows update files
cleanmgr.exe /autoclean

# Run with the default settings
cleanmgr.exe /lowdisk

# Clear all user recycling bins
Get-ChildItem 'C:\$Recycle.Bin\' -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# Delete Sytem log and TEMP files
Remove-Item -Path "$env:ProgramData\Microsoft\Windows\WER\*" -Recurse -Force -ErrorAction SilentlyContinue
remove-item -Path C:\Windows\Logs\* -Recurse -Include *.log -ErrorAction SilentlyContinue
Remove-item -Path C:\Windows\System32\WDI\LogFiles\StartupInfo\* -Recurse -Include *.log -ErrorAction SilentlyContinue
Remove-Item -Path C:\Windows\Temp\* -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path C:\Windows\Minidump\*  -Recurse -Force -ErrorAction SilentlyContinue

# Clear Eventlog
Get-EventLog -LogName * | ForEach-Object { Clear-EventLog $_.Log }

# Delete hiberfil.sys by turning off hybernation
powercfg.exe -h off

# Delete Prefetch files (Not Recommended)
remove-item -Path C:\Windows\Prefetch\*.pf -ErrorAction SilentlyContinue

# Delete Shadow Copies (Not Recommended)
vssadmin delete shadows /all

# Find and Delete stray thumbs.db files
Get-ChildItem -Path C:\Users\$env:username -Include thumbs.db -Recurse -Name -Force
#Get-ChildItem -Path C:\Users\$env:username -Include *.tmp -Recurse -Name -Force | Remove-Item -Force

# Delete and Rebuild Windows desktop search history and index (Select Advanced > rebuild cache)
control srchadmin.dll

# Delete Driver Folders
Remove-Item C:\AMD -Force -ErrorAction SilentlyContinue
Remove-Item C:\NVIDIA -Force -ErrorAction SilentlyContinue
Remove-Item C:\INTEL -Force -ErrorAction SilentlyContinue

# Delete User Temp files and Cache
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Windows\WER\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\CrashDumps\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Windows\Temporary Internet Files\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Windows\WebCache\* " -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Windows\INetCache\* " -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Office\16.0\GrooveFileCache\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\LocalLow\Microsoft\CryptnetUrlCache" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\IconCache.db" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Windows\Explorer\thumbcache_*.db" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Windows\Explorer\iconcache_*.db" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Roaming\Microsoft\Windows\Recent\*.lnk" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\CrashDumps\*" -Recurse -Force -ErrorAction SilentlyContinue

# User appcompatflags, MRU and more
remove-item -Path "C:\Users\$env:username\AppData\Roaming\Microsoft\Windows\Recent\AutomaticDestinations\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Windows\AppCache\*" -Recurse -Force -ErrorAction SilentlyContinue
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
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Search\JumpListData" /f

# ShellBags
reg delete "HKCU\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\Bags" /f
reg delete "HKCU\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\BagMRU" /f
reg delete "HKCU\Software\Software\Microsoft\Windows\Shell\BagMRU" /f
reg delete "HKCU\Software\Software\Microsoft\Windows\Shell\Bags" /f

# Software specific
reg delete "HKCU\Software\7-Zip\FM" /f
reg delete "HKCU\Software\Martin Prikryl\WinSCP 2\Configuration\CDCache" /f
reg delete "HKCU\Software\Martin Prikryl\WinSCP 2\Configuration\History" /f
reg delete "HKCU\Software\Martin Prikryl\WinSCP 2\Configuration\LastFingerprints" /f
reg delete "HKCU\Software\Martin Prikryl\WinSCP 2\SshHostKeys" /f
reg delete "HKCU\Software\SimonTatham\PuTTY\SshHostKeys" /f
reg delete "HKCU\Software\sqlitebrowser\sqlitebrowser\General\recentFileList" /f

# Delete Windows notification history
Get-Service -DisplayName  "Windows Push Notification*" | Stop-Service
Get-Service -DisplayName  "WpnUserService*" | Stop-Service
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Windows\Notifications\*" -Recurse -Force -ErrorAction SilentlyContinue
Get-Service -DisplayName  "Windows Push Notification*" | Start-Service
Get-Service -DisplayName  "WpnUserService*" | Start-Service

# Clean free space
sdelete -c C: