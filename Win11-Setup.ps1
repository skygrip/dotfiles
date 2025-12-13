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

Function DisableTelemetry {
	Write-Output "Disabling Telemetry and Data Collection..."
	# Disable the Connected User Experiences and Telemetry Service
	Stop-Service DiagTrack
	Set-Service DiagTrack -StartupType Disabled

	# Set Telemetry level to "Security" (0 = Security, 1 = Basic, 2 = Enhanced, 3 = Full)
	$telemetryPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection"
	If (!(Test-Path $telemetryPath)) {
		New-Item -Path $telemetryPath -Force | Out-Null
	}
	Set-ItemProperty -Path $telemetryPath -Name "AllowTelemetry" -Value 0 -Type DWord -Force

	# Disable Telemetry-related scheduled tasks
	Get-ScheduledTask -TaskPath "\Microsoft\Windows\Customer Experience Improvement Program\" | Disable-ScheduledTask -ErrorAction SilentlyContinue
}

Function DisableOneDrive {
    # Kill all OneDrive processes
    Write-Output "Killing OneDrive processes..."
    Stop-Process -Name "OneDrive" -Force -ErrorAction SilentlyContinue

    #  Attempt uninstallation using the winget package manager 
    Write-Output "Attempting uninstallation via winget..."
    winget uninstall Microsoft.OneDrive -Exact -Force -ErrorAction SilentlyContinue

    # 4. Enforce Group Policy to Prevent Reinstallation/Usage
    Write-Output "Setting policy to prevent future usage and reinstallation..."
    $policyPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\OneDrive"
    If (!(Test-Path $policyPath)) {
        New-Item -Path $policyPath -Force | Out-Null
    }
    Set-ItemProperty -Path $policyPath -Name "DisableFileSyncNGSC" -Value 1 -Type DWord -Force

    Write-Output "OneDrive removal and disable process complete. A reboot may be required."
}

Function DisablePostUpdateNotification {
	# Disable "Let's finish setting up your device" notifications
	$finishSetupPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"
	Set-ItemProperty -Path $finishSetupPath -Name "SubscribedContent-310093Enabled" -Value 0 -Force
}

Function ClassicRightClickMenu {
	Write-Output "Applying additional UI and Explorer tweaks..."
	# Restore the classic full context menu (requires explorer.exe restart)
	$classicContext = "HKCU:\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32"
	If (!(Test-Path $classicContext)) {
		New-Item -Path $classicContext -Force | Out-Null
	}
	Set-ItemProperty -Path $classicContext -Name "(Default)" -Value "" -Force
}
Function TweakExplorerAndUI {
	# Start Menu: Disable recommendations and recently added apps
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Start_ShowRecentlyAdded" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Start_ShowRecommendations" -Value 0 -Type DWord -Force

	# Accessibility: Disable Sticky Keys
	Set-ItemProperty -Path "HKCU:\Control Panel\Accessibility\StickyKeys" -Name "Flags" -Value "58" -Type String -Force

	# Multitasking: Disable Snap Windows and Shake to Minimize
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "EnableSnapAssistFlyout" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "DisallowShaking" -Value 1 -Type DWord -Force

	# Taskbar: Disable "Peek at desktop" button
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarSd" -Value 0 -Type DWord -Force

	# File Explorer: Show hidden files and file extensions
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Hidden" -Value 1 -Type DWord -Force
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "HideFileExt" -Value 0 -Type DWord -Force

	# File Explorer: Open to "This PC" instead of "Home"
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "LaunchTo" -Value 1 -Type DWord -Force

    Write-Output "Restarting explorer.exe to apply UI changes..."
    Stop-Process -Name "explorer" -Force -ErrorAction SilentlyContinue
}

Function DisableRemoteAssistance {
	# Disable Remote Assistance
	Set-ItemProperty -Path "HKLM:\System\CurrentControlSet\Control\Remote Assistance" -Name "fAllowToGetHelp" -Value 0 -Type DWord -Force
}

Function DisableSecurityQuestionsForLocalAccounts {
	# Disable Security Questions for Local Accounts
	$policyPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System"
	If (!(Test-Path $policyPath)) {
		New-Item -Path $policyPath -Force | Out-Null
	}
	Set-ItemProperty -Path $policyPath -Name "NoLocalPasswordResetQuestions" -Value 1 -Type DWord -Force
}

Function UninstallBloatware {
	# Productivity & Utilities
	Get-AppxPackage *Microsoft.Office.Desktop* | Remove-AppxPackage
	Get-AppxPackage *Clipchamp* | Remove-AppxPackage
	Get-AppxPackage *WindowsMaps* | Remove-AppxPackage
	Get-AppxPackage *GetHelp* | Remove-AppxPackage
	Get-AppxPackage *Getstarted* | Remove-AppxPackage
	Get-AppxPackage *WindowsFeedbackHub* | Remove-AppxPackage
	Get-AppxPackage *MicrosoftStickyNotes* | Remove-AppxPackage
	Get-AppxPackage *MicrosoftToDo* | Remove-AppxPackage
	Get-AppxPackage *OneNoteForWindows10* | Remove-AppxPackage
	#Get-AppxPackage *Windows.Photos* | Remove-AppxPackage # If you use an alternative photo viewer

	# Media & News
	Get-AppxPackage *ZuneMusic* | Remove-AppxPackage # (Groove Music)
	Get-AppxPackage *ZuneVideo* | Remove-AppxPackage # (Movies & TV)
	Get-AppxPackage *WindowsSoundRecorder* | Remove-AppxPackage
	Get-AppxPackage *Microsoft.BingNews* | Remove-AppxPackage
	Get-AppxPackage *Microsoft.BingWeather* | Remove-AppxPackage

	# Communication
	Get-AppxPackage *windowscommunicationsapps* | Remove-AppxPackage # (Mail and Calendar)
	Get-AppxPackage *SkypeApp* | Remove-AppxPackage
	Get-AppxPackage *MicrosoftTeams* | Remove-AppxPackage # Personal version of Teams (Chat icon)
}

Function UninstallCopilot {
	# AI
	Get-AppxPackage *Microsoft.Copilot* | Remove-AppxPackage
}

Function DisableHibernation {
	# Disable Hibernation and by extension Fast Startup
	powercfg.exe /hibernate off
}

Function EnableWindowsFeatures {
	dism.exe /online /enable-feature /all /norestart `
    /featurename:VirtualMachinePlatform `
    /featurename:HypervisorPlatform `
    /featurename:Containers-DisposableClientVM `
    /featurename:Microsoft-Windows-Subsystem-Linux
}

## END FUNCTIONS

# General
EnableClearRecentFiles
EnableNTFSLongPaths
SetBIOSTimeUTC
DisableRecall
DisableTelemetry
DisableOneDrive
DisablePostUpdateNotification
DisableHibernation
EnableWindowsFeatures

# UI
TweakExplorerAndUI
#ClassicRightClickMenu
HideLanguageBar
HideGallery
DisableStartWebSearch
HideLearnAboutPicture
DisableWindowsFeedback
DisableAppSuggestions

# Security
DisableRemoteAssistance
DisableSecurityQuestionsForLocalAccounts

#Bloatware 
UninstallCopilot
UninstallBloatware
