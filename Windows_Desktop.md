# Windows Desktop Setup

Setup of a basic Windows Desktop

## Setup and Debloat

### Windows 11

Make the following changes:

#### Initial Setup

- Enable Windows update for other Microsoft products.
- Run Windows Update to install all available updates.
- Open Microsoft Store and update all installed apps (this can fix issues with `winget`).
- Install the latest [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist).

Run the functions in [Win11-Setup.ps1](Win11-Setup.ps1) as Administrator:

- Disables Windows Telemetry services and data collection.
- Disables the Windows Recall (AI snapshot) feature.
- Disables the Windows Feedback Experience program.
- Prevents the automatic installation of suggested apps and bloatware.
- Disables Bing web search results from appearing in the Start Menu.
- Sets the system's hardware clock to use UTC
- Enables support for file paths longer than 260 characters (Win32 Long Path Support).
- Automatically clears 'Recent Items' and application jump lists upon user logout.
- Hides the "Gallery" folder from the File Explorer sidebar.
- Hides the language bar from the taskbar.
- Disables the "Let's finish setting up your device" notifications that appear after updates.
- Hide "Learn about this picture" icon from the desktop wallpaper.
- Uninstall and disable OneDrive
- Removes bloatware pre-installed applications
- Disable icons for Search, Task View, Widgets, and Chat. Set the search icon to be hidden.
- Start Menu: Disable recommendations and recently added apps
- Accessibility: Disable Sticky/Filter/Toggle Keys
- Multitasking: Disable Snap Windows and Shake to Minimize
- Taskbar: Disable "Peek at desktop" button
- File Explorer: Show hidden files and file extensions
- File Explorer: Open to "This PC" instead of "Home"
- File Explorer: Disable Office.com files and sync provider notifications
- Enable Windows Features:
  - Virtual Machine Platform
  - Windows Hypervisor Platform
  - Windows Sandbox
  - Windows Subsystem for Linux

#### Manual Steps

- Unpin all default app tiles and disable "Show recently added apps" and "Show recommendations for tips, shortcuts, new apps".
- Ensure Hardware Accelerated GPU Scheduling is enabled. `System > Display > Graphics > Change default graphics settings`.
- Enable Core Isolation.
- Disable Remote Assistance.
- Prevent the controller from opening Game Bar via the Game Bar Controller Settings.
- Enable BitLocker Drive Encryption.
  - If an eGPU is used, disable BitLocker UEFI PCR 2 Setting (`gpedit.msc` > ... > BitLocker > OS Drive > UEFI Firmware Configuration).
  - Optionally enforce TPM and PIN (`gpedit.msc` > ... > BitLocker > OS Drive > Require Additional Authentication at Startup).
  - Optionally add a PIN protector: `manage-bde -protectors -add -TPMAndPIN C:`

#### Remote Access (Optional)

- For configuring a machine for remote access, ensuring it remains online.
- Enable Remote Desktop (RDP) `System > Remote Desktop`
- Configure 'Always On' Power Settings:
  - In Power Options, set the active plan to never sleep or hibernate when plugged in.
  - Disable Sleep and Hibernation from the shutdown menu.

#### Automatic Maintenance (Optional)

- Configure Windows Update to automatically download and install updates.
- Set Active Hours to prevent reboots during work hours.
- Use Task Scheduler to run `winget upgrade --all` weekly.
  - `Register-ScheduledTask -TaskName "Weekly Winget Upgrade" -Action (New-ScheduledTaskAction -Execute "winget.exe" -Argument "upgrade --all --silent --disable-interactivity --accept-package-agreements --accept-source-agreements") -Trigger (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3am) -Principal (New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -RunLevel Highest) -Description "Automatically updates all winget packages weekly." -Force`
- Enable Storage Sense (System > Storage) to automatically free up space monthly:
  - `Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\StorageSense\Parameters\StoragePolicy" -Name '01' -Value 30 -Type DWord -Force`

## Software

### General Tools

