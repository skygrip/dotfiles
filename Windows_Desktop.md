# Windows Desktop Setup

Setup of a basic Windows Desktop

## Setup and Debloat

## BIOS

Start with updating the BIOS and loading defaults:

- Update BIOS/UEFI and Load Optimized Defaults

Review BIOS settings:

- Enable Memory Profile (XMP / DOCP / EXPO)
- Enable Re-Size BAR
- Enable Above 4G Decoding
- Enable Virtualization Technology (Intel VT-x / AMD-V)
- Set Restore on AC/Power Loss to Last State
- Disable "Halt On Error" to prevent "no keyboard detected" errors
- Disable CSM
- Enable TPM
- Enable Secure Boot
- Configure Fan Curves (Optional)
- Enable Wake on LAN (`Power On By PCI-E`)
- Set a BIOS Password (Optional)

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

- Disable Widgets, Taskview, and Search from Taskbar settings
- Unpin all default app tiles and disable "Show recently added apps" and "Show recommendations for tips, shortcuts, new apps".
- Ensure Hardware Accelerated GPU Scheduling is enabled. `System > Display > Graphics > Change default graphics settings`.
- Enable Core Isolation.
- Disable Remote Assistance.
- Set Date/Time to ISO time and add a UTC clock
- Disable Window Snap and Title Bar Window Shake
- Prevent the controller from opening Game Bar via the Game Bar Controller Settings.
- Set lid close action to do nothing (Optional)
- Set power button to shutdown not sleep workstation (Optional)
- Enable BitLocker Drive Encryption.
  - If an eGPU is used, disable BitLocker UEFI PCR 2 Setting (`gpedit.msc` > ... > BitLocker > OS Drive > UEFI Firmware Configuration).
  - Optionally enforce TPM and PIN (`gpedit.msc` > ... > BitLocker > OS Drive > Require Additional Authentication at Startup).
  - Optionally add a PIN protector: `manage-bde -protectors -add -TPMAndPIN C:`

#### Remote Access (Optional)

Disable Fast Startup, Standby & Hibernation.

```powershell
powercfg /h off
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

Set display to never turn off

```powershell
powercfg /change monitor-timeout-ac 0
```

Set the "When I close the lid" option to "Do nothing" for both On Battery and Plugged In

```powershell
# Set "Lid Close Action" to "Do Nothing" (0) when Plugged In (AC)
powercfg -setacvalueindex SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0
# Set "Lid Close Action" to "Do Nothing" (0) when On Battery (DC)
powercfg -setdcvalueindex SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0
# Apply
powercfg -setactive SCHEME_CURRENT

```

##### RDP

Enable RDP

```powershell
# Enable Remote Desktop
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name "fDenyTSConnections" -Value 0
Enable-NetFirewallRule -DisplayGroup "Remote Desktop"
```

##### Parsec

Install via Winget
```powershell
winget install --id Parsec.Parsec --override "/percomputer /silent" --accept-package-agreements --accept-source-agreements
```

Configure the following Host settings in the Parsec app:
   *   **Hosting**: `Enabled`
   *   **Install Parsec Virtual Display Driver**
   *   **Virtual Displays**: Set to `1`
   *   **Fallback to Virtual Display**: `Enabled`
   *   **Resolution**: Set to **`Use Client Resolution`** 
   *   **Decoder/Encoder**: Ensure H.265 (HEVC) codec is **`Enabled`** 
   *   **Audio Source**: Set to **`Parsec Virtual Audio`**

#### Automatic Maintenance (Optional)

- Configure Windows Update to automatically download and install updates.

  - Set Active Hours
  - Configure windows updates to auto install at 3am and reboot if necessary
  - `New-Item -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" -Force`
  - `Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" -Name "AUOptions" -Value 4`
  - `Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" -Name "ScheduledInstallTime" -Value 3`
  - OPTIONAL: Configure immediate reboot (NoAutoRebootWithLoggedOnUsers=0) This is required to force a reboot when a user is logged on.
  - `Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" -Name "NoAutoRebootWithLoggedOnUsers" -Value 0`

