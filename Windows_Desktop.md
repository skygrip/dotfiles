# Windows Desktop Setup

# Setup and Debloat
## Windows 10
Run the following debloat too then also run the functions in [Win10-Setup.ps1](Win10-Setup.ps1)

    iwr -useb https://git.io/debloat|iex

## Windows 11

Make the following changes:

 * Install the latest [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170)
 * Disable Taskbar items: Search, Task View, Widgets, Chat
 * Enable Windows update for other Microsoft products
 * Open Microsoft Store and force all store apps to update (Currently Fixes Winget)
 * Uninstall the default bloat apps
 * Set taskbar time to ISO mode, and add a UTC clock
 * Fix language settings so the language switcher isnt there
 * In folder settings, disable "show files from office.com"
 * Disable "Hide extensions for known file types" and Hidden Files
 * Disable StickyKeys and ToggleKeys
 * Disable Remote Assistance
 * Enable RDP (If Applicable)
 * Enable Core Isolation
 * In Windows features Enable:
    * Virtual Machine Platform
    * Windows Hypervisor Platform
    * Windows Sandbox
    * Windows Subsystem for Linux
 * Run the functions in [Win11-Setup.ps1](Win11-Setup.ps1) as Administrator
 * Enable Bitlocker Drive Encryption
 * Disable "Select the far corner of the taskbar to show the desktop"
 * Disable Snap Windows and Title Bar Window Shake
 * Use autoruns to stop certain apps from starting

# Software

## General Tools

