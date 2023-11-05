# Horrific cleanup script to use to make investigating re-creating forensic scenarios easier and quicker by reducing the amount of historical artifacts
# Wont remove everything (e.g slackspace), no suspstitue to a clean install

# Delete windows update files
cleanmgr.exe /autoclean
cleanmgr.exe /lowdisk

# Delete log and TEMP files
Remove-Item -Path C:\Windows\Temp\* -Recurse -Force -ErrorAction SilentlyContinue
remove-item -Path C:\Windows\Logs\* -Recurse -Include *.log -ErrorAction SilentlyContinue
Remove-Item -Path "$env:ProgramData\Microsoft\Windows\WER\*" -Recurse -Force -ErrorAction SilentlyContinue

# Delete Prefetch files (Not Recommended)
remove-item -Path C:\Windows\Prefetch\*.pf -ErrorAction SilentlyContinue

# Delete Shadow Copies (Not Recommended)
vssadmin delete shadows /all

# Delete Jumplists and RuMRU
remove-item "$env:appdata\Microsoft\Windows\Recent\AutomaticDestinations\*"
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU" /f

# Amcache and  AppCompat

# Delete stray thumbs.db files
Get-ChildItem -Path C:\Users\$env:username -Include thumbs.db -Recurse -Name -Force
#Get-ChildItem -Path C:\Users\$env:username -Include *.tmp -Recurse -Name -Force | Remove-Item -Force

# Delete and Rebuild index (Select Advanced > rebuild cache)
control srchadmin.dll

# Delete Driver Folders
Remove-Item C:\AMD -Force -ErrorAction SilentlyContinue
Remove-Item C:\NVIDIA -Force -ErrorAction SilentlyContinue
Remove-Item C:\INTEL -Force -ErrorAction SilentlyContinue

# Delete User Temp
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Windows\WER\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Windows\AppCache\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\CrashDumps\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Windows\Temporary Internet Files\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Windows\WebCache\* " -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Windows\INetCache\* " -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\$env:username\AppData\Local\Microsoft\Office\16.0\GrooveFileCache\*" -Recurse -Force -ErrorAction SilentlyContinue

# Clear Eventlog
Get-EventLog -LogName * | ForEach { Clear-EventLog $_.Log }

# Clean free space
sdelete -c C: