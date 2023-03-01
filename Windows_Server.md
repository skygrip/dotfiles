# Windows Desktop Setup
Setup of a basic desktop version of windows Server

For use in testing or where Infrastructure Automation isnt avaliable

# Inital Setup

 * Install required drivers to get networking working (if applicable)
 * Enable Windows update for other Microsoft products
 * Enable RDP
 * Enable Core Isolation
 * In Windows features Enable:
    * Bitlocker Drive Encryption
 * Setup Bitlocker Drive Encryption and Format any Addional Drives
 * Enable Automatic Updates
 * Install the latest [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170)

 # OpenSSH client on Windows
Enable the SSH-Agent service:

    Set-Service ssh-agent -StartupType Automatic
    Start-Service ssh-agent

# Winget

Winget is not supported on Windows Server enviroments

# Chocolatey