|Application|Winget ID|
|-----------|-----------|
|[7zip](https://www.7-zip.org/download.html) |winget install -e --id 7zip.7zip|
|[Adobe Reader](https://get.adobe.com/reader/)||
|[Calibre Ebook](https://calibre-ebook.com/download_windows64)|winget install -e --id calibre.calibre|
|[Chrome](https://www.google.com/chrome/)|winget install -e --id Google.Chrome|
|[Firefox](https://www.mozilla.org/en-US/firefox/new/)|winget install -e --id Mozilla.Firefox|
|[KeepassXC](https://keepassxc.org/)|winget install -e --id KeePassXCTeam.KeePassXC|
|[Kindle](https://www.amazon.com.au/kindle-dbs/fd/kcp)||
|[Microsoft.PowerShell](https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows)|winget install -e --id Microsoft.PowerShell|
|[OBSStudio](https://obsproject.com/)|winget install -e --id OBSProject.OBSStudio|
|[Parsec](https://parsec.app/)| winget install -e --id Parsec.Parsec|
|[PowerToys](https://github.com/microsoft/PowerToys)|winget install -e --id Microsoft.PowerToys|
|[ProtonVPN](https://protonvpn.com/download)|winget install -e --id ProtonTechnologies.ProtonVPN|
|[Speedcrunch](https://speedcrunch.org/)|winget install -e --id SpeedCrunch.SpeedCrunch|
|[VLC](https://www.videolan.org/vlc/download-windows.html)|winget install -e --id VideoLAN.VLC|
|[WinDirStat](https://windirstat.net/)|winget install -e --id WinDirStat.WinDirStat|
|[Windows Terminal](https://aka.ms/terminal)|winget install -e --id Microsoft.WindowsTerminal|

## Office Applications

|Application|Winget ID|
|-----------|-----------|
|[LibreOffice](https://www.libreoffice.org/)|winget install -e --id TheDocumentFoundation.LibreOffice|
|[Microsoft Office]()|winget install -e --id Microsoft.Office|
|[Microsoft Onedrive]()|winget install -e --id Microsoft.OneDrive|
|[Microsoft Teams](https://teams.microsoft.com/downloads)|winget install -e --id Microsoft.Teams --scope user|
|[Notion](https://www.notion.so/)|winget install -e --id Notion.Notion|
|[Thunderbird](https://www.thunderbird.net/en-US/)|winget install -e --id Mozilla.Thunderbird|

## Messaging Applications

|Application|Winget ID|
|-----------|-----------|
|[Discord](https://discordapp.com/)|winget install -e --id Discord.Discord  --scope user|
|[Gpg4win](https://www.gpg4win.org/)|winget install -e --id GnuPG.Gpg4win|
|[Slack](https://slack.com/intl/en-au/downloads/windows)|winget install -e --id SlackTechnologies.Slack|
|[Telegram](https://desktop.telegram.org/)|winget install -e --id Telegram.TelegramDesktop --scope user|
|[WhatsApp](https://www.whatsapp.com/download/?lang=en)|winget install -e --id WhatsApp.WhatsApp --scope user|
|[Zoom](https://zoom.us/support/download)|winget install -e --id Zoom.Zoom|

## Creative Tools

|Application|Winget ID|
|-----------|-----------|
|[Adobe Creative Cloud](https://creativecloud.adobe.com/apps/download/creative-cloud)||
|[Blender](https://www.blender.org/)|winget install -e --id BlenderFoundation.Blender|
|[Darktable](https://www.darktable.org/install/)|winget install -e --id darktable.darktable|
|[FreeCAD](https://www.freecadweb.org/)|winget install -e --id FreeCAD.FreeCAD|
|[GIMP](https://www.gimp.org/)|winget install -e --id GIMP.GIMP|
|[Handbrake](https://handbrake.fr/downloads.php)|winget install -e --id HandBrake.HandBrake|
|[Hugin](http://hugin.sourceforge.net/download/)|winget install -e --id Hugin.Hugin|
|[Inkscape](https://inkscape.org/)|winget install -e --id Inkscape.Inkscape|
|[Luminance HDR](http://qtpfsgui.sourceforge.net)||
|[OpenSCAD](https://www.openscad.org/)|winget install -e --id OpenSCAD.OpenSCAD|
|[Topaz Photo AI](https://www.topazlabs.com/topaz-photo-ai)|winget install -e --id TopazLabs.TopazPhotoAI|

## Manufacturing Tools

|Application|Winget ID|
|-----------|-----------|
|[Laser GRBL](https://github.com/arkypita/LaserGRBL)||
|[SuperSlicer](https://github.com/supermerill/SuperSlicer)||
|[Ultimaker Cura](https://ultimaker.com/software/ultimaker-cura)|winget install -e --id Ultimaker.Cura||

## Audio Tools

|Application|Winget ID|
|-----------|-----------|
|[Audacity](https://www.audacityteam.org/?ref=winstall)|winget install -e --id=Audacity.Audacity|
|[Equalizer APO](https://equalizerapo.com/download.html)
|[Lisp VST Plugin](https://plugins4free.com/plugin/1662/)
|[Nvidia Broadcast](https://www.nvidia.com/en-au/geforce/broadcasting/broadcast-app/)|winget install -e --id Nvidia.Broadcast|
|[ReaPlugs](https://www.reaper.fm/reaplugs/)

## Development Tools

|Application|Winget ID|
|-----------|-----------|
|[AWS CLI](https://awscli.amazonaws.com/AWSCLIV2.msi)|winget install -e --id Amazon.AWSCLI|
|[Git](https://git-scm.com/downloads)|winget install -e -i --id Git.Git|
|[GitHub Desktop](https://desktop.github.com/)|winget install -e --id GitHub.GitHubDesktop --scope user|
|[Notepad++](https://github.com/notepad-plus-plus/notepad-plus-plus/releases)|winget install -e --id Notepad++.Notepad++|
|[Podman](https://github.com/containers/podman/)|winget install -e --id RedHat.Podman|
|[PuTTY](https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html)|winget install -e --id PuTTY.PuTTY|
|[Python](https://www.python.org/downloads/windows/)|winget install -e -i --id Python.Python.3.10|
|[RaspberryPi Imager](https://www.raspberrypi.com/software/)|winget install -e --id RaspberryPiFoundation.RaspberryPiImager|
|[RunJS](https://runjs.app/?ref=winstall)|winget install -e --id lukehaas.RunJS --scope user|
|[Sublime Text](https://www.sublimetext.com/)| winget install -e --id SublimeHQ.SublimeText.4|
|[Virtualbox](https://www.virtualbox.org/wiki/Downloads)|winget install -e --id Oracle.VirtualBox|
|[Visual Studio Code](https://code.visualstudio.com/)|winget install -e --id Microsoft.VisualStudioCode --scope user|
|[VMWare Workstation](https://www.vmware.com/au/products/workstation-pro/workstation-pro-evaluation.html)
|[WinSCP](https://winscp.net/eng/download.php)|winget install -e --id WinSCP.WinSCP|

## Forensics Tools

|Application|Winget ID|
|-----------|-----------|
|[Arsenal Image Mounter](https://arsenalrecon.com/downloads/)
|[DB Browser for SQLite](https://sqlitebrowser.org/dl/)|winget install -e --id DBBrowserForSQLite.DBBrowserForSQLite|
|[Foremost](http://foremost.sourceforge.net/)
|[FTK Imager](https://accessdata.com/product-download/)
|[GSMARTControl](https://gsmartcontrol.sourceforge.io/home/index.php/Downloads)|winget install -e --id GSmartControl.GSmartControl|
|[HxD Hex Editor](https://mh-nexus.de/en/hxd/)
|[KAPE](https://www.kroll.com/en/insights/publications/cyber/kroll-artifact-parser-extractor-kape)
|[Maltego](https://www.maltego.com/downloads/)
|[pdf-tools](https://blog.didierstevens.com/programs/pdf-tools/)
|[PhotoRec](https://www.cgsecurity.org/wiki/PhotoRec)
|[Plaso](https://github.com/log2timeline/plaso)
|[RegRipper](https://github.com/keydet89/RegRipper2.8)
|[SysInternals](https://docs.microsoft.com/en-us/sysinternals/)
|[TimeSketch](https://github.com/google/timesketch)
|[Volatility](https://github.com/volatilityfoundation/volatility3)
|[Zimmerman Tools](https://ericzimmerman.github.io/)

## Network Security Tools

|Application|Winget ID|
|-----------|-----------|
|[MITMProxy](https://github.com/mitmproxy/mitmproxy)|winget install -e --id mitmproxy.mitmproxy|
|[Nmap](https://nmap.org/)|winget install -e --id Insecure.Nmap|
|[Postman](https://www.getpostman.com/downloads/)|winget install -e --id Postman.Postman --scope user|
|[Snort](https://www.snort.org/)
|[Wireshark](https://www.wireshark.org/)|winget install -e --id WiresharkFoundation.Wireshark|
|[ZAProxy](https://github.com/zaproxy/zaproxy)|winget install -e --id OWASP.ZAP|
|[Zeek](https://www.zeek.org/)

## Video Game Launchers

|Application|Winget ID|
|-----------|-----------|
|[Battle.net](https://www.blizzard.com/en-us/apps/battle.net/desktop)||
|[CurseForge](https://download.curseforge.com/)||
|[Epic Games](https://store.epicgames.com/en-US/)| winget install -e --id EpicGames.EpicGamesLauncher|
|[Origin](https://www.origin.com/aus/en-us/store/download)|winget install -e --id ElectronicArts.EADesktop|
|[Steam](https://store.steampowered.com/about/)|winget install -e --id Valve.Steam|
|[Twitch](https://www.twitch.tv/downloads)|winget install -e --id Twitch.Twitch|

## Drivers

|Application|Winget ID|
|-----------|-----------|
|[AMD Chipset Drivers](https://www.amd.com/en/support)||
|[Canon EOS Webcam Utility](https://www.canon.com.au/services-and-apps/eos-webcam-utility)||
|[GlosSI](https://github.com/Alia5/GlosSI/releases)||
|[Logitech Capture](https://www.logitech.com/en-au/product/capture)||
|[Logitech Options](https://www.logitech.com/en-au/product/options)|winget install -e --id Logitech.Options|
|[Nvidia Drivers](https://www.nvidia.com/Download/index.aspx?lang=en-us)||
|[WinBtrfs](https://github.com/maharmstone/btrfs)||

# Winget

Update supported apps

    winget upgrade --all

# Powershell Setup of administator tools

    Install-Module -Name ExchangeOnlineManagement
    Install-Module -Name Microsoft.Online.SharePoint.PowerShell
    Add-WindowsCapability –online –Name Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0
    Add-WindowsCapability -Online -Name Rsat.ServerManager.Tools~~~~0.0.1.0
    Add-WindowsCapability -Online -Name Rsat.BitLocker.Recovery.Tools~~~~0.0.1.0

# Sysinternals

This script will fetch the latest sysinternals and places it in the build directory. Doubles as an updater too.

    New-Item -Path $HOME\Build -ItemType directory
    New-Item -Path $HOME\Build\SysInternals -ItemType directory
    cd $HOME\Build\SysInternals
    Remove-Item $HOME\Build\SysInternals\*
    Invoke-WebRequest -Uri https://download.sysinternals.com/files/SysinternalsSuite.zip -OutFile SysinternalsSuite.zip
    Expand-Archive -Path SysinternalsSuite.zip -DestinationPath .
    Remove-Item SysinternalsSuite.zip
    $SdeletePath = "$HOME\Build\SysInternals\sdelete.exe"
    Start-Process PowerShell.exe -ArgumentList "copy $SdeletePath C:\Windows\" -Wait -Verb RunAs

# Rclone

This script will fetch the latest rclone and places it in the build directory and C:\Windows. Doubles as an updater too.
    
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

Create a Rclone command

    $rclone_path = "C:\Windows\rclone.exe"
    $rclone_config = "$ENV:AppData\rclone\rclone.conf"
    $rclone_service_name = "gdrive"
    $rclone_cachedir = "Q:\$rclone_service_name"
    $rclone_drive_letter = "Y"
    $rclone_log = "$ENV:AppData\rclone\rclone.log"
    $rclone_arguments = "mount ${rclone_service_name}:/ ${rclone_drive_letter}: --config ${rclone_config} --cache-dir ${rclone_cachedir} --no-console --log-file ${rclone_log} --vfs-cache-mode full --vfs-cache-max-age 8766h --vfs-cache-max-size 450G --file-perms 0777 --network-mode"

    # Check the command makes sense
    echo ($rclone_path + ' ' + $rclone_arguments)

Preload a VFS Cache

    rclone hashsum crc32 --checkers 8 /rclonepath

# Zimmerman Tools

    New-Item -Path $HOME\Build -ItemType directory
    New-Item -Path $HOME\Build\ZimmermanTools -ItemType directory
    cd $HOME\Build\ZimmermanTools
    Remove-Item $HOME\Build\ZimmermanTools\*
    Invoke-WebRequest -Uri https://f001.backblazeb2.com/file/EricZimmermanTools/Get-ZimmermanTools.zip -OutFile Get-ZimmermanTools.zip
    Expand-Archive -Path Get-ZimmermanTools.zip -DestinationPath .
    ./Get-ZimmermanTools.ps1

# OpenSSH client on Windows

Enable the SSH-Agent service:

    Set-Service ssh-agent -StartupType Automatic
    Start-Service ssh-agent

# Windows Terminal Configuration

Set Windows terminal theme to "One Half Dark"

Add some profiles

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

# Podman Setup

Setup machine

    podman machine init
    podman machine start

# R setup

    winget install -e -i --id RProject.R
    winget install pandoc
    pip install -U radian

    install.packages(c("languageserver","rmarkdown","httpgd","jsonlite","R6")
    install.packages(c('ggplot2','scales','lubridate'))

Enable r.plot.useHttpgd and r.bracketedPaste in VS Code settings.
Set r.rterm.windows to the path of radian.exe (use escaped \\ paths, eg. C:\\Users\\user)

# WSL2

Install WSL2

    wsl --install
    wsl --install -d debian
    wsl --install -d ubuntu

Check that WSL is running on version 2 with updates

    wsl --status
    wsl --list --all --verbose

Post Installation configuration

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

Python Tools

    pip install pdfx peepdf olefile mupdf

Install Didier Stevens Tools

    # PDF-Parser
    wget -O ~/.local/bin/pdf-parser.py https://raw.githubusercontent.com/DidierStevens/DidierStevensSuite/master/pdf-parser.py && chmod +x ~/.local/bin/pdf-parser.py
    ln -s ~/.local/bin/pdf-parser.py ~/.local/bin/pdf-parser

    # OleDump
    wget -O /tmp/oledump.zip https://didierstevens.com/files/software/oledump_V0_0_75.zip && unzip -e -d ~/.local/bin /tmp/oledump.zip && chmod +x ~/.local/bin/oledump.py
    ln -s ~/.local/bin/oledump.py ~/.local/bin/oledump

    # PDFID
    wget -O /tmp/pdfid.zip https://didierstevens.com/files/software/pdfid_v0_2_7.zip && unzip -e -d ~/.local/bin /tmp/pdfid.zip && chmod +x ~/.local/bin/pdfid.py
    ln -s ~/.local/bin/pdfid.py ~/.local/bin/pdfid

    # PDFTool
    wget -O ~/.local/bin/pdftool.py https://raw.githubusercontent.com/DidierStevens/DidierStevensSuite/master/pdftool.py && chmod +x ~/.local/bin/pdftool.py
    ln -s ~/.local/bin/pdftool.py ~/.local/bin/pdftool