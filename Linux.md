# Linux Setup

# Install Basic Tools

## Arch

Install the following basic tools

    pacman -Syu nano vim sudo wget curl networkmanager usbutils gdisk
    pacman -S dnsutils screen tree tmux lm_sensors hddtemp glances
    pacman -S rsync fuse2 ssh-audit jq apprise inetutils

Install the fastest mirror

    pacman -S reflector
    reflector -a 6 -f 4 -c AU --save /etc/pacman.d/mirrorlist

Install CPU Microcode Updates

Arch Linux does not automatically load microcode updates. Install the package matching your CPU:

    # For Intel CPUs
    pacman -S intel-ucode

    # For AMD CPUs
    pacman -S amd-ucode

After installing, regenerate your bootloader configuration (e.g., GRUB) so the microcode is loaded at boot time:

    grub-mkconfig -o /boot/grub/grub.cfg

Install Yay (Optional)

    pacman -S --needed git base-devel
    git clone https://aur.archlinux.org/yay.git
    cd yay
    makepkg -si

## Debian/Ubuntu

Install the following basic tools

    apt install dnsutils screen vim nano tree

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

# SSH

## Arch

Add user

    useradd -m -G wheel -s /bin/zsh username

Uncomment the relevant field in the sudo file to permit wheel users to use sudo

    sed -i 's/^# %wheel ALL=(ALL:ALL) ALL/%wheel ALL=(ALL:ALL) ALL/' /etc/sudoers

Disable root account logins (Does not affect sudo)

    passwd --lock root

Locally install a SSH Key

    mkdir -p ~/.ssh && chmod 700 ~/.ssh
    touch ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
    echo "Key" > ~/.ssh/authorized_keys

Add the following to the opensshd config file (modern Arch already includes this by default at the top of `/etc/ssh/sshd_config`):

    mkdir -p /etc/ssh/sshd_config.d/
    # If not already present, add the include:
    echo "Include /etc/ssh/sshd_config.d/*.conf" >> /etc/ssh/sshd_config

Add the following contents to the file /etc/ssh/sshd_config.d/99-localnet.conf

    PasswordAuthentication no
    PermitRootLogin no
    # Include private IPv4 and IPv6 subnets (fc00::/7 for ULA, fe80::/10 for link-local, ::1 for loopback)
    Match address 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,fc00::/7,fe80::/10,::1
        PasswordAuthentication yes
    # Reset match context to prevent options in other config files from being nested
    Match all

Add the following contents to the file /etc/ssh/sshd_config.d/ssh-audit_hardening.conf

    # Restrict key exchange, cipher, and MAC algorithms, as per sshaudit.com hardening guide
    KexAlgorithms sntrup761x25519-sha512@openssh.com,curve25519-sha256,curve25519-sha256@libssh.org,diffie-hellman-group16-sha512,diffie-hellman-group18-sha512,diffie-hellman-group-exchange-sha256
    Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr
    MACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,umac-128-etm@openssh.com
    HostKeyAlgorithms ssh-ed25519,ssh-ed25519-cert-v01@openssh.com,sk-ssh-ed25519@openssh.com,sk-ssh-ed25519-cert-v01@openssh.com,rsa-sha2-256,rsa-sha2-512,rsa-sha2-256-cert-v01@openssh.com,rsa-sha2-512-cert-v01@openssh.com

Regenerate SSH Host keys with larger keysize

    rm -f /etc/ssh/ssh_host_*
    ssh-keygen -t rsa -b 4096 -f /etc/ssh/ssh_host_rsa_key -N ""
    ssh-keygen -t ed25519 -f /etc/ssh/ssh_host_ed25519_key -N ""

Restart sshd and confirm the settings with ssh-audit

    systemctl restart sshd
    ssh-audit localhost

# Setup fail2ban

## Arch

Install and start fail2ban

    pacman -S fail2ban
    systemctl start fail2ban
    systemctl enable fail2ban

Setup a ssh jail in `/etc/fail2ban/jail.local` (uses the systemd backend since Arch logs to the systemd journal):

    [sshd]
    enabled = true
    backend = systemd
    ignoreip = 127.0.0.1/8 ::1

Reload fail2ban and check that it works

    fail2ban-client reload
    fail2ban-client status
    fail2ban-client status sshd

# System Monitoring (Arch)

Install smartmontools

    pacman -S smartmontools

## Configure smartd with Telegram Notifications (via Apprise)

