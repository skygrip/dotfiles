# Linux Setup

# Install Basic Tools
# Debian/Ubuntu
Install the following basic tools

    apt install dnsutils screen vim nano tree

## RHEL-Like
Install the following basic tools

    dnf config-manager --set-enabled crb
    dnf install epel-release epel-next-release
    dnf install screen tmux lm_sensors hddtemp glances sysfsutils

Consider the need to enable the RPM Fusion Repositories

    sudo dnf install --nogpgcheck https://mirrors.rpmfusion.org/free/el/rpmfusion-free-release-$(rpm -E %rhel).noarch.rpm -y
    sudo dnf install https://mirrors.rpmfusion.org/nonfree/el/rpmfusion-nonfree-release-$(rpm -E %rhel).noarch.rpm -y

# Setup Networking

Using the Network Manager Text User Interface

    nmtui

Validate the hostname set

    hostnamectl

# Setup Zsh
Use the ZSH shell and setup the GRML setup


## Debian/Ubuntu

    sudo apt install zsh zsh-autosuggestions linux-headers
    sudo wget -O /etc/zsh/zshrc https://git.grml.org/f/grml-etc-core/etc/zsh/zshrc
    ln -s ~/.profile ~/.zprofile

## Centos/RHEL

    sudo yum install zsh
    sudo wget -O /etc/zshrc https://git.grml.org/f/grml-etc-core/etc/zsh/zshrc
    sudo chsh -s /bin/zsh root
    sudo chsh -s /bin/zsh username

## Arch

    pacman -S zsh zsh-completions
    sudo wget -O /etc/zsh/zshrc https://git.grml.org/f/grml-etc-core/etc/zsh/zshrc
    sudo chsh -s /bin/zsh $USER
    sudo chsh -s /bin/zsh root

# SSH

add user to wheel

    usermod -aG wheel username

Disable root account logins (Does not affect sudo)

    passwd --lock root

Locally install a SSH Key

    mkdir -p ~/.ssh && chmod 700 ~/.ssh
    touch ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
    cat "Key" > ~/.ssh/authorized_keys
    # Fix SELinux permissions, CentOS/RHEL only
    restorecon -R -v ~/.ssh

Add the following contents to the file /etc/ssh/sshd_config.d/99-localnet.conf

    PasswordAuthentication no
    PermitRootLogin no
    Match address 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
        PasswordAuthentication yes


# Change sudo to accept SSH Keys as authentication isntead of password

Authenticate sudo with SSH keys instead of setting NOPASSWD in sudoers file. Requires SSH Agent Forwarding.

## RHEL-Like

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

## RHEL-Like

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

## RHEL-Like

    yum install smartmontools

Substitute this line to smartd.conf to do a short scan weekly, and a long scan monthly

    rm /etc/smartmontools/smartd.conf
    echo "DEVICESCAN -H -m root -M exec /usr/libexec/smartmontools/smartdnotify -n standby,10,q -a -o on -S on -s (S/../../1/01|L/../01/./03)" > /etc/smartmontools/smartd.conf
    systemctl restart smartd.service

# Containers
## RHEL-Like
Using Podman

    yum install podman podman-compose
    systemctl enable podman

# Virtualisation
## RHEL-Like

    yum install qemu-kvm libvirt  virt-install

# Video Acceleration with VA-API
## RHEL-Like with Intel CPU
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

Many of the power saving settings configured in bios are honored. PCI Runtime or ASCPM settings should be configured in BIOS if possible.

Review power usage with Powertop

    dnf install powertop
    powertop

Enable SATA Active Link Power Management (Saves around 1.5w per drive)

    echo 'ACTION=="add", SUBSYSTEM=="scsi_host", KERNEL=="host*", ATTR{link_power_management_policy}="med_power_with_dipm"' > /etc/udev/rules.d/hd_power_save.rules

Enable USB autosuspend on a Specific USB device, first get the vendor and product ID

    lsusb

Then add a udev rule to enable it

    echo 'ACTION=="add", SUBSYSTEM=="usb", TEST=="power/control", ATTR{idVendor}=="05c6", ATTR{idProduct}=="9205", ATTR{power/control}="auto"' >> /etc/udev/rules.d/50-usb_power_save.rules

Disable NMI watchdog

    echo 'kernel.nmi_watchdog=0' >> /etc/sysctl.conf

Any PCI Runtime or ASCPM settings should be made in BIOS

# Temperature sensing

Install i2c tools to also probe for DIMM temperature sensors

    dnf install i2c-tools lm_sensors hddtemp
    i2cdetect -l

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