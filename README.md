# dotfiles

A collection of light build guides and configuration files stored here for convenience.

## Operating System Setup

- [Windows Desktop Setup](Windows_Desktop.md)
- [Windows Server Setup](Windows_Server.md)
- [Linux Setup](Linux.md)
- [Linux Desktop Setup](Linux%20Desktop.md)
- [MacOS Setup](MacOS.md)
- [Android TV](Android_TV.md)

## Application Specific

- [Google Antigravity Setup](Antigravity.md)
- [VS Code Setup](VSCode.md)
- [Pi Coding Agent](pi-agent/README.md)
- [LLama Swap](llama-swap/README.md)

### AWS CLI Config

Enable auto prompt mode:

```bash
aws configure set cli_auto_prompt on
```

### Firefox Setup

Make the following configuration changes in the settings:

- Add search bar to toolbar
- Disable search suggestions
- Make DuckDuckGo the default search and search shortcut
- Set Browser Privacy to Strict
- Disable saved passwords
- Disable Firefox Data Collection
- Enable HTTPS mode for all windows

Enable the following general settings in `about:config`:

```ini
browser.cache.disk.enable = false
extensions.pocket.enabled = false
```

Enable the following settings for increased security with minimal user impact:

```ini
geo.enabled = false
network.captive-portal-service.enabled = false
media.peerconnection.enabled = false
media.navigator.enabled = false
#webgl.enable-debug-renderer-info = false (looks to be masked anyway)
#dom.battery.enabled = false
#dom.vibrator.enabled = false
#device.sensors.enabled = false
#dom.enable_performance = false
#browser.safebrowsing.downloads.remote.enabled = false
```

Optionally enable the following settings for increased security at expense of user experience:

```ini
privacy.resistFingerprinting = true
```

Optionally enable the following settings for different user experience:

```ini
keyword.enabled = false
browser.urlbar.trimURLs = false
dom.webnotifications.enabled = false
browser.formfill.enable = false
```

#### Firefox Addons

The following Firefox addons are also installed for security:

- [Decentraleyes](https://addons.mozilla.org/en-US/firefox/addon/decentraleyes/)
- [Firefox Multi-Account Containers](https://addons.mozilla.org/en-GB/firefox/addon/multi-account-containers/)
- [KeePassXC-Browser](https://addons.mozilla.org/en-US/firefox/addon/keepassxc-browser/)
- [NoScript](https://addons.mozilla.org/en-US/firefox/addon/noscript/?src=search)
- [uBlock Origin](https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/)

### Darktable Setup

Recursively generate import commands for folders that contain a Camera RAW file:

```powershell
$darktable = 'C:\Program Files\darktable\bin\darktable.exe'
$delayPerImage = 0.1

foreach ($folder in Get-ChildItem -Directory | Sort-Object Name) {
    $rawCount = (Get-ChildItem -Path $folder.FullName -Force | Where-Object {$_.Extension -in ('.CR2','.CR3')}).Count
    if ($rawCount -gt 0) {
        Write-Host "& '$darktable' '$($folder.FullName)'"
        $totalDelay = [math]::Ceiling($rawCount * $delayPerImage)
        Write-Host "Start-Sleep -Seconds $totalDelay"
    }
}
```

Generate Cache files (cache lives in `C:\Users\[USERNAME]\AppData\Local\Microsoft\Windows\INetCache\darktable`):

```powershell
& 'C:\Program Files\darktable\bin\darktable-generate-cache.exe' -m 4
```