To keep credentials secure and avoid repeating the Telegram URL in multiple scripts, create a central Apprise configuration file at `/etc/apprise.conf` and restrict its permissions:

    tee /etc/apprise.conf > /dev/null << 'EOF'
    # /etc/apprise.conf
    # Central configuration for Apprise notifications
    
    tgram://YOUR_BOT_TOKEN/YOUR_CHAT_ID
    EOF
    chmod 600 /etc/apprise.conf

### Create the Telegram Alert Script

Run the following command to create the script and make it executable:

    tee /usr/local/bin/smartd-apprise.sh > /dev/null << 'EOF'
    #!/bin/bash
    # Send Telegram message using Apprise
    
    MESSAGE="Hostname: $(hostname)
    Device: $SMARTD_DEVICESTRING
    Message: $SMARTD_MESSAGE"
    
    printf '%s\n' "$MESSAGE" | apprise --config=/etc/apprise.conf -t "SMARTD Alert"
    EOF
    chmod +x /usr/local/bin/smartd-apprise.sh

### Configure smartd.conf

To avoid compatibility warnings on NVMe drives, list drives explicitly in the config file.

The following script auto-generates the smartd.conf file: 

    tee /etc/smartd.conf > /dev/null << 'EOF'
    # /etc/smartd.conf
    # Auto-generated smartd configuration
    EOF

    smartctl --scan | while read -r line; do
        [[ -z "$line" || "$line" =~ ^# ]] && continue
        device=$(echo "$line" | awk '{print $1}')
        if [[ "$line" == *"-d nvme"* || "$device" == *"nvme"* ]]; then
            # NVMe Drives: Check health, error logs, and temperature limits
            echo "$device -H -m <nomailer> -M exec /usr/local/bin/smartd-apprise.sh -W 0,50,55 -l error"
        else
            # SATA/ATA Drives: Check health, run weekly short scans and monthly long scans
            echo "$device -H -m <nomailer> -M exec /usr/local/bin/smartd-apprise.sh -n standby,10,q -a -o on -S on -s (S/../../1/01|L/../01/./03)"
        fi
    done | tee -a /etc/smartd.conf

*The schedule `(S/../../1/01|L/../01/./03)` translates to:*
- **`S/../../1/01`**: Run a **Short** self-test every **Monday** at **1:00 AM**.
- **`L/../01/./03`**: Run a **Long** self-test on the **1st of the month** at **3:00 AM**.

### Enable and Start smartd

On Arch:

    systemctl enable --now smartd.service

### Testing the Notifications

To verify the integration works:
1. Temporarily add `-M test` to one of your drive configuration lines in `smartd.conf` (keep the `-M exec` flag as well, they are used together):

       /dev/sda -H -m <nomailer> -M test -M exec /usr/local/bin/smartd-apprise.sh -n standby,10,q ...

2. Restart `smartd` (`systemctl restart smartd`).
3. You should receive a test message on Telegram.
4. **Be sure to remove `-M test`** afterwards, otherwise you will receive alerts on every service restart.

# SSD Maintenance

To keep SSD performance high and prevent flash wear, enable systemd's weekly `fstrim` timer:

    systemctl enable --now fstrim.timer

# Temperature sensing

## Arch Setup

Install i2c tools:

    pacman -S i2c-tools

Configure kernel modules to load automatically at boot:
- `i2c_dev` (for DDR DIMM temperature sensors)
- `drivetemp` (for drive temperatures)

Create the boot configuration:

    echo -e "i2c_dev\ndrivetemp" | tee /etc/modules-load.d/sensors.conf

Load them:

    modprobe i2c_dev
    modprobe drivetemp
    i2cdetect -l

Note the temp sensors that are on the SMBus adapter and then answer yes to probe that address in sensors-detect:

    sensors-detect
    sensors

Rename any misnamed sensors through creating a renaming Label.

    echo 'chip "acpitz-acpi-0"
        label temp1 "SYS Temp"' > /etc/sensors.d/mobo

For i2c devices, first get their bus location using `sensors --bus-list` and create the configuration file:

    echo 'bus "i2c-17" "SMBus I801 adapter at 0000:00:1f.4"

    chip "jc42-i2c-17-18"
        set temp1_max 85
        set temp1_crit 100
        label temp1 "SODIMM0"

    chip "jc42-i2c-17-1a"
        set temp1_max 85
        set temp1_crit 100
        label temp1 "SODIMM1"' > /etc/sensors.d/ram

*Note: Make sure not to write to read-only status attributes like `temp1_crit_alarm`, as this will cause `sensors -s` to fail. If some motherboard BIOS lock these registers completely making them read-only, you can remove the `set` lines and only use `label` declarations.*
Run the following to apply the settings:

    sudo sensors -s

### Hardware Temperature Alerts (via Apprise)

Script that checks all active hardware sensors and routes alerts to Telegram using Apprise.

### Create the Alert Script

Run the following to create `/usr/local/bin/sensors-notify.sh`:

    tee /usr/local/bin/sensors-notify.sh > /dev/null << 'EOF'
    #!/bin/bash
    # Check for active hardware temperature alarms using JSON output
    
    STATE_FILE="/tmp/sensors-notify.state"
    COOLDOWN=14400 # 4 hours in seconds
    
    # Get all active alarm lines from lm_sensors
    ALARM_LINES=$(sensors -j | jq -r '
      to_entries[] | .key as $chip | 
      .value | to_entries[] | select(.key != "Adapter") | .key as $sensor | 
      .value | . as $attrs | to_entries[] | select(.key | endswith("_alarm")) | select(.value > 0) | 
      (.key | split("_")[0]) as $prefix |
      ($prefix + "_input") as $input_key |
      $attrs[$input_key] as $val |
      (if .key | contains("temp") then "°C" else "" end) as $unit |
      "\($chip) - \($sensor): \($val)\($unit) (\(.key))"
    ')
    
    if [ -n "$ALARM_LINES" ]; then
        NOW=$(date +%s)
        
        # If state file exists, check if we are still in the cooldown window
        if [ -f "$STATE_FILE" ]; then
            LAST_ALERT=$(cat "$STATE_FILE")
            if [[ "$LAST_ALERT" =~ ^[0-9]+$ ]]; then
                ELAPSED=$((NOW - LAST_ALERT))
                if [ "$ELAPSED" -lt "$COOLDOWN" ]; then
                    exit 0 # Still in cooldown, suppress duplicate alerts
                fi
            fi
        fi
        
        # Send alert and update state file timestamp
        MESSAGE="*HOSTNAME:* $(hostname)

    *HARDWARE ALARM*, one or more sensors have exceeded safety thresholds:

    \`\`\`
    $ALARM_LINES
    \`\`\`"
        
        if printf '%s\n' "$MESSAGE" | apprise -i markdown --config=/etc/apprise.conf -t "Hardware Warning"; then
            echo "$NOW" > "$STATE_FILE"
        fi
    else
        # No alarms active. If a state file exists, send recovery message and clear state
        if [ -f "$STATE_FILE" ]; then
            MESSAGE="*HOSTNAME:* $(hostname)
            
    *HARDWARE ALARM RESOLVED*, all temperature sensors have returned to normal operating ranges."
            
            if printf '%s\n' "$MESSAGE" | apprise -i markdown --config=/etc/apprise.conf -t "Hardware Recovery"; then
                rm -f "$STATE_FILE"
            fi
        fi
    fi
    EOF
    chmod +x /usr/local/bin/sensors-notify.sh

### Schedule the Script

To check temperatures every 5 minutes, configure a systemd timer.

Run the following command to create `/etc/systemd/system/sensors-notify.service`:

    tee /etc/systemd/system/sensors-notify.service > /dev/null << 'EOF'
    [Unit]
    Description=Hardware sensors monitoring notification script
    After=network-online.target
    
    [Service]
    Type=oneshot
    ExecStart=/usr/local/bin/sensors-notify.sh
    EOF

Run the following command to create `/etc/systemd/system/sensors-notify.timer`:

    tee /etc/systemd/system/sensors-notify.timer > /dev/null << 'EOF'
    [Unit]
    Description=Run hardware sensors check every 5 minutes
    
    [Timer]
    OnBootSec=5min
    OnUnitActiveSec=5min
    Persistent=true
    
    [Install]
    WantedBy=timers.target
    EOF

Enable and start the timer:

    systemctl enable --now sensors-notify.timer

## System Log Alerts (via Apprise)

Create a systemd timer-driven alert script that periodically checks `journalctl` for kernel and system errors (priority `err` to `emerg`) and forwards them to Telegram. This catches ECC memory errors, PCIe link failures, driver panics, and other low-level events.

### Create the Log Watcher Script

Run the following command to create `/usr/local/bin/journal-notify.sh`:

    tee /usr/local/bin/journal-notify.sh > /dev/null << 'EOF'
    #!/bin/bash
    # Check journald for critical log errors and alert via Apprise
    
    STATE_FILE="/tmp/journal-notify.state"
    NOW=$(date +%s)
    
    # Check if we have a valid last-check timestamp
    if [ -f "$STATE_FILE" ]; then
        SINCE_UNIX=$(cat "$STATE_FILE")
    fi
    
    if [[ "$SINCE_UNIX" =~ ^[0-9]+$ ]]; then
        # Query logs since the last successful check
        SINCE_DATE=$(date -d "@$SINCE_UNIX" "+%Y-%m-%d %H:%M:%S")
        ERRORS=$(journalctl --since="$SINCE_DATE" -p 0..3 --no-pager --quiet)
        TIME_MSG="since $SINCE_DATE"
    else
        # No state file found (e.g. after a reboot), query since the start of current boot
        ERRORS=$(journalctl -b -p 0..3 --no-pager --quiet)
        TIME_MSG="since boot"
    fi
    
    if [ -n "$ERRORS" ]; then
        # Trim to the last 30 errors to avoid message flooding
        TRIMMED_ERRORS=$(echo "$ERRORS" | tail -n 30)
        COUNT=$(echo "$ERRORS" | wc -l)
        
        # Ensure we stay within Telegram's 4096 character limit
        if [ ${#TRIMMED_ERRORS} -gt 3500 ]; then
            TRIMMED_ERRORS="${TRIMMED_ERRORS: -3500}"
        fi
        
        MESSAGE="*HOSTNAME:* $(hostname)
    *CRITICAL LOG ALARM*, found $COUNT error-level log entries $TIME_MSG. Last 30 events:

    \`\`\`
    $TRIMMED_ERRORS
    \`\`\`"
            
        if printf '%s\n' "$MESSAGE" | apprise -i markdown --config=/etc/apprise.conf -t "System Log Alert"; then
            echo "$NOW" > "$STATE_FILE"
        fi
    else
        # No errors found, advance the timestamp window
        echo "$NOW" > "$STATE_FILE"
    fi
    EOF
    chmod +x /usr/local/bin/journal-notify.sh

### Schedule the Script

Run the following command to create `/etc/systemd/system/journal-notify.service`:

    tee /etc/systemd/system/journal-notify.service > /dev/null << 'EOF'
    [Unit]
    Description=Journald log monitoring notification script
    After=network-online.target
    
    [Service]
    Type=oneshot
    ExecStart=/usr/local/bin/journal-notify.sh
    EOF

Run the following command to create `/etc/systemd/system/journal-notify.timer`:

    tee /etc/systemd/system/journal-notify.timer > /dev/null << 'EOF'
    [Unit]
    Description=Run journald error log check every 5 minutes
    
    [Timer]
    OnBootSec=5min
    OnUnitActiveSec=5min
    Persistent=true
    
    [Install]
    WantedBy=timers.target
    EOF

Enable and start the timer:

    systemctl enable --now journal-notify.timer

### Disk Space Alerts (via Apprise)

Create a systemd timer-driven alert script that checks all physical disk partitions hourly and alerts you via Telegram if any partition is over 95% full.

#### Create the Disk Watcher Script

Run the following command to create `/usr/local/bin/disk-notify.sh`:

    tee /usr/local/bin/disk-notify.sh > /dev/null << 'EOF'
    #!/bin/bash
    # Check disk space usage and alert via Apprise if thresholds are breached
    
    THRESHOLD=95
    STATE_FILE="/tmp/disk-notify.state"
    
    # Query disk usage, excluding virtual filesystems and read-only snap mounts (squashfs)
    DISKS_ALERT=$(df -h -x devtmpfs -x overlay -x tmpfs -x squashfs | awk 'NR>1 && $5+0 > '$THRESHOLD' {print $6 " is at " $5}')
    
    if [ -n "$DISKS_ALERT" ]; then
        # If we have already sent an alert for this breach, do nothing (infinite cooldown)
        if [ -f "$STATE_FILE" ]; then
            exit 0
        fi
        
        MESSAGE="*HOSTNAME:* $(hostname)
    *DISK SPACE WARNING*, one or more partitions are running out of space:
    
    \`\`\`
    $DISKS_ALERT
    \`\`\`"
        
        if printf '%s\n' "$MESSAGE" | apprise -i markdown --config=/etc/apprise.conf -t "Disk Space Warning"; then
            touch "$STATE_FILE"
        fi
    else
        # No alerts active. If we previously alerted, send recovery and clear state
        if [ -f "$STATE_FILE" ]; then
            MESSAGE="*HOSTNAME:* $(hostname)
            
    *DISK SPACE RESOLVED*, all partitions have returned to safe capacity thresholds."
            
            if printf '%s\n' "$MESSAGE" | apprise -i markdown --config=/etc/apprise.conf -t "Disk Space Recovery"; then
                rm -f "$STATE_FILE"
            fi
        fi
    fi
    EOF
    chmod +x /usr/local/bin/disk-notify.sh

#### Schedule the Script

To check disk space every hour, configure a systemd timer.

Run the following command to create `/etc/systemd/system/disk-notify.service`:

    tee /etc/systemd/system/disk-notify.service > /dev/null << 'EOF'
    [Unit]
    Description=Disk space monitoring alert script
    After=network-online.target
    
    [Service]
    Type=oneshot
    ExecStart=/usr/local/bin/disk-notify.sh
    EOF

Run the following command to create `/etc/systemd/system/disk-notify.timer`:

    tee /etc/systemd/system/disk-notify.timer > /dev/null << 'EOF'
    [Unit]
    Description=Run disk space check hourly
    
    [Timer]
    OnBootSec=5min
    OnUnitActiveSec=1h
    Persistent=true
    
    [Install]
    WantedBy=timers.target
    EOF

Enable and start the timer:

    systemctl enable --now disk-notify.timer

### Boot Notifications (via Apprise)

Create a systemd service that sends a Telegram notification whenever the server boots up. This is useful for identifying power outages, hardware resets, or unexpected crashes.

#### Create the Service

Run the following command to create `/etc/systemd/system/boot-notify.service`:

    tee /etc/systemd/system/boot-notify.service > /dev/null << 'EOF'
    [Unit]
    Description=Send system boot notification
    After=network-online.target
    Wants=network-online.target
    
    [Service]
    Type=oneshot
    ExecStart=/bin/bash -c 'apprise --config=/etc/apprise.conf -t "System Boot" -b "System $(hostname) has booted successfully"'
    
    [Install]
    WantedBy=multi-user.target
    EOF

Enable the service to run on boot:

    systemctl enable boot-notify.service


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

## Arch with AMD iGPU

Test to see if VA-API already works

    pacman -S libva-utils
    vainfo

If not, ensure that the core `mesa` graphics stack is installed (as the AMD VA-API driver `libva-mesa-driver` is bundled directly within `mesa` on modern Arch):

    pacman -S mesa

If `vainfo` still does not load the driver automatically, force it by specifying the driver environment variable (requires logging out or rebooting to take effect):

    echo "LIBVA_DRIVER_NAME=radeonsi" | sudo tee -a /etc/environment

To verify that the kernel successfully detected the GPU's hardware video acceleration block (VCN/UVD/VCE) and loaded the firmware automatically:

    dmesg | grep -iE "vcn|uvd|vce|amdgpu"

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

Enable the scrub timer (replace /mnt/data with your actual mount point)

    systemctl enable --now btrfs-scrub@$(systemd-escape -p /mnt/data).timer


# Local Network Discovery & Name Resolution (mDNS / WS-Discovery)

## Arch

### mDNS / Zeroconf (for macOS, Linux, and Windows resolution)

Install `avahi` (to advertise services) and `nss-mdns` (so your Arch machine can resolve `.local` addresses):

    pacman -S avahi nss-mdns

Configure the Name Service Switch in `/etc/nsswitch.conf` so the host can resolve `.local` addresses. Locate the `hosts:` line and add `mdns_minimal [NOTFOUND=return]` before `resolve` and `dns`:

    # Example configuration:
    # hosts: mymachines mdns_minimal [NOTFOUND=return] resolve [!UNAVAIL=return] files myhostname dns

Enable and start the Avahi service:

    systemctl enable --now avahi-daemon

Advertise a SSH Server over the local network via mDNS:

    cp /usr/share/doc/avahi/ssh.service /etc/avahi/services/

### Windows Explorer Network Discovery (WS-Discovery)

Modern Windows (10/11) uses Web Services Dynamic Discovery (WSD) to populate the "Network" section in Windows Explorer. Install and enable `wsdd` to make your Arch machine automatically discoverable under Windows Explorer Network page:

    pacman -S wsdd
    systemctl enable --now wsdd

# Time Sync/NTP

## Arch

Enable the lightweight systemd timesync

    systemctl enable systemd-timesyncd
    systemctl start systemd-timesyncd

Check that it worked

    timedatectl
    timedatectl timesync-status
