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

Install the following applications:

-   [7zip](https://www.7-zip.org/download.html)
-   [Anaconda3](https://www.anaconda.com/)
-   [Atom](https://atom.io/)
-   [Chrome](https://www.google.com/chrome/)
-   [Firefox](https://www.mozilla.org/en-US/firefox/new/)
-   [KeepassXC](https://keepassxc.org/)
-   [LibreOffice](https://www.libreoffice.org/)
-   [Nmap](https://nmap.org/download.html)
-   [Virtualbox](https://www.virtualbox.org/wiki/Downloads)
-   [Wireshark](https://www.wireshark.org/)


## Scoop

Install the following using Scoop

-   [Blender](https://www.blender.org/)
-   [FreeCAD](https://www.freecadweb.org/)
-   [GIMP](https://www.gimp.org/)
-   [Inkscape](https://inkscape.org/)
-   [OpenSCAD](https://www.openscad.org/)
-   [PuTTY](https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html)
-   [Speedcrunch](https://speedcrunch.org/)
-   [VLC](https://www.videolan.org/vlc/download-windows.html)
-   [WinSCP](https://winscp.net/eng/download.php)

Install scoop. Note: if you get an error you might need to change the execution policy

    iwr -useb get.scoop.sh | iex
    scoop bucket add extras

Install some utilities common on Linux

    scoop install git curl aria2 busybox

Install some tools used by Atom Text editor

    scoop install shellcheck

Install the programs

    scoop install blender freecad gimp inkscape openscad putty speedcrunch vlc winscp

## Windows Theming

Use the base16 Ocean command prompt theme: <https://github.com/iamthad/base16-windows-command-prompt/blob/master/windows-command-prompt/base16-ocean.reg>

Use the base16 ocean putty theme: <https://github.com/benjojo/base-16-putty/blob/master/base16-ocean.reg>

# Firefox Setup

link Firefox_user.js to `~/.mozilla/firefox/\*.default/user.js`.

<!-- Based upon [This](https://github.com/pyllyukko/user.js) user.js file -->

with some tweaks.

## Firefox Addons

The following Firefox addons are also installed for security:

-   [Decentraleyes](https://addons.mozilla.org/en-US/firefox/addon/decentraleyes/)
-   [HTTPS-Everywhere](https://addons.mozilla.org/en-US/firefox/addon/https-everywhere/)
-   [uBlock Origin](https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/)
-   [NoScript](https://addons.mozilla.org/en-US/firefox/addon/noscript/?src=search)
-   [Firefox Multi-Account Containers](https://addons.mozilla.org/en-GB/firefox/addon/multi-account-containers/)
-   [Certainly Something (Certificate Viewer)](https://addons.mozilla.org/en-GB/firefox/addon/certainly-something/)
-   [KeePassXC-Browser](https://addons.mozilla.org/en-US/firefox/addon/keepassxc-browser/)

# Atom Setup

Good packages

    apm install atom-language-r atom-beautify indent-guide-improved file-icons auto-detect-indentation busy-signal minimap minimap-highlight-selected highlight-selected intentions intentions-colorpicker split-diff todo-show sort-lines sublime-style-column-selection

Autocomplete packages

    apm install autocomplete-python autocomplete-xml autocomplete-r autocomplete-math

Linter packages

    apm install linter linter-ui-default linter-clang linter-flake8 linter-lintr linter-markdown linter-php linter-pydocstyle linter-shellcheck linter-stylelint linter-xmllint

Hydrogen code run

    apm install hydrogen hydrogen-python data-explorer

Extra tools

    apm install platformio-ide-terminal emmet

User Interface

    apm install pop-syntax pop-ui
