# Linux Setup

# Install Basic Tools

## Arch
Install the following basic tools
   
    pacman -Syu nano vim sudo wget curl networkmanager usbutils gdisk
    pacman -S dnsutils screen tree tmux lm_sensors hddtemp glances
    pacman -S rsync fuse2 ssh-audit

Install the fastest mirror

    pacman -S reflector
    reflector -a 6 -f 4 -c AU --save /etc/pacman.d/mirrorlist

Install Yay (Optional)

    pacman -S --needed git base-devel
    git clone https://aur.archlinux.org/yay.git
    cd yay
    makepkg -si

## Debian/Ubuntu
Install the following basic tools

    apt install dnsutils screen vim nano tree

## RHEL/Centos Like
Install the following basic tools

    dnf config-manager --set-enabled crb
    dnf install epel-release epel-next-release
    dnf install screen tmux lm_sensors hddtemp glances sysfsutils

Consider the need to enable the RPM Fusion Repositories

    sudo dnf install --nogpgcheck https://mirrors.rpmfusion.org/free/el/rpmfusion-free-release-$(rpm -E %rhel).noarch.rpm -y
    sudo dnf install https://mirrors.rpmfusion.org/nonfree/el/rpmfusion-nonfree-release-$(rpm -E %rhel).noarch.rpm -y

# Setup Networking
## Arch

Install NetworkMangaer

    Pacman -S networkmanager
    systemctl enable NetworkManager
    systemctl start NetworkManager

Using the Network Manager Text User Interface

    nmtui

Validate the hostname set

    hostnamectl

# Setup Zsh
Use the ZSH shell and setup the GRML setup

## Arch

    pacman -S zsh zsh-completions
    sudo wget -O /etc/zsh/zshrc https://git.grml.org/f/grml-etc-core/etc/zsh/zshrc
    sudo chsh -s /bin/zsh $USER
    sudo chsh -s /bin/zsh root

## Debian/Ubuntu

    sudo apt install zsh zsh-autosuggestions linux-headers
    sudo wget -O /etc/zsh/zshrc https://git.grml.org/f/grml-etc-core/etc/zsh/zshrc
    ln -s ~/.profile ~/.zprofile

## RHEL/Centos Like

    sudo yum install zsh
    sudo wget -O /etc/zshrc https://git.grml.org/f/grml-etc-core/etc/zsh/zshrc
    sudo chsh -s /bin/zsh root
    sudo chsh -s /bin/zsh username

# SSH
## Arch

Add user

    useradd -m -G wheel -s login_shell username

Uncomment the relevant field in the sudo file to permit wheel users to use sudo

    sed 's/^# \%wheel ALL=(ALL:ALL) ALL/%wheel ALL=(ALL:ALL) ALL/' /etc/sudoers

Disable root account logins (Does not affect sudo)

    passwd --lock root

Locally install a SSH Key

    mkdir -p ~/.ssh && chmod 700 ~/.ssh
    touch ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
    echo "Key" > ~/.ssh/authorized_keys

Add the following to the opensshd config file
    
    mkdir /etc/ssh/sshd_config.d/
    echo "Include /etc/ssh/sshd_config.d/*.conf" >> /etc/ssh/sshd_config

Add the following contents to the file /etc/ssh/sshd_config.d/99-localnet.conf

    PasswordAuthentication no
    PermitRootLogin no
    Match address 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
        PasswordAuthentication yes

Add the following contents to the file /etc/ssh/sshd_config.d/ssh-audit_hardening.conf
    
    echo -e "\n# Restrict key exchange, cipher, and MAC algorithms, as per sshaudit.com\n# hardening guide.\nKexAlgorithms sntrup761x25519-sha512@openssh.com,curve25519-sha256,curve25519-sha256@libssh.org,diffie-hellman-group16-sha512,diffie-hellman-group18-sha512\nCiphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr\nMACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,umac-128-etm@openssh.com\nHostKeyAlgorithms ssh-ed25519,ssh-ed25519-cert-v01@openssh.com,sk-ssh-ed25519@openssh.com,sk-ssh-ed25519-cert-v01@openssh.com,rsa-sha2-256,rsa-sha2-512,rsa-sha2-256-cert-v01@openssh.com,rsa-sha2-512-cert-v01@openssh.com" > /etc/ssh/sshd_config.d/ssh-audit_hardening.conf

Regenerate SSH Host keys with larger keysize

    rm -f /etc/ssh/ssh_host_*
    ssh-keygen -t rsa -b 4096 -f /etc/ssh/ssh_host_rsa_key -N ""
    ssh-keygen -t ed25519 -f /etc/ssh/ssh_host_ed25519_key -N ""

Restart sshd and confirm the settings with ssh-audit

    systemctl restart sshd
    ssh-audit localhost

## RHEL/Centos Like

add user to wheel

    usermod -aG wheel username

Disable root account logins (Does not affect sudo)

    passwd --lock root

Locally install a SSH Key

    mkdir -p ~/.ssh && chmod 700 ~/.ssh
    touch ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
    echo "Key" > ~/.ssh/authorized_keys
    # Fix SELinux permissions, CentOS/RHEL only
    restorecon -R -v ~/.ssh

