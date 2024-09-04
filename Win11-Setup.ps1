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

Function DisableStartWebSearch {
	#Disables Web Search in Start Menu
	write-output "Disabling Bing Search in Start Menu"
	$WebSearch = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search"
	If (!(Test-Path $WebSearch)) {
		New-Item $WebSearch  | Out-Null
	}
	Set-ItemProperty $WebSearch DisableWebSearch -Value 1
	##Loop through all user SIDs in the registry and disable Bing Search
	foreach ($sid in $UserSIDs) {
		$WebSearch = "Registry::HKU\$sid\SOFTWARE\Microsoft\Windows\CurrentVersion\Search"
		If (!(Test-Path $WebSearch)) {
			New-Item $WebSearch  | Out-Null
		}
		Set-ItemProperty $WebSearch BingSearchEnabled -Value 0
	}

	Set-ItemProperty "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search" BingSearchEnabled -Value 0
}

Function HideLearnAboutPicture {
	#Turn off Learn about this picture
	write-output "Disabling Learn about this picture"
	$picture = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\HideDesktopIcons\NewStartPanel'
	If (Test-Path $picture) {
		Set-ItemProperty $picture -Name "{2cc5ca98-6485-489a-920e-b3e88a6ccce3}" -Value 1
	}
}

Function DisableRecall {
	#Turn off Recall
	write-output "Disabling Recall"
	$recall = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsAI"
	If (!(Test-Path $recall)) {
		New-Item $recall  | Out-Null
	}
	Set-ItemProperty $recall DisableAIDataAnalysis -Value 1

	$recalluser = 'HKCU:\SOFTWARE\Policies\Microsoft\Windows\WindowsAI'
	If (!(Test-Path $recalluser)) {
		New-Item $recalluser  | Out-Null
	}
	Set-ItemProperty $recalluser DisableAIDataAnalysis -Value 1
}

Function DisableWindowsFeedback {
	#Disables Windows Feedback Experience
	write-output "Disabling Windows Feedback Experience program"
	$Advertising = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo"
	If (!(Test-Path $Advertising)) {
		New-Item $Advertising  | Out-Null
	}
	If (Test-Path $Advertising) {
		Set-ItemProperty $Advertising Enabled -Value 0
	}

	#Stops the Windows Feedback Experience from sending anonymous data
	write-output "Stopping the Windows Feedback Experience program"
	$Period = "HKCU:\Software\Microsoft\Siuf\Rules"
	If (!(Test-Path $Period)) {
		New-Item $Period -Force | Out-Null
	}
	Set-ItemProperty $Period PeriodInNanoSeconds -Value 0
}

Function DisableAppSuggestions {
	#Prevents bloatware applications from returning and removes Start Menu suggestions
	write-output "Adding Registry key to prevent bloatware apps from returning"
	$registryPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent"
	$registryOEM = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"
	If (!(Test-Path $registryPath)) {
		New-Item $registryPath  | Out-Null
	}
	Set-ItemProperty $registryPath DisableWindowsConsumerFeatures -Value 1

	If (!(Test-Path $registryOEM)) {
		New-Item $registryOEM  | Out-Null
	}
	Set-ItemProperty $registryOEM  ContentDeliveryAllowed -Value 0
	Set-ItemProperty $registryOEM  OemPreInstalledAppsEnabled -Value 0
	Set-ItemProperty $registryOEM  PreInstalledAppsEnabled -Value 0
	Set-ItemProperty $registryOEM  PreInstalledAppsEverEnabled -Value 0
	Set-ItemProperty $registryOEM  SilentInstalledAppsEnabled -Value 0
	Set-ItemProperty $registryOEM  SystemPaneSuggestionsEnabled -Value 0
}

## END FUNCTIONS

EnableClearRecentFiles
EnableNTFSLongPaths
SetBIOSTimeUTC
HideLanguageBar
HideGallery
DisableStartWebSearch
HideLearnAboutPicture
DisableRecall
DisableWindowsFeedback
DisableAppSuggestions