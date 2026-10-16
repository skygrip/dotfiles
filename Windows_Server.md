# Windows Server Setup

Setup of a basic desktop version of Windows Server. For use in testing or where Infrastructure Automation isn't available.

## Initial Setup

- Install required drivers to get networking working (if applicable)
- Enable Windows update for other Microsoft products
- Enable RDP
- Enable Core Isolation
- In Windows features Enable:
  - BitLocker Drive Encryption
- Setup BitLocker Drive Encryption and Format any Additional Drives
- Enable Automatic Updates
- Install the latest [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170)

## OpenSSH Client on Windows

Enable the SSH-Agent service:

```powershell
Set-Service ssh-agent -StartupType Automatic
Start-Service ssh-agent
```

## Winget

Winget is included by default on Windows Server 2025. For Windows Server 2022, Winget can be installed manually by downloading and installing the Microsoft.DesktopAppInstaller MSIX bundle from GitHub releases along with its VCLibs and UI.Xaml dependencies.