# Enable clearing of recent files on exit
# Empties most recently used (MRU) items lists such as 'Recent Items' menu on the Start menu, jump lists, and shortcuts at the bottom of the 'File' menu in applications during every logout.
Function EnableClearRecentFiles {
	Write-Output "Enabling clearing of recent files on exit..."
	If (!(Test-Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer")) {
		New-Item -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" | Out-Null
	}
	Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" -Name "ClearRecentDocsOnExit" -Type DWord -Value 1
}

# Enable NTFS paths with length over 260 characters
Function EnableNTFSLongPaths {
	Write-Output "Enabling NTFS paths with length over 260 characters..."
	Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Type DWord -Value 1
}

# Set BIOS time to UTC (useful if you dualboot)
Function SetBIOSTimeUTC {
	Write-Output "Setting BIOS time to UTC..."
	Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\TimeZoneInformation" -Name "RealTimeIsUniversal" -Type DWord -Value 1
}

# Hide the Language Bar
Function HideLanguageBar {
	Write-Output "Hiding Language Bar..."
	If (!(Test-Path "HKCU:\Software\Microsoft\CTF\LangBar")) {
		New-Item -Path "HKCU:\Software\Microsoft\CTF\LangBar" | Out-Null
	}
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\CTF\LangBar" -Name "ShowStatus" -Type DWord -Value 3
}

# Hide Gallery from Explorer
Function HideGallery {
	Write-Output "Hiding Gallery..."
	If (!(Test-Path "HKCU:\Software\Classes\CLSID\{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}")) {
		New-Item -Path "HKCU:\Software\Classes\CLSID\{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}" | Out-Null
	}
	Set-ItemProperty -Path "HKCU:\Software\Classes\CLSID\{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}" -Name "System.IsPinnedToNameSpaceTree" -Type DWord -Value 0	
}

## END FUNCTIONS

EnableClearRecentFiles
EnableNTFSLongPaths
SetBIOSTimeUTC
HideLanguageBar
HideGallery