Add the following contents to the file /etc/ssh/sshd_config.d/99-localnet.conf

    PasswordAuthentication no
    PermitRootLogin no
    Match address 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
        PasswordAuthentication yes

# Change sudo to accept SSH Keys as authentication isntead of password

Authenticate sudo with SSH keys instead of setting NOPASSWD in sudoers file. Requires SSH Agent Forwarding.

## RHEL/Centos Like

    yum install pam_ssh_agent_auth

Configure sudo to try using public keys, then fall back to normal password authentication:

    sed -i "2i auth    sufficient  pam_ssh_agent_auth.so file=/etc/ssh/sudo_authorized_keys" /etc/pam.d/sudo

Configure sudoers to preserve the environment variable SSH_AUTH_SOCK

    sed -i "81i Defaults    env_keep += "SSH_AUTH_SOCK"" /etc/sudoers

Copy authorised keys that can be used for sudo access

    sudo touch /etc/ssh/sudo_authorized_keys
    chmod 600 /etc/ssh/sudo_authorized_keys
    sudo cat ~/.ssh/authorized_keys | sudo tee -a  /etc/ssh/sudo_authorized_keys  >/dev/null

Now connect to the host with Agent Forwarding enabled

    ssh -A user@host

# Setup fail2ban
## Arch
Install and start fail2ban

    pacman -S fail2ban
    systemctl start fail2ban
    systemctl enable fail2ban

Setup a ssh jail

    echo '[sshd]
    enabled = true
    ignoreip = 127.0.0.0/8
    ' > /etc/fail2ban/jail.local

Reload fail2ban and check that it works

    fail2ban-client reload
    fail2ban-client status
    fail2ban-client status sshd

## RHEL/Centos Like

    dnf -y install fail2ban
    systemctl enable fail2ban
    systemctl start fail2ban
    cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

Jails are disabled by default, enable the SSH one, find the line and add enabled = true

    [sshd]
    enabled = true

Reload fail2ban and check that it works

    fail2ban-client reload
    fail2ban-client status

# Setup smartctl disk monitoring
## Arch

Install smartmontools

    pacman -S smartmontools

Substitute this line to smartd.conf to do a short scan weekly, and a long scan monthly

    rm /etc/smartd.conf
    echo "DEVICESCAN -H -m root -n standby,10,q -a -o on -S on -s (S/../../1/01|L/../01/./03)" > /etc/smartd.conf
    systemctl emctl restart smartd.service


## RHEL/Centos Like

    yum install smartmontools

Substitute this line to smartd.conf to do a short scan weekly, and a long scan monthly

    rm /etc/smartmontools/smartd.conf
    echo "DEVICESCAN -H -m root -M exec /usr/libexec/smartmontools/smartdnotify -n standby,10,q -a -o on -S on -s (S/../../1/01|L/../01/./03)" > /etc/smartmontools/smartd.conf
    systemctl restart smartd.service

# Containers (Docker CE)
Install and start Docker

    pacman -S docker docker-compose
    systemctl enable docker
    systemctl start docker

# Containers (Podman)
## Arch
Install and start podman

    pacman -S podman podman-compose podman-docker fuse-overlayfs aardvark-dns
    systemctl enable podman.service
    systemctl start podman.service

## RHEL/Centos Like
Using Podman

    yum install podman podman-compose
    systemctl enable podman

# Virtualisation
## Arch

Setup Hugepages support

    echo "hugetlbfs       /dev/hugepages  hugetlbfs       mode=01770,gid=kvm        0 0" >> /etc/fstab
    umount /dev/hugepages
    mount /dev/hugepages

Install qemu and start libvirtd

    pacman -S qemu-base libvirt virt-install bridge-utils vde2 openbsd-netcat dmidecode 
    sudo systemctl enable libvirtd.service
    sudo systemctl start libvirtd.service

Create a bridge interface

    nmcli connection add type bridge ifname br0 stp no
    nmcli connection add type bridge-slave ifname enp3s0 master br0
    nmcli connection modify bridge-br0 ipv4.addresses 192.168.1.12
    nmcli connection modify bridge-br0 ipv4.dns 192.168.1.1
    nmcli connection modify bridge-br0 ipv4.method manual
    nmcli connection up bridge-br0

Make the bridge interface known to Docker

    systemctl edit docker.service

Add the following

    [Service]
    ExecStartPost=/usr/sbin/iptables -I DOCKER-USER -i br0 -o br0 -j ACCEPT

Restart Docker

    systemctl daemon-reload
    systemctl restart docker

Optionally install Home Assistant

    mkdir -vp /var/lib/libvirt/images/hassos-vm && cd /var/lib/libvirt/images/hassos-vm
    wget https://github.com/home-assistant/operating-system/releases/download/10.1/haos_ova-10.1.qcow2.xz
    xz -d -v haos_ova-10.1.qcow2.xz
    virsh pool-create-as --name hassos --type dir --target /var/lib/libvirt/images/hassos-vm
    virt-install --import --name hassos \
    --memory 2048 --vcpus 2 --cpu host \
    --os-variant=generic \
    --disk haos_ova-10.1.qcow2,format=qcow2,bus=virtio \
    --network bridge=br0,model=virtio \
    --graphics none \
    --noautoconsole \
    --boot uefi \
    --hostdev 002.003 --hostdev 002.004

