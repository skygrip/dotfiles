# dotfiles

A collection of configuration files stored here for convenience.

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

# Windows Setup

General Tools:

-   [7zip](https://www.7-zip.org/download.html)
-   [Adobe Reader](https://get.adobe.com/reader/)
-   [Chrome](https://www.google.com/chrome/)
-   [Discord](https://discordapp.com/)
-   [Dropbox](https://www.dropbox.com/install)
-   [Firefox](https://www.mozilla.org/en-US/firefox/new/)
-   [Gpg4win](https://www.gpg4win.org/)
-   [KeepassXC](https://keepassxc.org/)
-   [LibreOffice](https://www.libreoffice.org/)
-   [Microsoft Teams](https://teams.microsoft.com/downloads)
-   [Power Toys](https://github.com/microsoft/PowerToys)
-   [Speedcrunch](https://speedcrunch.org/)
-   [Thunderbird](https://www.thunderbird.net/en-US/)
-   [VLC](https://www.videolan.org/vlc/download-windows.html)
-   [Windows Terminal](https://www.microsoft.com/en-au/p/windows-terminal/9n0dx20hk701)

Creative Tools:

-   [Adobe Creative Cloud](https://creativecloud.adobe.com/apps/download/creative-cloud)
-   [Blender](https://www.blender.org/)
-   [FreeCAD](https://www.freecadweb.org/)
-   [GIMP](https://www.gimp.org/)
-   [Inkscape](https://inkscape.org/)
-   [OpenSCAD](https://www.openscad.org/)

Development Tools:

-   [Anaconda3](https://www.anaconda.com/)
-   [Atom](https://atom.io/)
-   [AWS CLI](https://awscli.amazonaws.com/AWSCLIV2.msi)
-   [AWS Shell](https://github.com/awslabs/aws-shell)
-   [Docker Desktop](https://www.docker.com/products/docker-desktop)
-   [Git](https://git-scm.com/downloads)
-   [GitHub Desktop](https://desktop.github.com/)
-   [PuTTY](https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html)
-   [Sandboxie](https://www.sandboxie.com/DownloadSandboxie)
-   [Virtualbox](https://www.virtualbox.org/wiki/Downloads)
-   [Visual Studio Code](https://code.visualstudio.com/)
-   [WinSCP](https://winscp.net/eng/download.php)

Forensics Tools:

-   [Arsenal Image Mounter](https://arsenalrecon.com/downloads/)
-   [DB Browser for SQLite](https://sqlitebrowser.org/dl/)
-   [Foremost](http://foremost.sourceforge.net/)
-   [FTK Imager](https://accessdata.com/product-download/ftk-imager-version-4-2-1)
-   [GSMARTControl](https://gsmartcontrol.sourceforge.io/home/index.php/Downloads)
-   [HxD Hex Editor](https://mh-nexus.de/en/hxd/)
-   [KAPE](https://www.kroll.com/en/insights/publications/cyber/kroll-artifact-parser-extractor-kape)
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

-    [Nvidia Drivers](https://www.nvidia.com/Download/index.aspx?lang=en-us)
-    [Logitech Options](https://www.logitech.com/en-au/product/options)

## Powershell Setup

    Install-Module -Name ExchangeOnlineManagement

## SSH on Windows

    # Install OpenSSH
    Add-WindowsCapability -Online -Name OpenSSH.Client*
    Set-Service ssh-agent -StartupType Automatic
    Start-Service ssh-agent

## Winget

    TODO This section

## WSL (alternative to running scoop)

Install WSL2

    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
    wsl --set-default-version 2

Open Windows store to install Debian or Ubuntu:

-   [Ubuntu 20.04 LTS](https://www.microsoft.com/en-au/p/ubuntu-2004-lts/9n6svws3rx71)
-   [Debian](https://www.microsoft.com/en-au/p/debian/9msvkqc78pk6)

Post Installation configuration

    # Update system
    sudo apt update && sudo apt dist-upgrade
    sudo apt install libimage-exiftool-perl yara python3-pip xpdf zsh shellcheck wget curl vim unzip imagemagick awscli aws-shell

    # Fix PIP paths
    echo "export PATH=\"${HOME}/.local/bin:$PATH\"" >>"${HOME}"/.bashrc
    echo "alias pip=pip3" >> ~/.bashrc
    sudo ln -s /usr/bin/python3 /usr/bin/python

    # Fix the bell
    echo "set bell-style none" >> ~/.inputrc

    # ZSH config
    sudo wget -O /etc/zsh/zshrc https://git.grml.org/f/grml-etc-core/etc/zsh/zshrc
    sudo chsh -s /bin/zsh $USER
    sudo chsh -s /bin/zsh root

Python Tools

    pip install pdfx peepdf olefile

Install Didier Stevens Tools

    # PDF-Parser
    wget -O ~/.local/bin/pdf-parser.py https://raw.githubusercontent.com/DidierStevens/DidierStevensSuite/master/pdf-parser.py && chmod +x ~/.local/bin/pdf-parser.py
    ln -s ~/.local/bin/pdf-parser.py ~/.local/bin/pdf-parser

    # OleDump
    wget -O /tmp/oledump.zip https://didierstevens.com/files/software/oledump_V0_0_60.zip && unzip -e -d ~/.local/bin /tmp/oledump.zip && chmod +x ~/.local/bin/oledump.py
    ln -s ~/.local/bin/oledump.py ~/.local/bin/oledump

    # PDFID
    wget -O /tmp/pdfid.zip https://didierstevens.com/files/software/pdfid_v0_2_7.zip && unzip -e -d ~/.local/bin /tmp/pdfid.zip && chmod +x ~/.local/bin/pdfid.py
    ln -s ~/.local/bin/pdfid.py ~/.local/bin/pdfid

## Windows Terminal Configuration

Set [Windows Terminal color](https://nerdschalk.com/how-to-change-color-in-windows-terminal/)

# Firefox Setup

link Firefox_user.js to `~/.mozilla/firefox/\*.default/user.js`.

<!-- Based upon [This](https://github.com/pyllyukko/user.js) user.js file -->

with some tweaks.

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
