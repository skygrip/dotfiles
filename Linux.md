# Linux Setup

Install basic tools

Debian/Ubuntu

    apt install dnsutils screen vim nano tree

Disable root account logins, and login without using root (still permits sudo)

    passwd --lock root

# Setup Static Networking with NetworkManager

Using Network Manager Text User Interface

    nmtui

# Setup Zsh

Debian/Ubuntu

    sudo apt install zsh zsh-autosuggestions linux-headers

Arch

    pacman -S zsh zsh-completions

Use the ZSH shell

    sudo wget -O /etc/zsh/zshrc https://git.grml.org/f/grml-etc-core/etc/zsh/zshrc
    sudo chsh -s /bin/zsh $USER
    sudo chsh -s /bin/zsh root

Debian/Ubuntu Tweaks

    ln -s ~/.profile ~/.zprofile


# Setup ZFS
## Installation

Debian/Ubuntu

    sudo apt install zfs-dkms zfsutils-linux zfs-auto-snapshot

## Scrub Timer

Check that your OS doesnt already set a default scrub timer in cron. If a scrub timer does not exist you can use the following

Create the file /etc/systemd/system/zfs-scrub@.timer

    [Unit]
    Description=Monthly zpool scrub on %i

    [Timer]
    OnCalendar=monthly
    AccuracySec=1h
    Persistent=true

    [Install]
    WantedBy=multi-user.target

Create the file /etc/systemd/system/zfs-scrub@.service

    [Unit]
    Description=zpool scrub on %i

    [Service]
    Nice=19
    IOSchedulingClass=idle
    KillSignal=SIGINT
    ExecStart=/usr/bin/zpool scrub %i

    [Install]
    WantedBy=multi-user.target

Enable and start *zfs-scrub@pool-to-scrub.timer*

    systemctl enable zfs-scrub@pool-to-scrub.timer
    systemctl start zfs-scrub@pool-to-scrub.timer

## Auto Snapshotting

check the cron configuration for any default snapshot timers, add one of the following if necessary:

    */5 * * * * root /sbin/zfs-auto-snapshot -q -g --label=frequent --keep=24 //
    00 * * * * root /sbin/zfs-auto-snapshot -q -g --label=hourly --keep=24 //
    59 23 * * * root /sbin/zfs-auto-snapshot -q -g --label=daily --keep=30 //
    59 23 * * 0 root /sbin/zfs-auto-snapshot -q -g --label=weekly --keep=6 //
    00 00 1 * * root /sbin/zfs-auto-snapshot -q -g --label=monthly --keep=12 //

# Setup BTRFS

# Setup smartctl

Debian/Ubuntu

    apt install smartmontools

Substitute this line to smartd.conf to do a short scan weekly, and a long scan montly

    DEVICESCAN -a -o on -S on -s (S/../../1/01|L/../01/./03) -H -m email@example.com -M exec /usr/share/smartmontools/smartd-runner

# Setup SSH

Disable password authentication

    PasswordAuthentication no

only allow SSH for users part of a group

    PermitRootLogin no
    AllowGroups ssh

Permit passwords for select networks only 

    Match address 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
        PasswordAuthentication yes

# Setup fail2ban

Debian/Ubuntu

    sudo apt install fail2ban


# Setup Docker

Debian/Ubuntu

    https://docs.docker.com/engine/install/debian/

Change the location of the docker storage location

    nano /lib/systemd/system/docker.service

Add -g /mnt/docker to the end of the exec start line. You could also just use a symlink.

# HDD Spindown

Get the disk ID

    blkid /dev/sda

Add something like the following to hdparm.conf

    }
    /dev/disk/by-id/XXXXXXXXXX {
        apm = 127
        spindown_time = 120
        write_cache = off
    }

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

