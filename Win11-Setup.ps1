#Requires -RunAsAdministrator

# Enable clearing of recent files on exit
# Empties most recently used (MRU) items lists such as 'Recent Items' menu on the Start menu, jump lists, and shortcuts at the bottom of the 'File' menu in applications during every logout.
Function EnableClearRecentFiles {
	Write-Output "Enabling clearing of recent files on exit..."
	foreach ($hive in @("HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer", "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer")) {
		If (!(Test-Path $hive)) {
			New-Item -Path $hive -Force | Out-Null
		}
		Set-ItemProperty -Path $hive -Name "ClearRecentDocsOnExit" -Type DWord -Value 1 -Force
	}
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

# Hide Gallery from Explorer
Function HideGallery {
	Write-Output "Hiding Gallery..."
	If (!(Test-Path "HKCU:\Software\Classes\CLSID\{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}")) {
		New-Item -Path "HKCU:\Software\Classes\CLSID\{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}" -Force | Out-Null
	}
	Set-ItemProperty -Path "HKCU:\Software\Classes\CLSID\{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}" -Name "System.IsPinnedToNameSpaceTree" -Type DWord -Value 0 -Force
}

Function DisableStartWebSearch {
	# Disables Web Search in Start Menu (Windows 11 22H2-26H2)
	Write-Output "Disabling Bing Web Search in Start Menu..."
	foreach ($hive in @("HKCU:\Software\Policies\Microsoft\Windows\Explorer", "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Explorer")) {
		If (!(Test-Path $hive)) {
			New-Item -Path $hive -Force | Out-Null
		}
		Set-ItemProperty -Path $hive -Name "DisableSearchBoxSuggestions" -Value 1 -Type DWord -Force
	}
}

Function HideLearnAboutPicture {
	# Turn off Learn about this picture
	Write-Output "Disabling Learn about this picture..."
	$picture = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\HideDesktopIcons\NewStartPanel"
	If (!(Test-Path $picture)) {
		New-Item -Path $picture -Force | Out-Null
	}
	Set-ItemProperty -Path $picture -Name "{2cc5ca98-6485-489a-920e-b3e88a6ccce3}" -Value 1 -Type DWord -Force
}

Function DisableRecall {
	# Turn off Recall, Click to Do, Settings AI Agent, and AI Agent Connectors (Windows 11 24H2-26H2)
	Write-Output "Disabling Recall, Click to Do, and Windows AI agents..."
	$recall = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsAI"
	If (!(Test-Path $recall)) {
		New-Item -Path $recall -Force | Out-Null
	}
	Set-ItemProperty -Path $recall -Name "DisableAIDataAnalysis" -Value 1 -Type DWord -Force
	Set-ItemProperty -Path $recall -Name "AllowRecallEnablement" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path $recall -Name "DisableClickToDo" -Value 1 -Type DWord -Force
	Set-ItemProperty -Path $recall -Name "DisableSettingsAgent" -Value 1 -Type DWord -Force
	Set-ItemProperty -Path $recall -Name "ConfigureAgentConnectors" -Value 2 -Type DWord -Force

	$recalluser = "HKCU:\SOFTWARE\Policies\Microsoft\Windows\WindowsAI"
	If (!(Test-Path $recalluser)) {
		New-Item -Path $recalluser -Force | Out-Null
	}
	Set-ItemProperty -Path $recalluser -Name "DisableAIDataAnalysis" -Value 1 -Type DWord -Force
	Set-ItemProperty -Path $recalluser -Name "DisableClickToDo" -Value 1 -Type DWord -Force
}

Function DisableWindowsFeedback {
	# Disables Windows Feedback Experience
	Write-Output "Disabling Windows Feedback Experience program..."
	$Advertising = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo"
	If (!(Test-Path $Advertising)) {
		New-Item -Path $Advertising -Force | Out-Null
	}
	Set-ItemProperty -Path $Advertising -Name "Enabled" -Value 0 -Type DWord -Force

	# Stops the Windows Feedback Experience from sending anonymous data
	Write-Output "Stopping the Windows Feedback Experience program..."
	$Period = "HKCU:\Software\Microsoft\Siuf\Rules"
	If (!(Test-Path $Period)) {
		New-Item -Path $Period -Force | Out-Null
	}
	Set-ItemProperty -Path $Period -Name "PeriodInNanoSeconds" -Value 0 -Type DWord -Force
}

Function DisableAppSuggestions {
	# Prevents bloatware applications from returning and removes Start Menu suggestions
	Write-Output "Adding Registry keys to prevent bloatware apps and suggestions from returning..."
	$registryPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent"
	$registryOEM = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"
	If (!(Test-Path $registryPath)) {
		New-Item -Path $registryPath -Force | Out-Null
	}
	Set-ItemProperty -Path $registryPath -Name "DisableWindowsConsumerFeatures" -Value 1 -Type DWord -Force
	Set-ItemProperty -Path $registryPath -Name "DisableCopilotPinScreen" -Value 1 -Type DWord -Force
	Set-ItemProperty -Path $registryPath -Name "DisableConsumerAccountStateContent" -Value 1 -Type DWord -Force
	Set-ItemProperty -Path $registryPath -Name "DisableGetStarted" -Value 1 -Type DWord -Force

	If (!(Test-Path $registryOEM)) {
		New-Item -Path $registryOEM -Force | Out-Null
	}
	Set-ItemProperty -Path $registryOEM -Name "ContentDeliveryAllowed" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path $registryOEM -Name "OemPreInstalledAppsEnabled" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path $registryOEM -Name "PreInstalledAppsEnabled" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path $registryOEM -Name "PreInstalledAppsEverEnabled" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path $registryOEM -Name "SilentInstalledAppsEnabled" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path $registryOEM -Name "SubscribedContent-338388Enabled" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path $registryOEM -Name "SubscribedContent-338389Enabled" -Value 0 -Type DWord -Force
}

Function DisableTelemetry {
	Write-Output "Disabling Telemetry and Data Collection..."
	# Disable the Connected User Experiences and Telemetry Service
	Stop-Service DiagTrack -ErrorAction SilentlyContinue
	Set-Service DiagTrack -StartupType Disabled -ErrorAction SilentlyContinue

	# Disable Downloaded Maps Manager
	Stop-Service MapsBroker -ErrorAction SilentlyContinue
	Set-Service MapsBroker -StartupType Disabled -ErrorAction SilentlyContinue

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

    # Attempt uninstallation using the winget package manager
    Write-Output "Attempting uninstallation via winget..."
    winget.exe uninstall --id Microsoft.OneDrive --exact --silent --force --accept-source-agreements

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
	If (!(Test-Path $finishSetupPath)) { New-Item -Path $finishSetupPath -Force | Out-Null }
	Set-ItemProperty -Path $finishSetupPath -Name "SubscribedContent-310093Enabled" -Value 0 -Type DWord -Force

	$engagementPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\UserProfileEngagement"
	If (!(Test-Path $engagementPath)) { New-Item -Path $engagementPath -Force | Out-Null }
	Set-ItemProperty -Path $engagementPath -Name "ScoobeSystemSettingEnabled" -Value 0 -Type DWord -Force
}

Function TweakExplorerAndUI {
	# Start Menu: Disable recommendations, recently added apps, and account notifications (24H2-26H2)
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Start_IrisRecommendations" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Start_TrackDocs" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Start_AccountNotifications" -Value 0 -Type DWord -Force

	$startPolicy = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Explorer"
	If (!(Test-Path $startPolicy)) { New-Item -Path $startPolicy -Force | Out-Null }
	Set-ItemProperty -Path $startPolicy -Name "HideRecentlyAddedApps" -Value 1 -Type DWord -Force
	Set-ItemProperty -Path $startPolicy -Name "HideRecommendedSection" -Value 1 -Type DWord -Force
	Set-ItemProperty -Path $startPolicy -Name "HideTaskViewButton" -Value 1 -Type DWord -Force

	# Accessibility: Disable Sticky Keys, Filter Keys, and Toggle Keys hotkeys
	Set-ItemProperty -Path "HKCU:\Control Panel\Accessibility\StickyKeys" -Name "Flags" -Value "58" -Type String -Force
	Set-ItemProperty -Path "HKCU:\Control Panel\Accessibility\Keyboard Response" -Name "Flags" -Value "122" -Type String -Force
	Set-ItemProperty -Path "HKCU:\Control Panel\Accessibility\ToggleKeys" -Name "Flags" -Value "58" -Type String -Force

	# Multitasking: Disable Snap Windows, Snap Assist Flyout, and Shake to Minimize
	Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "WindowArrangementActive" -Value "0" -Type String -Force
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "EnableSnapAssistFlyout" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "DisallowShaking" -Value 1 -Type DWord -Force

	# Taskbar: Disable "Peek at desktop" button, Task View button, and Search box
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarSd" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowTaskViewButton" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search" -Name "SearchboxTaskbarMode" -Value 0 -Type DWord -Force

	# File Explorer: Show hidden files and file extensions
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Hidden" -Value 1 -Type DWord -Force
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "HideFileExt" -Value 0 -Type DWord -Force

	# File Explorer: Open to "This PC" instead of "Home"
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "LaunchTo" -Value 1 -Type DWord -Force

	# File Explorer: Disable Office.com files and sync provider notifications (OneDrive ads)
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowSyncProviderNotifications" -Value 0 -Type DWord -Force
	Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer" -Name "ShowCloudFilesInQuickAccess" -Value 0 -Type DWord -Force
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
	Write-Output "Removing pre-installed bloatware applications..."
	$bloatware = @(
		# Productivity & Utilities
		"*Microsoft.Office.Desktop*"
		"*Clipchamp*"
		"*GetHelp*"
		"*Getstarted*"
		"*WindowsFeedbackHub*"
		"*MicrosoftStickyNotes*"
		"*MicrosoftToDo*"
		"*Windows.DevHome*"
		# Media, Games & News
		"*WindowsSoundRecorder*"
		"*Microsoft.BingNews*"
		"*Microsoft.BingWeather*"
		"*Microsoft.BingSearch*"
		"*Microsoft.MicrosoftSolitaireCollection*"
		# Communication
		"*OutlookForWindows*"
		"*MicrosoftTeams*"
	)

	foreach ($app in $bloatware) {
		Get-AppxPackage -Name $app -AllUsers -ErrorAction SilentlyContinue | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
		Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | Where-Object DisplayName -Like $app | Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | Out-Null
	}
}

Function UninstallCopilot {
	# AI: Remove package and enforce Group Policy block so updates do not reinstall it (24H2-26H2)
	Write-Output "Removing and blocking Windows Copilot..."
	Get-AppxPackage -Name "*Microsoft.Copilot*" -AllUsers -ErrorAction SilentlyContinue | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
	Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | Where-Object DisplayName -Like "*Microsoft.Copilot*" | Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | Out-Null

	foreach ($hive in @("HKCU:\Software\Policies\Microsoft\Windows\WindowsCopilot", "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot")) {
		If (!(Test-Path $hive)) { New-Item -Path $hive -Force | Out-Null }
		Set-ItemProperty -Path $hive -Name "TurnOffWindowsCopilot" -Value 1 -Type DWord -Force
	}

	foreach ($aiHive in @("HKCU:\SOFTWARE\Policies\Microsoft\Windows\WindowsAI", "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsAI")) {
		If (!(Test-Path $aiHive)) { New-Item -Path $aiHive -Force | Out-Null }
		Set-ItemProperty -Path $aiHive -Name "RemoveMicrosoftCopilotApp" -Value 1 -Type DWord -Force
	}
}

Function DisableHibernation {
	# Disable Hibernation and by extension Fast Startup
	powercfg.exe /hibernate off
}

Function EnableWindowsFeatures {
	dism.exe /online /enable-feature /all /norestart `
    /featurename:VirtualMachinePlatform `
    /featurename:HypervisorPlatform `
    /featurename:Microsoft-Windows-Subsystem-Linux
}

Function OptimizeMemoryAndPrefetch {
    Write-Output "Disabling SysMain and Application Pre-launch..."
    Stop-Service SysMain -ErrorAction SilentlyContinue
    Set-Service SysMain -StartupType Disabled -ErrorAction SilentlyContinue
    $appxPolicy = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Appx"
    If (!(Test-Path $appxPolicy)) { New-Item -Path $appxPolicy -Force | Out-Null }
    Set-ItemProperty -Path $appxPolicy -Name "AllowPrelaunch" -Value 0 -Type DWord -Force
}

Function SetGpuTdrDelay {
    Write-Output "Increasing GPU TDR timeout to 30s for heavy LLM prefill..."
    $gfxPath = "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers"
    Set-ItemProperty -Path $gfxPath -Name "TdrDelay" -Value 30 -Type DWord -Force
    Set-ItemProperty -Path $gfxPath -Name "TdrDdiDelay" -Value 30 -Type DWord -Force
}

Function DisableEdgeBackground {
    Write-Output "Disabling Microsoft Edge Startup Boost and Background Extensions..."
    $edgePolicy = "HKLM:\SOFTWARE\Policies\Microsoft\Edge"
    If (!(Test-Path $edgePolicy)) { New-Item -Path $edgePolicy -Force | Out-Null }
    Set-ItemProperty -Path $edgePolicy -Name "StartupBoostEnabled" -Value 0 -Type DWord -Force
    Set-ItemProperty -Path $edgePolicy -Name "BackgroundModeEnabled" -Value 0 -Type DWord -Force
}

Function DisableWidgets {
    Write-Output "Disabling Windows Widgets..."
    $dshPolicy = "HKLM:\SOFTWARE\Policies\Microsoft\Dsh"
    If (!(Test-Path $dshPolicy)) { New-Item -Path $dshPolicy -Force | Out-Null }
    Set-ItemProperty -Path $dshPolicy -Name "AllowNewsAndInterests" -Value 0 -Type DWord -Force
    Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarDa" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
}

Function CleanStartupNagware {
    Write-Output "Removing startup nagware and helper stubs..."
    $logiRun = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
    If (Get-ItemProperty -Path $logiRun -Name "Logitech Download Assistant" -ErrorAction SilentlyContinue) {
        Remove-ItemProperty -Path $logiRun -Name "Logitech Download Assistant" -Force -ErrorAction SilentlyContinue
    }
}

Function EnableDeveloperErgonomics {
    Write-Output "Enabling Taskbar 'End Task' option and unprivileged Symlinks..."
    # Add 'End Task' to right-click menu on Taskbar icons
    $devTaskbar = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced\TaskbarDeveloperSettings"
    If (!(Test-Path $devTaskbar)) { New-Item -Path $devTaskbar -Force | Out-Null }
    Set-ItemProperty -Path $devTaskbar -Name "TaskbarEndTask" -Value 1 -Type DWord -Force

    # Allow creating symlinks (git, uv, python venvs) without elevation
    $devMode = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock"
    If (!(Test-Path $devMode)) { New-Item -Path $devMode -Force | Out-Null }
    Set-ItemProperty -Path $devMode -Name "AllowDevelopmentWithoutDevLicense" -Value 1 -Type DWord -Force
}

Function DisableDeliveryOptimizationP2P {
    Write-Output "Disabling Windows Update P2P seeding (Delivery Optimization)..."
    $doPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization"
    If (!(Test-Path $doPath)) { New-Item -Path $doPath -Force | Out-Null }
    Set-ItemProperty -Path $doPath -Name "DODownloadMode" -Value 0 -Type DWord -Force
}

Function DisableGameDVR {
    Write-Output "Disabling background GameDVR recording hooks..."
    $gameConfig = "HKCU:\System\GameConfigStore"
    If (Test-Path $gameConfig) {
        Set-ItemProperty -Path $gameConfig -Name "GameDVR_Enabled" -Value 0 -Type DWord -Force
    }
    $gamePolicy = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR"
    If (!(Test-Path $gamePolicy)) { New-Item -Path $gamePolicy -Force | Out-Null }
    Set-ItemProperty -Path $gamePolicy -Name "AllowGameDVR" -Value 0 -Type DWord -Force
}


## END FUNCTIONS

# 1. Privacy, Telemetry & AI
DisableTelemetry
DisableWindowsFeedback
DisableRecall
DisableAppSuggestions
DisablePostUpdateNotification
DisableDeliveryOptimizationP2P

# 2. System, Security & Developer
EnableNTFSLongPaths
SetBIOSTimeUTC
EnableDeveloperErgonomics
EnableClearRecentFiles
DisableRemoteAssistance
DisableSecurityQuestionsForLocalAccounts
DisableHibernation

# 3. RAM, GPU & Compute
OptimizeMemoryAndPrefetch
SetGpuTdrDelay
DisableGameDVR
DisableEdgeBackground
CleanStartupNagware

# 4. UI, Taskbar & File Explorer
HideGallery
DisableStartWebSearch
HideLearnAboutPicture
DisableWidgets
TweakExplorerAndUI

# 5. App & Bloatware Removal
UninstallCopilot
UninstallBloatware
DisableOneDrive

# 6. Windows Features & Explorer Refresh
EnableWindowsFeatures

Write-Output "Restarting explorer.exe to apply all UI and taskbar changes..."
Stop-Process -Name "explorer" -Force -ErrorAction SilentlyContinue

Write-Output "Setup complete. A system reboot is recommended to finalize all changes."