- Use Task Scheduler to run `winget upgrade --all` weekly.
  - `Register-ScheduledTask -TaskName "Weekly Winget Upgrade" -Action (New-ScheduledTaskAction -Execute "winget.exe" -Argument "upgrade --all --silent --disable-interactivity --accept-package-agreements --accept-source-agreements") -Trigger (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3am) -Principal (New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -RunLevel Highest) -Description "Automatically updates all winget packages weekly." -Force`
- Enable Storage Sense (System > Storage) to run monthly

## Software

### Package Managers

| Application                                      | Winget ID / Install Command                  |
| ------------------------------------------------ | -------------------------------------------- |
| [Git](https://git-scm.com/downloads)             | winget install -e -i --id Git.Git            |
| [Node.js (npm / npx)](https://nodejs.org/)       | winget install -e --id OpenJS.NodeJS         |
| [uv](https://astral.sh/uv/)                      | winget install -e --id astral-sh.uv          |

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
| [Obsidian](https://obsidian.md/)                              | winget install -e --id Obsidian.Obsidian       |
| [PowerToys](https://github.com/microsoft/PowerToys)           | winget install -e --id Microsoft.PowerToys     |
| [ProtonVPN](https://protonvpn.com/download)                   | winget install -e --id Proton.ProtonVPN        |
| [Qbittorrent](https://www.qbittorrent.org/download)           | winget install -e --id qBittorrent.qBittorrent |
| [Speedcrunch](https://speedcrunch.org/)                       | winget install -e --id SpeedCrunch.SpeedCrunch |
| [VLC](https://www.videolan.org/vlc/download-windows.html)     | winget install -e --id VideoLAN.VLC            |

### System Tools

| Application                                                                                                            | Winget ID                                        |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [Afterburner Beta](https://www.guru3d.com/download/msi-afterburner-beta-download/)                                     | winget install -e --id Guru3D.Afterburner.Beta   |
| [AIDA64](https://aida64.co.uk/download)                                                                                | winget install -e --id FinalWire.AIDA64.Extreme  |
| [HWInfo](https://www.hwinfo.com/download/)                                                                             | winget install -e --id REALiX.HWiNFO             |
| [Microsoft.PowerShell](https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows) | winget install -e --id Microsoft.PowerShell      |
| [Rivatuner Statistics Server](https://www.guru3d.com/download/rtss-rivatuner-statistics-server-download/)              | winget install -e --id Guru3D.RTSS               |
| [WinDirStat](https://windirstat.net/)                                                                                  | winget install -e --id WinDirStat.WinDirStat     |
| [Windows Terminal](https://aka.ms/terminal)                                                                            | winget install -e --id Microsoft.WindowsTerminal |
| [Winget-AutoUpdate](https://github.com/Romanitho/Winget-AutoUpdate)                                                    | winget install -e --id Romanitho.Winget-AutoUpdate |


### Office Applications

| Application                                                                           | Winget ID                                                |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [Google Drive](https://www.google.com/drive/download/)                                | winget install -e --id Google.GoogleDrive                |
| [LibreOffice](https://www.libreoffice.org/)                                           | winget install -e --id TheDocumentFoundation.LibreOffice |
| [Microsoft Office](https://www.microsoft.com/en-us/microsoft-365/download-office)     | winget install -e --id Microsoft.Office                  |
| [Microsoft Onedrive](https://www.microsoft.com/en-us/microsoft-365/onedrive/download) | winget install -e --id Microsoft.OneDrive                |
| [Microsoft Teams](https://teams.microsoft.com/downloads)                              | winget install -e --id Microsoft.Teams --scope user      |
| [MiKTeX](https://miktex.org/download)                                                 | winget install -e --id MiKTeX.MiKTeX                     |
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
| [ImageMagick](https://imagemagick.org/script/download.php)                                               | winget install -e --id ImageMagick.ImageMagick  |
| [Inkscape](https://inkscape.org/)                                                                         | winget install -e --id Inkscape.Inkscape         |
| [KiCad](https://www.kicad.org/)                                                                           | winget install -e --id KiCad.KiCad               |
| [Luminance HDR](http://qtpfsgui.sourceforge.net)                                                          |                                                  |
| [OpenSCAD](https://www.openscad.org/)                                                                     | winget install -e --id OpenSCAD.OpenSCAD         |

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

### AI Tools

| Application                                                        | Winget ID / Install Command                  |
| ------------------------------------------------------------------ | -------------------------------------------- |
| [AnythingLLM](https://useanything.com/)                            | winget install -e --id MintplexLabs.AnythingLLM |
| [Google Antigravity CLI](https://github.com/google/antigravity)    | npm install -g @google/antigravity            |
| [Google Gemini CLI](https://github.com/google/gemini-cli)          | npm install -g @google/gemini-cli            |
| [Hugging Face CLI](https://huggingface.co/docs/huggingface_hub/guides/cli) | uv tool install hf                           |
| [Jan](https://jan.ai/)                                             | winget install -e --id Jan.Jan               |
| [LM Studio](https://lmstudio.ai/)                                  | winget install -e --id ElementLabs.LMStudio  |
| [Nvidia CUDA Toolkit](https://developer.nvidia.com/cuda-downloads) | winget install -e --id Nvidia.CUDA           |
| [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent) | npm install -g @earendil-works/pi-coding-agent |
| [Stability Matrix](https://github.com/LykosAI/StabilityMatrix)     |  |
| [Topaz Photo AI](https://www.topazlabs.com/topaz-photo-ai)         | winget install -e --id TopazLabs.TopazPhotoAI |

For advanced AI configurations, global settings, prompt templates, local LLM endpoints, and custom agent extensions, see [AI.md](./AI.md).

### IDEs & Editors

| Application                                                                                              | Winget ID                                                      |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [Arduino IDE](https://www.arduino.cc/en/software/)                                                       | winget install -e --id ArduinoSA.IDE.stable                    |
| [Google Antigravity](https://antigravity.google)                                                         | winget install -e --id Google.Antigravity                      |
| [Mu Editor](https://codewith.mu/en/download)                                                             | winget install -e --id Mu.Mu                                   |
| [Notepad++](https://github.com/notepad-plus-plus/notepad-plus-plus/releases)                             | winget install -e --id Notepad++.Notepad++                     |
| [Sublime Text](https://www.sublimetext.com/)                                                             | winget install -e --id SublimeHQ.SublimeText.4                 |
| [Thonny IDE](https://thonny.org/)                                                                        | winget install -e --id AivarAnnamaa.Thonny                     |
| [Visual Studio Code](https://code.visualstudio.com/)                                                     | winget install -e --id Microsoft.VisualStudioCode --scope user |

### Development Tools

| Application                                                                                              | Winget ID                                                      |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [Android SDK Platform-Tools](https://developer.android.com/tools/releases/platform-tools)                | winget install -e --id Google.PlatformTools                    |
| [AWS CLI](https://awscli.amazonaws.com/AWSCLIV2.msi)                                                     | winget install -e --id Amazon.AWSCLI                           |
| [CMake](https://cmake.org/)                                                                              | winget install -e --id Kitware.CMake                           |
| [DuckDB CLI](https://duckdb.org/)                                                                        | winget install -e --id DuckDB.cli                              |
| [GitHub CLI](https://cli.github.com/)                                                                    | winget install -e --id GitHub.cli                              |
| [GitHub Desktop](https://desktop.github.com/)                                                            | winget install -e --id GitHub.GitHubDesktop --scope user       |
| [Google CloudSDK](https://cloud.google.com/sdk/docs/install)                                             | winget install -e --id Google.CloudSDK                         |
| [Google IAPDesktop](https://github.com/GoogleCloudPlatform/iap-desktop)                                  | winget install -e --id Google.IAPDesktop                       |
| [jq](https://jqlang.github.io/jq/)                                                                       | winget install -e --id jqlang.jq                              |
| [Microsoft SQL Server Management Studio](https://aka.ms/ssmsfullsetup)                                   | winget install -e --id Microsoft.SQLServerManagementStudio     |
| [Microsoft Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) | winget install -e --id Microsoft.VisualStudio.BuildTools |
| [Podman](https://github.com/containers/podman/)                                                          | winget install -e --id RedHat.Podman                           |
| [PowerBI](https://powerbi.microsoft.com/en-us/)                                                          | winget install -e --id Microsoft.PowerBI                       |
| [PuTTY](https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html)                                  | winget install -e --id PuTTY.PuTTY                             |
| [Raspberry Pi Imager](https://www.raspberrypi.com/software/)                                             | winget install -e --id RaspberryPiFoundation.RaspberryPiImager |
| [Rufus](https://github.com/pbatard/rufus)                                                                | winget install -e --id Rufus.Rufus                             |
| [RunJS](https://runjs.app/?ref=winstall)                                                                 | winget install -e --id lukehaas.RunJS --scope user             |
| [Rust](https://www.rust-lang.org/tools/install)                                                          | winget install -e --id Rustlang.Rustup                         |
| [Snyk CLI](https://snyk.io/)                                                                             | winget install -e --id Snyk.Snyk                               |
| [Virtualbox](https://www.virtualbox.org/wiki/Downloads)                                                  | winget install -e --id Oracle.VirtualBox                       |
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
| [ImHex](https://imhex.werwolv.net/)                                                               | winget install -e --id WerWolv.ImHex                         |
| [KAPE](https://www.kroll.com/en/insights/publications/cyber/kroll-artifact-parser-extractor-kape) |                                                              |
| [Maltego](https://www.maltego.com/downloads/)                                                     |                                                              |
| [PhotoRec](https://www.cgsecurity.org/wiki/PhotoRec)                                              |                                                              |
| [Plaso](https://github.com/log2timeline/plaso)                                                    |                                                              |
| [RegRipper](https://github.com/keydet89/RegRipper3.0)                                             |                                                              |
| [SysInternals](https://docs.microsoft.com/en-us/sysinternals/)                                    |                                                              |
| [VirusTotal CLI](https://github.com/VirusTotal/vt-cli)                                            | winget install -e --id VirusTotal.vt                         |
| [Volatility](https://github.com/volatilityfoundation/volatility3)                                 |                                                              |
| [YARA](https://github.com/VirusTotal/yara)                                                        | winget install -e --id VirusTotal.YARA                       |
| [Zimmerman Tools](https://ericzimmerman.github.io/)                                               |                                                              |

### Network Security Tools

| Application                                         | Winget ID                                            |
| --------------------------------------------------- | ---------------------------------------------------- |
| [Burp Suite Community](https://portswigger.net/burp/communitydownload) | winget install -e --id PortSwigger.BurpSuite.Community |
| [MITMProxy](https://github.com/mitmproxy/mitmproxy) | winget install -e --id mitmproxy.mitmproxy           |
| [Nmap](https://nmap.org/)                           | winget install -e --id Insecure.Nmap                 |
| [Postman](https://www.getpostman.com/downloads/)    | winget install -e --id Postman.Postman --scope user  |
| [Snort](https://www.snort.org/)                     |                                                      |
| [Wireshark](https://www.wireshark.org/)             | winget install -e --id WiresharkFoundation.Wireshark |
| [ZAProxy](https://github.com/zaproxy/zaproxy)       | winget install -e --id OWASP.ZAP                     |
| [Zeek](https://www.zeek.org/)                       |                                                      |

### Video Game Launchers

| Application                                                          | Winget ID                                          |
| -------------------------------------------------------------------- | -------------------------------------------------- |
| [Battle.net](https://www.blizzard.com/en-us/apps/battle.net/desktop) |                                                    |
| [CurseForge](https://download.curseforge.com/)                       |                                                    |
| [Epic Games](https://store.epicgames.com/en-US/)                     | winget install -e --id EpicGames.EpicGamesLauncher |
| [EA](https://www.ea.com/en-au/ea-app)                                | winget install -e --id ElectronicArts.EADesktop    |
| [Steam](https://store.steampowered.com/about/)                       | winget install -e --id Valve.Steam                 |
| [Twitch](https://www.twitch.tv/downloads)                            | winget install -e --id Twitch.Twitch               |

### Drivers

| Application                                                                                                                               | Winget ID                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [AMD Chipset Drivers](https://www.amd.com/en/support/download/drivers.html)                                                               |                                                         |
| [Canon EOS Webcam Utility](https://www.canon.com.au/services-and-apps/eos-webcam-utility)                                                 |                                                         |
| [CP210x USB to UART Bridge VCP Drivers](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)                                 |                                                         |
| [Dell Display and Peripheral Manager](https://www.dell.com/support/product-details/en-us/product/dell-display-peripheral-manager/drivers) | winget install -e --id Dell.DisplayAndPeripheralManager |
| [FTDI Virtual COM Port Drivers](https://ftdichip.com/drivers/vcp-drivers/)                                                                |                                                         |
| [GlosSI](https://github.com/Alia5/GlosSI/releases)                                                                                        |                                                         |
| [Logitech Capture](https://www.logitech.com/en-au/product/capture)                                                                        |                                                         |
| [Logitech Options](https://www.logitech.com/en-au/product/options)                                                                        | winget install -e --id Logitech.Options                 |
| [MSI Afterburner](https://www.guru3d.com/download/msi-afterburner-beta-download/)                                                         | winget install -e --id Guru3D.Afterburner               |
| [Nvidia Drivers](https://www.nvidia.com/Download/index.aspx?lang=en-us)                                                                   |                                                         |
| [WinBtrfs](https://github.com/maharmstone/btrfs)                                                                                          |                                                         |

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
Add-WindowsCapability -Online -Name Rsat.ServerManager.Tools~~~~0.0.1.0
Add-WindowsCapability –Online –Name Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0
```

## Disable Network Connected Standby

Network Connected Standby (Modern Standby or S0 Low Power Idle) can cause problems on laptops, e.g overheating in backpacks or draining the battery while supposedly asleep. Desktops typically use traditional S3 sleep, but some newer boards support Modern Standby.

You can review the available sleep states on your system to see what is supported:

```powershell
powercfg /availablesleepstates
```

A Desktop system will typically only list `Standby (S3)` and note that S0 Low Power Idle is not supported by the firmware.

```text
The following sleep states are available on this system:
    Standby (S3)

The following sleep states are not available on this system:
    Standby (S0 Low Power Idle)
        The system firmware does not support this standby state.
```

A Laptop system will typically list `Standby (S0 Low Power Idle)` and note that S3 is disabled when S0 low power idle is supported.

```text
The following sleep states are available on this system:
    Standby (S0 Low Power Idle) Network Connected

The following sleep states are not available on this system:
    Standby (S3)
        The system firmware does not support this standby state.
        This standby state is disabled when S0 low power idle is supported.
```

If Modern Standby is active on your machine, it's recommended to disable network connectivity during sleep to prevent background activity. Enable the Advanced Power Options:

```powershell
REG ADD HKLM\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\F15576E8-98B7-4186-B944-EAFA664402D9 /v Attributes /t REG_DWORD /d 2 /f
```

Disable Network Connectivity in Standby for both battery and plugged in:

```powershell
powercfg /setacvalueindex scheme_current sub_none F15576E8-98B7-4186-B944-EAFA664402D9 0
powercfg /setdcvalueindex scheme_current sub_none F15576E8-98B7-4186-B944-EAFA664402D9 0
powercfg /setactive scheme_current
```

To verify that connectivity in standby is disabled, run `powercfg /availablesleepstates`. You should see `Network Disconnected` or `Connectivity in standby is disabled by policy` under the `Standby (S0 Low Power Idle)` section.

## Disable Fast Startup and Hibernation

Fast Startup can cause issues with device initialization and dual-booting setups.
Note: The `powercfg /h off` command completely disables hibernation, which is required for Fast Startup to function. This also frees up the disk space previously used by `hiberfil.sys`.

```powershell
powercfg /h off
```

To verify that Fast Startup and Hibernation are disabled, run `powercfg /availablesleepstates`. Under the `Fast Startup` section, it should state `Hibernation is not available.`

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

### BGInfo - Desktop System Information

`BGInfo` is a utility from the Sysinternals suite that automatically displays relevant system information on the desktop wallpaper. This is useful for quickly identifying the configuration of a machine without opening multiple tools.

Install and configure

```powershell
cd $HOME\Build\SysInternals
$bginfoPath = "$HOME\Build\SysInternals\Bginfo64.exe"
Start-Process PowerShell.exe -ArgumentList "copy $bginfoPath C:\Windows\" -Wait -Verb RunAs
```

Create config file

- Set font to Consolas
- save file to `C:\Windows\Bginfo_config.bgi`

```BGInfo
Host Information
----------------------------
Host Name:	<Host Name>
User Name:	<User Name>
Boot Time:	<Boot Time>

Operating System
----------------------------
OS Version:	<OS Version>
Architecture:	<System Type>

Hardware
----------------------------
CPU:	<CPU>
Memory:	<Memory>

Disk Space
----------------------------
Volumes:	<Volumes>
```

Set to launch for all users on login

```powershell
$bginfoPath = "C:\Windows\Bginfo64.exe"
$startupFolder = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp" #  All Users startup folder path

# Create the shortcut in the "All Users" startup folder
$shortcutPath = Join-Path $startupFolder "BGInfo.lnk"
$wshell = New-Object -ComObject WScript.Shell
$shortcut = $wshell.CreateShortcut($shortcutPath)

$shortcut.TargetPath = "C:\Windows\Bginfo64.exe"
$shortcut.Arguments = "`"C:\Windows\Bginfo_config.bgi`" /TIMER 0 /SILENT"
$shortcut.Description = "Run BGInfo at startup to update desktop wallpaper for all users."
$shortcut.IconLocation = "C:\Windows\Bginfo64.exe"
$shortcut.Save()
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

Consider installing SSH Preview as Microsoft ships years old OpenSSH builds by default

```powershell
winget install -e --id Microsoft.OpenSSH.Preview
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

## R setup

```powershell
winget install -e -i --id RProject.R
winget install pandoc
uv tool install radian
```

```r
install.packages(c("languageserver","rmarkdown","httpgd","jsonlite","R6"))
install.packages(c('ggplot2','scales','lubridate'))
```

Enable r.plot.useHttpgd and r.bracketedPaste in VS Code settings.
Set r.rterm.windows to the path of radian.exe (use escaped \\ paths, eg. C:\\Users\\user)

## Python and UV Setup

Install `uv` via winget to manage your Python versions.

Use the `--default` flag to make python.exe available for general shell commands (this handles adding the `python` command to your PATH). Also install Python 3.12 for PyTorch.

```powershell
winget install -e --id astral-sh.uv
uv python install 3.13 --default
```

Pre-install global essential libraries for AI agents & general scripts:

```powershell
uv pip install --python 3.13 --system --break-system-packages -U requests httpx beautifulsoup4 lxml pandas numpy pillow pyyaml python-dotenv pydantic tqdm openpyxl duckdb orjson rich loguru
```

Install global CLI tools to PATH:

```powershell
uv tool install ruff
uv tool install ipython
uv tool install pip-audit
uv tool install bandit
uv tool install jupytext
uv tool install hf
uv tool install oletools
uv tool install pdfx
```

## OpenSCAD and BOSL2 Setup

OpenSCAD is installed via winget (listed in the Creative Tools software table). To install the **BOSL2 (Belfry OpenSCAD Library v2)** library on Windows:

```powershell
# Create the local OpenSCAD libraries directory
New-Item -ItemType Directory -Force -Path "$HOME\Documents\OpenSCAD\libraries"

# Clone the BOSL2 repository
git clone https://github.com/revarbat/BOSL2.git "$HOME\Documents\OpenSCAD\libraries\BOSL2"
```

To use BOSL2 in your `.scad` scripts, include it at the top of your file:

```openscad
include <BOSL2/std.scad>
```

## WSL2

Install WSL2 and Arch Linux.

```powershell
wsl --install
wsl --install -d ArchLinux
```

### Post-Install Arch Linux Configuration

Update the system and install the base development tools and shell environment.

> **Note:** The following commands are for **Arch Linux**.

```bash
# Initialize keyring and update
sudo pacman -Sy --noconfirm archlinux-keyring
sudo pacman -Syu --noconfirm

# Install base development and common utility packages
sudo pacman -S --needed --noconfirm \
    base-devel \
    git \
    wget \
    curl \
    unzip \
    p7zip \
    vim \
    neovim \
    zsh \
    htop \
    jq \
    ripgrep \
    fd \
    bat \
    eza
    
# Configure ZSH (using Grml)
sudo wget -O /etc/zsh/zshrc https://git.grml.org/f/grml-etc-core/etc/zsh/zshrc
sudo chsh -s /bin/zsh $USER
echo '[[ -e ~/.profile ]] && emulate sh -c "source ~/.profile"' >> ~/.zshrc
```

### Forensics & Malware Analysis Toolkit

Install tools specifically for analyzing hostile email attachments, PDFs, and OLE documents.

**System Packages**

```bash
sudo pacman -S --needed --noconfirm \
    perl-image-exiftool \
    yara \
    python-pip \
    python-virtualenv \
    python-beautifulsoup4 \
    python-dateutil \
    clamav \
    upx \
    strace \
    ltrace \
    radare2 \
    gdb \
    binwalk \
    qpdf \
    poppler \
    mupdf-tools \
    cabextract
```

**Python Analysis Tools via PIP**

Installs `oletools` (standard for office docs), `pdfx`, and other parsers globally.

```bash
# Note: Using --break-system-packages to install globally in the WSL container for convenience.
# Alternatively, use pipx or a virtualenv.
pip install --break-system-packages \
    oletools \
    olefile \
    pdfx \
    peepdf \
    eml_parser \
    msg-parser \
    xlmmacrodeobfuscator \
    msoffcrypto-tool \
    shodan \
    virustotal-api \
    yara-python
```

**Didier Stevens Suite (and friends)**

Scripts for deep inspection of PDF and OLE structures.

```bash
# Create a local bin directory
mkdir -p ~/bin

# oledump.py (Analyze OLE streams)
wget -O /tmp/oledump.zip https://didierstevens.com/files/software/oledump_V0_0_77.zip
unzip -j -d ~/bin /tmp/oledump.zip oledump.py plugin_*.py
chmod +x ~/bin/oledump.py

# pdf-parser.py (Parse PDF structures)
wget -O ~/bin/pdf-parser.py https://raw.githubusercontent.com/DidierStevens/DidierStevensSuite/master/pdf-parser.py
chmod +x ~/bin/pdf-parser.py

# pdfid.py (PDF Metadata/Anomaly detection)
wget -O /tmp/pdfid.zip https://didierstevens.com/files/software/pdfid_v0_2_8.zip
unzip -j -d ~/bin /tmp/pdfid.zip pdfid.py
chmod +x ~/bin/pdfid.py

# pdftool.py
wget -O ~/bin/pdftool.py https://raw.githubusercontent.com/DidierStevens/DidierStevensSuite/master/pdftool.py
chmod +x ~/bin/pdftool.py

# zipdump.py (Analyze zip structures, handy for jar/apk/docx)
wget -O ~/bin/zipdump.py https://raw.githubusercontent.com/DidierStevens/DidierStevensSuite/master/zipdump.py
chmod +x ~/bin/zipdump.py

# emldump.py (Analyze EML files)
wget -O ~/bin/emldump.py https://raw.githubusercontent.com/DidierStevens/DidierStevensSuite/master/emldump.py
chmod +x ~/bin/emldump.py

# base64dump.py
wget -O ~/bin/base64dump.py https://raw.githubusercontent.com/DidierStevens/DidierStevensSuite/master/base64dump.py
chmod +x ~/bin/base64dump.py

# Add ~/bin to PATH in ZSH
echo 'export PATH=$PATH:~/bin' >> ~/.zshrc
```

### Safety & Isolation (Recommended)

To run malware analysis safely, prevent WSL from executing Windows binaries or appending the Windows path.

```bash
# Disable Windows Interop
sudo sh -c 'echo "[interop]" >> /etc/wsl.conf'
sudo sh -c 'echo "enabled=false" >> /etc/wsl.conf'
sudo sh -c 'echo "appendWindowsPath=false" >> /etc/wsl.conf'

# Apply changes (requires wsl --shutdown)
```
