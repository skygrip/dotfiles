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
- Set Enhanced Tracking Protection to **Strict** (enables Total Cookie Protection, Network State Partitioning, and Fingerprinting Protection)
- Disable saved passwords
- Disable Firefox Data Collection & "Allow Firefox to perform privacy-preserving ad measurement"
- Enable HTTPS-Only Mode in all windows

Enable the following general, AI/ML debloat, and telemetry settings in `about:config`:

```ini
# Keep browser cache in RAM
browser.cache.disk.enable = false

# Disable built-in Firefox AI Chatbot sidebar, local ML models, and AI link previews
browser.ml.enable = false
browser.ml.chat.enabled = false
browser.ml.linkPreview.enabled = false
extensions.ml.enabled = false

# Disable Firefox Suggest, sponsored address bar suggestions, and New Tab ads
browser.urlbar.quicksuggest.enabled = false
browser.urlbar.suggest.quicksuggest.sponsored = false
browser.urlbar.suggest.quicksuggest.nonsponsored = false
```

Enable the following settings for increased security & privacy with minimal user impact:

```ini
# Disable background captive portal and network connectivity checks
network.captive-portal-service.enabled = false
network.connectivity-service.enabled = false

# WebRTC
# Only probe the default active network interface (hides secondary/VPN/WSL NICs even when mic/cam is allowed)
media.peerconnection.ice.default_address_only = true
# Never expose raw local/LAN IP addresses even after granting mic/cam permission
media.peerconnection.ice.no_host = true
# Force WebRTC to use your configured proxy if a proxy is active
media.peerconnection.ice.proxy_only_if_behind_proxy = true
#media.peerconnection.enabled = false

# Do not send binary hashes of downloaded files to Google Safe Browsing
browser.safebrowsing.downloads.remote.enabled = false
```

Optionally enable the following settings for UX and address bar behavior:

```ini
keyword.enabled = false
browser.urlbar.trimURLs = false
browser.urlbar.trimHttps = false
browser.formfill.enable = false
```

#### Firefox Addons

The following Firefox addons are installed for security and account isolation:

- [Firefox Multi-Account Containers](https://addons.mozilla.org/en-GB/firefox/addon/multi-account-containers/)
- [KeePassXC-Browser](https://addons.mozilla.org/en-US/firefox/addon/keepassxc-browser/)
- [NoScript](https://addons.mozilla.org/en-US/firefox/addon/noscript/) *(or use [uBlock Origin Medium Mode](https://github.com/gorhill/uBlock/wiki/Blocking-mode:-medium-mode))*
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
