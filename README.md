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

Install the following programs:

-   [Speedcrunch](https://speedcrunch.org/)
-   [7zip](https://www.7-zip.org/download.html)
-   [KeepassXC](https://keepassxc.org/)
-   [PuTTY](https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html)
-   [WinSCP](https://winscp.net/eng/download.php)
-   [Atom](https://atom.io/)
-   [Virtualbox](https://www.virtualbox.org/wiki/Downloads)
-   [VLC](https://www.videolan.org/vlc/download-windows.html)
-   [LibreOffice](https://www.libreoffice.org/)
-   [GIMP](https://www.gimp.org/)
-   [Blender](https://www.blender.org/)
-   [Inkscape](https://inkscape.org/)
-   [OpenSCAD](https://www.openscad.org/)
-   [FreeCAD](https://www.freecadweb.org/)
-   [Nmap](https://nmap.org/download.html)
-   [Wireshark](https://www.wireshark.org/)
-   [Python](https://www.python.org/)
-   [R](https://www.r-project.org/)
-   [RStudio](https://www.rstudio.com/)

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

# Atom Setup

Good packages

    apm install atom-language-r atom-beautify indent-guide-improved file-icons auto-detect-indentation busy-signal minimap minimap-highlight-selected highlight-selected intentions intentions-colorpicker

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