Optionally forward built in bluetooth

    pacman -S bluez bluez-utils
    systemctl enable bluetooth.service
    systemctl start bluetooth.service


# Video Acceleration with VA-API
## Arch with Intel CPU
Test to see if VA-API already works

    pacman -S libva-utils 
    vainfo

If not, try installing the intel driver (requires non-free drivers)

    pacman -S intel-media-driver

Optionally enable GuC/HuC loading

    echo "options i915 enable_guc=2" > /etc/modprobe.d/i915.conf 
    mkinitcpio -p linux

Reboot and check if GuC/HuC loading worked

    dmesg | grep i915
    cat /sys/kernel/debug/dri/0/gt/uc/guc_info
    cat /sys/kernel/debug/dri/0/gt/uc/huc_info

## RHEL/Centos Like with Intel CPU
Test to see if VA-API already works

    yum install libva-utils
    vainfo

If not, try installing the intel driver (requires non-free drivers)

    yum install intel-media-driver

Optionally enable GuC/HuC loading

    echo "options i915 enable_guc=2" > /etc/modprobe.d/i915.conf 
    dracut --regenerate-all -f

Reboot and check if GuC/HuC loading worked

    dmesg | grep i915
    cat /sys/kernel/debug/dri/0/gt/uc/guc_info
    cat /sys/kernel/debug/dri/0/gt/uc/huc_info

# Power Saving
## Generic Instructions

Many of the power saving settings configured in bios are honored. PCI Runtime or ASCPM settings should be configured in BIOS if possible.

Review power usage with Powertop

    powertop

Enable SATA Active Link Power Management (Saves around 1.5w per drive)

    echo 'ACTION=="add", SUBSYSTEM=="scsi_host", KERNEL=="host*", ATTR{link_power_management_policy}="med_power_with_dipm"' > /etc/udev/rules.d/hd_power_save.rules

Enable USB autosuspend on a Specific USB device, first get the vendor and product ID

    lsusb

Then add a udev rule to enable it

    echo 'ACTION=="add", SUBSYSTEM=="usb", TEST=="power/control", ATTR{idVendor}=="05c6", ATTR{idProduct}=="9205", ATTR{power/control}="auto"' >> /etc/udev/rules.d/50-usb_power_save.rules

## Arch
Disable NMI watchdog

    echo kernel.nmi_watchdog = 0 > /etc/sysctl.d/disable_watchdog.conf

Set powersaving mode for Intel Wireless Cards

    echo "options iwlwifi power_save=1" >> /etc/modprobe.d/iwlwifi.conf

## RHEL/Centos Like
Disable NMI watchdog

    echo 'kernel.nmi_watchdog=0' >> /etc/sysctl.conf

# Temperature sensing

## Arch Setup

Install i2c tools to also probe for DIMM temperature sensors

    pacman -S i2c-tools
    modprobe i2c_dev
    i2cdetect -l

## RHEL/Centos Like Setup

Install i2c tools to also probe for DIMM temperature sensors

    dnf install i2c-tools lm_sensors hddtemp
    i2cdetect -l

## Generic Instructions

Note the temp sensors that are on the SMBus adapter and then answer yes to probe that address in sensors-detect

    sensors-detect
    sensors
    hddtemp -w

Rename any misnamed sensors through creating a renaming Label.

    echo 'chip "acpitz-acpi-0"
        label temp1 "SYS Temp"' > /etc/sensors.d/mobo

For i2c devices, first get their bus location

    sensors --bus-list

    echo 'bus "i2c-11" "SMBus I801 adapter at efa0"
    
    chip "*-i2c-11-18"
        set temp1_crit 100
        set temp1_crit_alarm 100
        label temp1 "SODIMM0"
    
    chip "*-i2c-11-1a"
        set temp1_crit 100
        set temp1_crit_alarm 100
        label temp1 "SODIMM1"' > /etc/sensors.d/ram

# BTRFS
## Arch

Install the btrfs system

    pacman -S btrfs-progs

Add btrfs to the hooks of mkinitcpio.conf

    vim /etc/mkinitcpio.conf
    mkinitcpio -p linux

Create a normal btrfs FS

    mkfs.btrfs /dev/sda1

Create a RAID1 btrfs FS

    mkfs.btrfs -d raid1 -m raid1 /dev/sda1 /dev/sdb1

# Avahi (zeroconf)
## Arch
Install and start the service

    pacman -S avahi
    systemctl start avahi-daemon
    systemctl enable avahi-daemon

Advertise a SSH Server

    cp /usr/share/doc/avahi/ssh.service /etc/avahi/services/

# Time Sync/NTP
## Arch
Enable the lightweight systemd timesync

    systemctl enable systemd-timesyncd
    systemctl start systemd-timesyncd

Check that it worked

    timedatectl
    timedatectl timesync-status