# Linux Setup

# Setup ZFS

# Setup BTRFS

Run the Setup.sh file to setup and link configurations to git

# Setup Zsh

Debian/Ubuntu

    sudo apt install zsh zsh-autosuggestions

Arch

    pacman -S zsh zsh-completions

Use the ZSH shell

    sudo wget -O /etc/zsh/zshrc https://git.grml.org/f/grml-etc-core/etc/zsh/zshrc
    sudo chsh -s /bin/zsh $USER
    sudo chsh -s /bin/zsh root

Debian/Ubuntu Tweaks

    ln -s ~/.profile ~/.zprofile

# Setup fail2ban

Debian/Ubuntu

    sudo apt install fail2ban

# Gnome Theming

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

