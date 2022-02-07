# dotfiles

A collection of configuration files stored here for convenience.

# Windows Setup

## Debloat 
Run the following debloat too then also run the functions in Win10-Setup.ps1

    iwr -useb https://git.io/debloat|iex

## Software

General Tools:

-   [7zip](https://www.7-zip.org/download.html)
-   [Adobe Reader](https://get.adobe.com/reader/)
-   [Calibre Ebook](https://calibre-ebook.com/download_windows64)
-   [Chrome](https://www.google.com/chrome/)
-   [Discord](https://discordapp.com/)
-   [Dropbox](https://www.dropbox.com/install)
-   [Firefox](https://www.mozilla.org/en-US/firefox/new/)
-   [Gpg4win](https://www.gpg4win.org/)
-   [KeepassXC](https://keepassxc.org/)
-   [Kindle](https://www.amazon.com.au/kindle-dbs/fd/kcp)
-   [LibreOffice](https://www.libreoffice.org/)
-   [Microsoft Teams](https://teams.microsoft.com/downloads)
-   [Power Toys](https://github.com/microsoft/PowerToys)
-   [Speedcrunch](https://speedcrunch.org/)
-   [Thunderbird](https://www.thunderbird.net/en-US/)
-   [VLC](https://www.videolan.org/vlc/download-windows.html)
-   [WinDirStat](https://windirstat.net/)
-   [Windows Remote Desktop](https://www.microsoft.com/en-au/p/microsoft-remote-desktop/9wzdncrfj3ps)
-   [Windows Terminal](https://aka.ms/terminal)
-   [Zoom](https://zoom.us/support/download)

Creative Tools:

-   [Adobe Creative Cloud](https://creativecloud.adobe.com/apps/download/creative-cloud)
-   [Blender](https://www.blender.org/)
-   [FreeCAD](https://www.freecadweb.org/)
-   [GIMP](https://www.gimp.org/)
-   [Inkscape](https://inkscape.org/)
-   [OpenSCAD](https://www.openscad.org/)
-   [Luminance HDR](http://qtpfsgui.sourceforge.net)
-   [Hugin](http://hugin.sourceforge.net/download/)

Audio Tools:
-   [Equalizer APO](https://equalizerapo.com/download.html)
-   [Lisp VST Plugin](https://plugins4free.com/plugin/1662/)
-   [ReaPlugs](https://www.reaper.fm/reaplugs/)

Development Tools:

-   [Anaconda3](https://www.anaconda.com/)
-   [Atom](https://atom.io/)
-   [AWS CLI](https://awscli.amazonaws.com/AWSCLIV2.msi)
-   [AWS Shell](https://github.com/awslabs/aws-shell)
-   [Git](https://git-scm.com/downloads)
-   [GitHub Desktop](https://desktop.github.com/)
-   [PuTTY](https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html)
-   [Sandboxie](https://www.sandboxie.com/DownloadSandboxie)
-   [Virtualbox](https://www.virtualbox.org/wiki/Downloads)
-   [Visual Studio Code](https://code.visualstudio.com/)
-   [VMWare Workstation](https://www.vmware.com/au/products/workstation-pro/workstation-pro-evaluation.html)
-   [WinSCP](https://winscp.net/eng/download.php)

Forensics Tools:

-   [Arsenal Image Mounter](https://arsenalrecon.com/downloads/)
-   [DB Browser for SQLite](https://sqlitebrowser.org/dl/)
-   [Foremost](http://foremost.sourceforge.net/)
-   [FTK Imager](https://accessdata.com/product-download/)
-   [GSMARTControl](https://gsmartcontrol.sourceforge.io/home/index.php/Downloads)
-   [HxD Hex Editor](https://mh-nexus.de/en/hxd/)
-   [KAPE](https://www.kroll.com/en/insights/publications/cyber/kroll-artifact-parser-extractor-kape)
-   [Maltego](https://www.maltego.com/downloads/)
-   [pdf-tools](https://blog.didierstevens.com/programs/pdf-tools/)
-   [PhotoRec](https://www.cgsecurity.org/wiki/PhotoRec)
-   [Plaso](https://github.com/log2timeline/plaso)
-   [RegRipper](https://github.com/keydet89/RegRipper2.8)
-   [SysInternals](https://docs.microsoft.com/en-us/sysinternals/)
-   [TimeSketch](https://github.com/google/timesketch)
-   [Volatility](https://github.com/volatilityfoundation/volatility3)
-   [Zimmerman Tools](https://ericzimmerman.github.io/)

Network Security Tools:

-   [MITMProxy](https://github.com/mitmproxy/mitmproxy)
-   [Nmap](https://nmap.org/)
-   [Postman](https://www.getpostman.com/downloads/)
-   [Snort](https://www.snort.org/)
-   [Wireshark](https://www.wireshark.org/)
-   [ZAProxy](https://github.com/zaproxy/zaproxy)
-   [Zeek](https://www.zeek.org/)

Video Game Launchers:

-   [Battle.net](https://www.blizzard.com/en-us/apps/battle.net/desktop)
-   [Origin](https://www.origin.com/aus/en-us/store/download)
-   [Steam](https://store.steampowered.com/about/)
-   [Twitch](https://www.twitch.tv/downloads)

Drivers

-   [AMD Chipset Drivers](https://www.amd.com/en/support)
-   [Nvidia Drivers](https://www.nvidia.com/Download/index.aspx?lang=en-us)
-   [WinBtrfs](https://github.com/maharmstone/btrfs)
-   [Logitech Capture](https://www.logitech.com/en-au/product/capture)
-   [Logitech Options](https://www.logitech.com/en-au/product/options)
-   [Canon EOS Webcam Utility](https://www.canon.com.au/services-and-apps/eos-webcam-utility)

## Winget

    TODO This section

## Powershell Setup of additional tools

    Install-Module -Name ExchangeOnlineManagement
    Add-WindowsCapability –online –Name Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0
    Add-WindowsCapability -Online -Name Rsat.ServerManager.Tools~~~~0.0.1.0
    Add-WindowsCapability -Online -Name Rsat.BitLocker.Recovery.Tools~~~~0.0.1.0
    Enable-WindowsOptionalFeature -FeatureName "Containers-DisposableClientVM" -All -Online -NoRestart
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All -NoRestart

Then enable the following manually

    Core Isolation

## Sysinternals

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

## OpenSSH client on Windows

    # Install OpenSSH
    Add-WindowsCapability -Online -Name OpenSSH.Client*
    Set-Service ssh-agent -StartupType Automatic
    Start-Service ssh-agent

Add the workaround for ssh-agent, details [here](https://github.com/PowerShell/Win32-OpenSSH/issues/1234):

    Add-WindowsCapability -Online -Name OpenSSH.Server*
    Set-Service sshd -StartupType Disabled

## Windows Terminal Configuration

Set [Windows Terminal color](https://nerdschalk.com/how-to-change-color-in-windows-terminal/)

    "profiles": {
      "defaults": {
        // Put settings here that you want to apply to all profiles.
        "colorScheme": "One Half Dark"
      },

Add some profiles

        {
          "name": "Debian AWS Cloud Shell",
          "commandline": "wsl -d debian aws-shell",
          "hidden": false,
          "suppressApplicationTitle": true
        },
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

## WSL2

Install WSL2

    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

Restart

    wsl --set-default-version 2

Open Windows store to install Debian or Ubuntu:

-   [Ubuntu 20.04 LTS](https://www.microsoft.com/en-au/p/ubuntu-2004-lts/9n6svws3rx71)
-   [Debian](https://www.microsoft.com/en-au/p/debian/9msvkqc78pk6)

Post Installation configuration

    # Update system
    sudo apt update && sudo apt dist-upgrade
    sudo apt install libimage-exiftool-perl yara python3-pip xpdf zsh shellcheck wget curl vim unzip imagemagick awscli podman

    # TODO
    # Make the WSL subnet static so it doesnt collide with real ips
    # Also fix the issues with VPN's

    # ZSH config
    sudo wget -O /etc/zsh/zshrc https://git.grml.org/f/grml-etc-core/etc/zsh/zshrc
    sudo chsh -s /bin/zsh $USER
    sudo chsh -s /bin/zsh root
    ln -s ~/.profile ~/.zprofile
    zsh

    # Fix PIP paths
    echo "export PATH=\"${HOME}/.local/bin:$PATH\"" >>"${HOME}"/.bashrc
    echo "alias pip=pip3" >> ~/.bashrc
    echo "alias pip=pip3" >> ~/.zshrc
    sudo ln -s /usr/bin/python3 /usr/bin/python

    # Disable including windows paths
    sudo sh -c 'echo "[interop]" >> /etc/wsl.conf'
    sudo sh -c 'echo  "enabled=false" >> /etc/wsl.conf'
    sudo sh -c 'echo  "appendWindowsPath=false" >> /etc/wsl.conf'

    # Fix the bell
    echo "set bell-style none" >> ~/.inputrc

    # Fix Podman
    echo -e "[registries.search]\nregistries = ['docker.io', 'quay.io']" | sudo tee /etc/containers/registries.conf
    sudo sh -c 'echo "events_logger = \"file\"" >> /etc/containers/containers.conf'
    sudo sh -c 'echo "net.ipv4.ip_unprivileged_port_start=0" >> /etc/sysctl.conf'
    sudo sysctl -p

Python Tools

    pip install pdfx peepdf olefile mupdf mupdf-tools

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


# AWS CLI Config

Enable auto prompt mode

    aws configure set cli_auto_prompt on 

# Linux Setup

Run the Setup.sh file to setup and link configurations to git

## Zsh

Use the ZSH shell

    sudo wget -O /etc/zsh/zshrc https://git.grml.org/f/grml-etc-core/etc/zsh/zshrc
    sudo chsh -s /bin/zsh

# Gnome Theme

Install the theme

    yay -S pop-icon-theme-git pop-gtk-theme-git

Set the font sizes in Tweak Tool

| Name                 | Font                | Size |
| -------------------- | ------------------- | ---- |
| Interface Font       | Fira Sans Book      | 10   |
| Document Text        | Roboto Slab Regular | 11   |
| Monospace Text       | Fira Mono Regular   | 11   |
| Legacy Window Titles | Fira Sans Medium    | 10   |

Install the terminal theme. If you have problems with the script create an new terminal profile and run the script again.

    git clone https://github.com/aaron-williamson/base16-gnome-terminal.git ~/.config/base16-gnome-terminal
    ~/.config/base16-gnome-terminal/color-scripts/base16-ocean.sh


# Firefox Setup

At minimum make the following changes:

    browser.cache.disk.enable = False
    browser.fixup.alternate.enabled = False
    browser.formfill.enable = False
    browser.safebrowsing.downloads.remote.enabled = False
    browser.urlbar.trimURLs = False
    device.sensors.enabled = False
    dom.battery.enabled =  False
    dom.enable_performance = False
    dom.vibrator.enabled = False
    dom.webnotifications.enabled = False
    extensions.pocket.enabled = False
    geo.enabled = False
    keyword.enabled = False
    media.peerconnection.enabled = False
    network.captive-portal-service.enabled = False
    webgl.enable-debug-renderer-info = False

Optionally enable resist fingerprinting in about:config

    privacy.resistFingerprinting = true

## Firefox Addons

The following Firefox addons are also installed for security:

-   [Decentraleyes](https://addons.mozilla.org/en-US/firefox/addon/decentraleyes/)
-   [Firefox Multi-Account Containers](https://addons.mozilla.org/en-GB/firefox/addon/multi-account-containers/)
-   [KeePassXC-Browser](https://addons.mozilla.org/en-US/firefox/addon/keepassxc-browser/)
-   [NoScript](https://addons.mozilla.org/en-US/firefox/addon/noscript/?src=search)
-   [uBlock Origin](https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/)

# Atom Setup

Good packages

    apm install atom-beautify indent-guide-improved file-icons auto-detect-indentation highlight-selected minimap minimap-highlight-selected split-diff sort-lines sublime-style-column-selection

Autocomplete packages

    apm install autocomplete-python autocomplete-xml autocomplete-math

Linter packages

    apm install linter linter-ui-default linter-clang linter-flake8 linter-lintr linter-markdown linter-php linter-pydocstyle linter-shellcheck linter-stylelint linter-xmllint