| Application                                                   | Winget ID                                      |
| ------------------------------------------------------------- | ---------------------------------------------- |
| [7zip](https://www.7-zip.org/download.html)                   | winget install -e --id 7zip.7zip               |
| [Adobe Reader](https://get.adobe.com/reader/)                 |                                                |
| [Calibre Ebook](https://calibre-ebook.com/download_windows64) | winget install -e --id calibre.calibre         |
| [Chrome](https://www.google.com/chrome/)                      | winget install -e --id Google.Chrome           |
| [Firefox](https://www.mozilla.org/en-US/firefox/new/)         | winget install -e --id Mozilla.Firefox         |
| [KeepassXC](https://keepassxc.org/)                           | winget install -e --id KeePassXCTeam.KeePassXC |
| [Kindle](https://www.amazon.com.au/kindle-dbs/fd/kcp)         |                                                |
| [OBSStudio](https://obsproject.com/)                          | winget install -e --id OBSProject.OBSStudio    |
| [PowerToys](https://github.com/microsoft/PowerToys)           | winget install -e --id Microsoft.PowerToys     |
| [ProtonVPN](https://protonvpn.com/download)                   | winget install -e --id Proton.ProtonVPN        |
| [Speedcrunch](https://speedcrunch.org/)                       | winget install -e --id SpeedCrunch.SpeedCrunch |
| [VLC](https://www.videolan.org/vlc/download-windows.html)     | winget install -e --id VideoLAN.VLC            |

### System Tools

| Application                                                                                                            | Winget ID                                        |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [Afterburner Beta](https://www.guru3d.com/download/msi-afterburner-beta-download/)                                     | winget install -e --id Guru3D.Afterburner.Beta   |
| [AIDA64](https://aida64.co.uk/download)                                                                                | winget install -e --id FinalWire.AIDA64.Extreme  |
| [HWInfo](https://www.hwinfo.com/download/)                                                                             | winget install -e --id REALiX.HWiNFO             |
| [Microsoft.PowerShell](https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows) | winget install -e --id Microsoft.PowerShell      |
| [Parsec](https://parsec.app/)                                                                                          | winget install -e --id Parsec.Parsec             |
| [Rivatuner Statistics Server](https://www.guru3d.com/download/rtss-rivatuner-statistics-server-download/)              | winget install -e --id Guru3D.RTSS               |
| [WinDirStat](https://windirstat.net/)                                                                                  | winget install -e --id WinDirStat.WinDirStat     |
| [Windows Terminal](https://aka.ms/terminal)                                                                            | winget install -e --id Microsoft.WindowsTerminal |

### Office Applications

| Application                                                                           | Winget ID                                                |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [Google Drive](https://www.google.com/drive/download/)                                | winget install -e --id Google.GoogleDrive                |
| [LibreOffice](https://www.libreoffice.org/)                                           | winget install -e --id TheDocumentFoundation.LibreOffice |
| [Microsoft Office](https://www.microsoft.com/en-us/microsoft-365/download-office)     | winget install -e --id Microsoft.Office                  |
| [Microsoft Onedrive](https://www.microsoft.com/en-us/microsoft-365/onedrive/download) | winget install -e --id Microsoft.OneDrive                |
| [Microsoft Teams](https://teams.microsoft.com/downloads)                              | winget install -e --id Microsoft.Teams --scope user      |
| [Tex Live](https://tug.org/texlive.html)                                              | winget install -e --id TeXLive.TexLive                   |
| [Thunderbird](https://www.thunderbird.net/en-US/)                                     | winget install -e --id Mozilla.Thunderbird               |

### Messaging Applications

| Application                                             | Winget ID                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| [Discord](https://discordapp.com/)                      | winget install -e --id Discord.Discord --scope user          |
| [Gpg4win](https://www.gpg4win.org/)                     | winget install -e --id GnuPG.Gpg4win                         |
| [Slack](https://slack.com/intl/en-au/downloads/windows) | winget install -e --id SlackTechnologies.Slack               |
| [Telegram](https://desktop.telegram.org/)               | winget install -e --id Telegram.TelegramDesktop --scope user |
| [WhatsApp](https://www.whatsapp.com/download/?lang=en)  | winget install -e --id WhatsApp.WhatsApp --scope user        |
| [Zoom](https://zoom.us/support/download)                | winget install -e --id Zoom.Zoom                             |

### Creative Tools

| Application                                                                                               | Winget ID                                        |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [Adobe Creative Cloud](https://creativecloud.adobe.com/apps/download/creative-cloud)                      | winget install -e --id Adobe.CreativeCloud       |
| [Autodesk Fusion 360](https://www.autodesk.com/products/fusion-360/overview?term=1-YEAR&tab=subscription) |                                                  |
| [Blender](https://www.blender.org/)                                                                       | winget install -e --id BlenderFoundation.Blender |
| [Darktable](https://www.darktable.org/install/)                                                           | winget install -e --id darktable.darktable       |
| [FreeCAD](https://www.freecadweb.org/)                                                                    | winget install -e --id FreeCAD.FreeCAD           |
| [GIMP](https://www.gimp.org/)                                                                             | winget install -e --id GIMP.GIMP                 |
| [Handbrake](https://handbrake.fr/downloads.php)                                                           | winget install -e --id HandBrake.HandBrake       |
| [Hugin](http://hugin.sourceforge.net/download/)                                                           | winget install -e --id Hugin.Hugin               |
| [Inkscape](https://inkscape.org/)                                                                         | winget install -e --id Inkscape.Inkscape         |
| [KiCad](https://www.kicad.org/)                                                                           | winget install -e --id KiCad.KiCad               |
| [Luminance HDR](http://qtpfsgui.sourceforge.net)                                                          |                                                  |
| [Ollama](https://ollama.com/download)                                                                     | winget install -e --id Ollama.Ollama             |
| [OpenSCAD](https://www.openscad.org/)                                                                     | winget install -e --id OpenSCAD.OpenSCAD         |
| [Topaz Photo AI](https://www.topazlabs.com/topaz-photo-ai)                                                | winget install -e --id TopazLabs.TopazPhotoAI    |

### Manufacturing Tools

| Application                                                                                      | Winget ID                                   |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| [Bambu Studio](https://bambulab.com/en/download/studio)                                          | winget install -e --id Bambulab.Bambustudio |
| [CrealityScan](https://www.creality.com/pages/download-cr-scan-otter)                            |                                             |
| [Laser GRBL](https://github.com/arkypita/LaserGRBL)                                              |                                             |
| [Lychee Slicer](https://lychee.mango3d.io/)                                                      |                                             |
| [Proton Workshop](https://www.anycubic.com/pages/anycubic-photon-workshop-3d-slicer-software)    |                                             |
| [PrusaSlicer](https://www.prusa3d.com)                                                           | winget install -e --id Prusa3D.PrusaSlicer  |
| [Ultimaker Cura](https://ultimaker.com/software/ultimaker-cura)                                  | winget install -e --id Ultimaker.Cura       |
| [Valentina Dev](https://bitbucket.org/valentinaproject/valentinaproject.bitbucket.io/downloads/) |                                             |

### Audio Tools

| Application                                                                          | Winget ID                                |
| ------------------------------------------------------------------------------------ | ---------------------------------------- |
| [Audacity](https://www.audacityteam.org/?ref=winstall)                               | winget install -e --id Audacity.Audacity |
| [Equalizer APO](https://equalizerapo.com/download.html)                              |                                          |
| [Lisp VST Plugin](https://plugins4free.com/plugin/1662/)                             |                                          |
| [Nvidia Broadcast](https://www.nvidia.com/en-au/geforce/broadcasting/broadcast-app/) | winget install -e --id Nvidia.Broadcast  |
| [ReaPlugs](https://www.reaper.fm/reaplugs/)                                          |                                          |

### Development Tools

| Application                                                                                              | Winget ID                                                      |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [Arduino IDE](https://www.arduino.cc/en/software/)                                                       | winget install -e --id ArduinoSA.IDE.stable                    |
| [AWS CLI](https://awscli.amazonaws.com/AWSCLIV2.msi)                                                     | winget install -e --id Amazon.AWSCLI                           |
| [Git](https://git-scm.com/downloads)                                                                     | winget install -e -i --id Git.Git                              |
| [GitHub Desktop](https://desktop.github.com/)                                                            | winget install -e --id GitHub.GitHubDesktop --scope user       |
| [Google CloudSDK](https://cloud.google.com/sdk/docs/install)                                             | winget install -e --id Google.CloudSDK                         |
| [Google IAPDesktop](https://github.com/GoogleCloudPlatform/iap-desktop)                                  | winget install -e --id Google.IAPDesktop                       |
| [Microsoft SQL Server Management Studio](https://aka.ms/ssmsfullsetup)                                   | winget install -e --id Microsoft.SQLServerManagementStudio     |
| [Mu Editor](https://codewith.mu/en/download)                                                             | winget install -e --id Mu.Mu                                   |
| [Notepad++](https://github.com/notepad-plus-plus/notepad-plus-plus/releases)                             | winget install -e --id Notepad++.Notepad++                     |
| [Podman](https://github.com/containers/podman/)                                                          | winget install -e --id RedHat.Podman                           |
| [PowerBI](https://powerbi.microsoft.com/en-us/)                                                          | winget install -e --id Microsoft.PowerBI                       |
| [PuTTY](https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html)                                  | winget install -e --id PuTTY.PuTTY                             |
| [Python](https://www.python.org/downloads/windows/)                                                      | winget install -e -i --id Python.Python.3.10                   |
| [Qbittorrent](https://www.qbittorrent.org/download)                                                      | winget install -e --id qBittorrent.qBittorrent                 |
| [Raspberry Pi Imager](https://www.raspberrypi.com/software/)                                             | winget install -e --id RaspberryPiFoundation.RaspberryPiImager |
| [Rufus](https://github.com/pbatard/rufus)                                                                | winget install -e --id Rufus.Rufus                             |
| [RunJS](https://runjs.app/?ref=winstall)                                                                 | winget install -e --id lukehaas.RunJS --scope user             |
| [Sublime Text](https://www.sublimetext.com/)                                                             | winget install -e --id SublimeHQ.SublimeText.4                 |
| [Thonny IDE](https://thonny.org/)                                                                        | winget install -e --id AivarAnnamaa.Thonny                     |
| [Virtualbox](https://www.virtualbox.org/wiki/Downloads)                                                  | winget install -e --id Oracle.VirtualBox                       |
| [Visual Studio Code](https://code.visualstudio.com/)                                                     | winget install -e --id Microsoft.VisualStudioCode --scope user |
| [VMWare Workstation](https://www.vmware.com/au/products/workstation-pro/workstation-pro-evaluation.html) | winget install -e --id VMware.WorkstationPro                   |
| [WinSCP](https://winscp.net/eng/download.php)                                                            | winget install -e --id WinSCP.WinSCP                           |

### Forensics Tools

| Application                                                                                       | Winget ID                                                    |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [Arsenal Image Mounter](https://arsenalrecon.com/downloads/)                                      |                                                              |
| [DB Browser for SQLite](https://sqlitebrowser.org/dl/)                                            | winget install -e --id DBBrowserForSQLite.DBBrowserForSQLite |
| [Foremost](http://foremost.sourceforge.net/)                                                      |                                                              |
| [FTK Imager](https://accessdata.com/product-download/)                                            |                                                              |
| [GSMARTControl](https://gsmartcontrol.sourceforge.io/home/index.php/Downloads)                    | winget install -e --id GSmartControl.GSmartControl           |
| [HxD Hex Editor](https://mh-nexus.de/en/hxd/)                                                     |                                                              |
| [KAPE](https://www.kroll.com/en/insights/publications/cyber/kroll-artifact-parser-extractor-kape) |                                                              |
| [Maltego](https://www.maltego.com/downloads/)                                                     |                                                              |
| [pdf-tools](https://blog.didierstevens.com/programs/pdf-tools/)                                   |                                                              |
| [PhotoRec](https://www.cgsecurity.org/wiki/PhotoRec)                                              |                                                              |
| [Plaso](https://github.com/log2timeline/plaso)                                                    |                                                              |
| [RegRipper](https://github.com/keydet89/RegRipper3.0)                                             |                                                              |
| [SysInternals](https://docs.microsoft.com/en-us/sysinternals/)                                    |                                                              |
| [Volatility](https://github.com/volatilityfoundation/volatility3)                                 |                                                              |
| [Zimmerman Tools](https://ericzimmerman.github.io/)                                               |                                                              |

### Network Security Tools

| Application                                         | Winget ID                                            |
| --------------------------------------------------- | ---------------------------------------------------- |
| [MITMProxy](https://github.com/mitmproxy/mitmproxy) | winget install -e --id mitmproxy.mitmproxy           |
| [Nmap](https://nmap.org/)                           | winget install -e --id Insecure.Nmap                 |
| [Postman](https://www.getpostman.com/downloads/)    | winget install -e --id Postman.Postman --scope user  |
| [Snort](https://www.snort.org/)                     |                                                      |
| [Wireshark](https://www.wireshark.org/)             | winget install -e --id WiresharkFoundation.Wireshark |
| [ZAProxy](https://github.com/zaproxy/zaproxy)       | winget install -e --id OWASP.ZAP                     |
| [Zeek](https://www.zeek.org/)                       |                                                      |

## Video Game Launchers

| Application                                                          | Winget ID                                          |
| -------------------------------------------------------------------- | -------------------------------------------------- |
| [Battle.net](https://www.blizzard.com/en-us/apps/battle.net/desktop) |                                                    |
| [CurseForge](https://download.curseforge.com/)                       |                                                    |
| [Epic Games](https://store.epicgames.com/en-US/)                     | winget install -e --id EpicGames.EpicGamesLauncher |
| [EA](https://www.ea.com/en-au/ea-app)                                | winget install -e --id ElectronicArts.EADesktop    |
| [Steam](https://store.steampowered.com/about/)                       | winget install -e --id Valve.Steam                 |
| [Twitch](https://www.twitch.tv/downloads)                            | winget install -e --id Twitch.Twitch               |

## Drivers

| Application                                                                                                                               | Winget ID                               |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| [AMD Chipset Drivers](https://www.amd.com/en/support/download/drivers.html)                                                               |                                         |
| [Canon EOS Webcam Utility](https://www.canon.com.au/services-and-apps/eos-webcam-utility)                                                 |                                         |
| [CP210x USB to UART Bridge VCP Drivers](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)                                 |                                         |
| [Dell Display and Peripheral Manager](https://www.dell.com/support/product-details/en-us/product/dell-display-peripheral-manager/drivers) |                                         |
| [FTDI Virtual COM Port Drivers](https://ftdichip.com/drivers/vcp-drivers/)                                                                |                                         |
| [GlosSI](https://github.com/Alia5/GlosSI/releases)                                                                                        |                                         |
| [Logitech Capture](https://www.logitech.com/en-au/product/capture)                                                                        |                                         |
| [Logitech Options](https://www.logitech.com/en-au/product/options)                                                                        | winget install -e --id Logitech.Options |
| [Nvidia Drivers](https://www.nvidia.com/Download/index.aspx?lang=en-us)                                                                   |                                         |
| [WinBtrfs](https://github.com/maharmstone/btrfs)                                                                                          |                                         |

## Winget

Update supported apps

```powershell
winget upgrade --all
```

## Powershell Setup of administrator tools

Set Execution Policy to RemoteSigned

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned
```

Install commonly used Powershell modules

```powershell
Install-Module -Name AzureAD
Install-Module -Name ExchangeOnlineManagement
Install-Module -Name Microsoft.Graph
Install-Module -Name Microsoft.Online.SharePoint.PowerShell
```

Optionally, also update the installed Powershell modules

```powershell
Update-Module
```

Also install some basic server management tools

```powershell
Add-WindowsCapability -Online -Name Rsat.BitLocker.Recovery.Tools~~~~0.0.1.0
Add-WindowsCapability -Online -Name Rsat.ServerManager.Tools~~~~0.0.1.0
Add-WindowsCapability –Online –Name Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0
```

## Disable Network Connected Standby

Network Connected Standby causes all kinds of problems on laptops.

Enable the Advanced Power Options:

```powershell
REG ADD HKLM\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\F15576E8-98B7-4186-B944-EAFA664402D9 /v Attributes /t REG_DWORD /d 2 /f
```

Then setting things in Power Options > Change Advanced Power Settings > Network connectivity in Standby > Disable both

## Sysinternals

This script will fetch the latest sysinternals and places it in the build directory. Doubles as an updater too.

```powershell
New-Item -Path $HOME\Build -ItemType directory
New-Item -Path $HOME\Build\SysInternals -ItemType directory
cd $HOME\Build\SysInternals
Remove-Item $HOME\Build\SysInternals\*
Invoke-WebRequest -Uri https://download.sysinternals.com/files/SysinternalsSuite.zip -OutFile SysinternalsSuite.zip
Expand-Archive -Path SysinternalsSuite.zip -DestinationPath .
Remove-Item SysinternalsSuite.zip
$SdeletePath = "$HOME\Build\SysInternals\sdelete.exe"
Start-Process PowerShell.exe -ArgumentList "copy $SdeletePath C:\Windows\" -Wait -Verb RunAs
```

## Rclone

This script will fetch the latest rclone and places it in the build directory and C:\Windows. Doubles as an updater too.

```powershell
New-Item -Path $HOME\Build -ItemType directory
New-Item -Path $HOME\Build\Rclone -ItemType directory
cd $HOME\Build\Rclone
Remove-Item $HOME\Build\Rclone\*
Invoke-WebRequest -Uri https://downloads.rclone.org/rclone-current-windows-amd64.zip -OutFile rclone-current-windows-amd64.zip
Expand-Archive -Path rclone-current-windows-amd64.zip -DestinationPath .
Remove-Item rclone-current-windows-amd64.zip
move rclone*\* .
Remove-item rclone-v*
$rclonePath = "$HOME\Build\Rclone\rclone.exe"
Start-Process PowerShell.exe -ArgumentList "copy $rclonePath C:\Windows\" -Wait -Verb RunAs
```

Create a Rclone command

```powershell
$rclone_path = "C:\Windows\rclone.exe"
$rclone_config = "$ENV:AppData\rclone\rclone.conf"
$rclone_service_name = "gdrive"
$rclone_cachedir = "Q:\$rclone_service_name"
$rclone_drive_letter = "Y"
$rclone_log = "$ENV:AppData\rclone\rclone.log"
$rclone_arguments = "mount ${rclone_service_name}:/ ${rclone_drive_letter}: --config ${rclone_config} --cache-dir ${rclone_cachedir} --no-console --log-file ${rclone_log} --vfs-cache-mode full --vfs-cache-max-age 8766h--vfs-cache-max-size 450G --file-perms 0777 --network-mode"
# Check the command makes sense
echo ($rclone_path + ' ' + $rclone_arguments)
```

Preload a VFS Cache

```powershell
rclone hashsum crc32 --checkers 8 /rclonepath
```

## EXIFTOOL

Download and install exiftool in a windows PATH

```powershell
New-Item -Path $HOME\Build -ItemType directory
cd $HOME\Build
Remove-Item $HOME\Build\exiftool.zip
Remove-Item $HOME\Build\exiftool
Invoke-WebRequest -Uri https://exiftool.org/exiftool-12.92_64.zip -OutFile exiftool.zip
Expand-Archive -Path exiftool.zip -DestinationPath $HOME\Build
Remove-Item $HOME\Build\exiftool.zip
move $HOME\Build\exiftool-* $HOME\Build\exiftool
cd $HOME\Build\exiftool
move 'exiftool(-k).exe' exiftool.exe
$PATH = [Environment]::GetEnvironmentVariable("PATH", "User")
$exiftool_path = "$HOME\Build\exiftool"
if( $PATH -notlike "*"+$exiftool_path+"*" ){
    [Environment]::SetEnvironmentVariable("PATH", "$PATH;$exiftool_path", "User")
}
```

## Android SDK Platform-Tools

Download and install Android SDK Platform-Tools in build folder

```powershell
New-Item -Path $HOME\Build -ItemType directory
cd $HOME\Build
Remove-Item $HOME\Build\Android-Platform-Tools
Invoke-WebRequest -Uri https://dl.google.com/android/repository/platform-tools_r34.0.4-windows.zip -OutFile platform-tools.zip
Expand-Archive -Path platform-tools.zip -DestinationPath .
move platform-tools android-platform-tools
Remove-item platform-tools.zip
```

## Zimmerman Tools

Download and install Zimmerman Tools in build folder

```powershell
New-Item -Path $HOME\Build -ItemType directory
New-Item -Path $HOME\Build\ZimmermanTools -ItemType directory
cd $HOME\Build\ZimmermanTools
Remove-Item $HOME\Build\ZimmermanTools\*
Invoke-WebRequest -Uri https://f001.backblazeb2.com/file/EricZimmermanTools/Get-ZimmermanTools.zip -OutFile Get-ZimmermanTools.zip
Expand-Archive -Path Get-ZimmermanTools.zip -DestinationPath .
./Get-ZimmermanTools.ps1 -NetVersion 6
mv net6/* .
```

## OpenSSH client on Windows

Consider installing SSH Beta as Microsoft ships years old OpenSSH versions

```powershell
winget install -e --id Microsoft.OpenSSH.Beta
```

Enable the SSH-Agent service:

```powershell
Set-Service ssh-agent -StartupType Automatic
Start-Service ssh-agent
```

## Putty PAgent setup

Download and install Putty PAgent

```powershell
winget install -e --id PuTTY.PuTTY
```

Start pagent on startup

```powershell
start "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\PuTTY (64-bit)\Pageant.lnk"
copy-item "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\PuTTY (64-bit)\Pageant.lnk" "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
```

## Windows Terminal Configuration

### Sync to OneDrive

To setup the sync do the following

```powershell
mkdir $Env:OneDrive\Backups\Terminal
cp $Env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\* $env:OneDrive\Backups\Terminal\
```

To use an existing sync do the following

```powershell
rmdir $Env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState
cmd  /c mklink /J $Env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState $env:OneDrive\Backups\Terminal
```

### Initial Setup

mkdir

Set Windows terminal theme to "One Half Dark"

Add some profiles

```json
    {
      "name": "SSH - server",
      "commandline": "ssh server",
      "hidden": false,
      "suppressApplicationTitle": true
    },
    {
      "name": "O365 Exchange Online",
      "commandline": "powershell.exe -NoExit Connect-ExchangeOnline",
      "hidden": false,
      "suppressApplicationTitle": true
    },
    {
      "name": "O365 Security & Compliance Centre",
      "commandline": "powershell.exe -NoExit Connect-IPPSSession",
      "hidden": false,
      "suppressApplicationTitle": true
    },
```

## Podman Setup

Setup machine

```powershell
podman machine init
podman machine start
```

## R setup

```powershell
winget install -e -i --id RProject.R
winget install pandoc
pip install -U radian
```

```r
install.packages(c("languageserver","rmarkdown","httpgd","jsonlite","R6"))
install.packages(c('ggplot2','scales','lubridate'))
```

Enable r.plot.useHttpgd and r.bracketedPaste in VS Code settings.
Set r.rterm.windows to the path of radian.exe (use escaped \\ paths, eg. C:\\Users\\user)

## VSCode Setup

Install useful extentions

```powershell
code --install-extension continue.continue
code --install-extension davidanson.vscode-markdownlint
code --install-extension esbenp.prettier-vscode
code --install-extension latex-workshop
code --install-extension mechatroner.rainbow-csv
code --install-extension ms-python.black-formatter
code --install-extension ms-python.debugpy
code --install-extension ms-python.isort
code --install-extension ms-python.pylint
code --install-extension ms-python.python
code --install-extension ms-python.vscode-pylance
code --install-extension ms-toolsai.datawrangler
code --install-extension ms-toolsai.jupyter
code --install-extension ms-toolsai.jupyter-keymap
code --install-extension ms-toolsai.jupyter-renderers
code --install-extension ms-toolsai.vscode-jupyter-cell-tags
code --install-extension ms-toolsai.vscode-jupyter-slideshow
code --install-extension ms-vscode.cmake-tools
code --install-extension ms-vscode.cpptools
code --install-extension ms-vscode.cpptools-extension-pack
code --install-extension ms-vscode.cpptools-themes
code --install-extension ms-vscode.powershell
code --install-extension ms-vscode.vscode-serial-monitor
code --install-extension redhat.vscode-xml
code --install-extension streetsidesoftware.code-spell-checker
code --install-extension twxs.cmake
```

## Ollama Setup

General Purpose Models

```powershell
ollama pull gemma3:12b
ollama pull llama3.1:8b
ollama pull phi4:14b
ollama pull qwen2.5:14b
```

Code Models

```powershell
ollama pull codegemma:7b
ollama pull codellama:13b
ollama pull codellama:13b-python
ollama pull qwen2.5-coder:14b
```

Tab Autocomplete Models

```powershell
ollama pull qwen2.5-coder:1.5b-base
ollama pull starcoder2:3b
ollama pull codegemma:2b-code
```

Embeddings Models

```powershell
ollama pull nomic-embed-text
```

Setup VSCode plugin Continue with the following config [VSCode_Continue_Config.json](VSCode_Continue_Config.json)

## WSL2

Install WSL2

```powershell
wsl --install
wsl --install -d debian
#wsl --install -d ubuntu
```

Check that WSL is running on version 2 with updates

```powershell
wsl --status
wsl --list --all --verbose
```

Post Installation configuration

```bash
# Update system
sudo apt update && sudo apt dist-upgrade
sudo apt install curl libimage-exiftool-perl yara python3-pip xpdf zsh shellcheck wget curl vim unzip imagemagick awscli ca-certificates gnupg lsb-release
# TODO
# Make the WSL subnet static so it doesnt collide with real ips
# Also fix the issues with VPN's
# ZSH config
sudo wget -O /etc/zsh/zshrc https://git.grml.org/f/grml-etc-core/etc/zsh/zshrc
sudo chsh -s /bin/zsh $USER
sudo chsh -s /bin/zsh root
echo """[[ -e ~/.profile ]] && emulate sh -c 'source ~/.profile'""" >> ~/.zshrc
zsh
# Fix Python version path
sudo ln -s /usr/bin/python3 /usr/bin/python
# Disable including windows paths
sudo sh -c 'echo "[interop]" >> /etc/wsl.conf'
sudo sh -c 'echo  "enabled=false" >> /etc/wsl.conf'
sudo sh -c 'echo  "appendWindowsPath=false" >> /etc/wsl.conf'
# Fix the bell
echo "set bell-style none" >> ~/.inputrc
```

Python Tools

```bash
sudo apt install mupdf-tools
pip install pdfx peepdf olefile mupdf
```

Install Didier Stevens Tools

```bash
# PDF-Parser
wget -O ~/bin/pdf-parser.py https://raw.githubusercontent.com/DidierStevens/DidierStevensSuite/master/pdf-parser.py && chmod +x ~/bin/pdf-parser.py

# OleDump
wget -O /tmp/oledump.zip https://didierstevens.com/files/software/oledump_V0_0_75.zip && unzip -e -d ~/bin /tmp/oledump.zip && chmod +x ~/bin/oledump.py

# PDFID
wget -O /tmp/pdfid.zip https://didierstevens.com/files/software/pdfid_v0_2_7.zip && unzip -e -d ~/bin /tmp/pdfid.zip && chmod +x ~/bin/pdfid.py

# PDFTool
wget -O ~/.local/bin/pdftool.py https://raw.githubusercontent.com/DidierStevens/DidierStevensSuite/master/pdftool.py && chmod +x ~/bin/pdftool.py
```
