# dotfiles

A collection of light build guides and configuration files stored here for convenience.

# Operating System Setup

[Windows Desktop Setup](Windows_Desktop.md)

[Linux Setup](Linux.md)

[MacOS Setup](MacOS.md)

[Android TV](Android_TV.md)

# Application Specific

## AWS CLI Config

Enable auto prompt mode

    aws configure set cli_auto_prompt on

## Firefox Setup

Make the following configuration changes in the settings:

- Add search bar to toolbar
- Disable search suggestions
- Make DuckDuckGo the default search and search shortcut
- Set Browser Privacy to Strict
- Disable saved passwords
- Disable Firefox Data Collection
- Enable HTTPS mode for all windows

Enable the following general settings

    browser.cache.disk.enable = False
    extensions.pocket.enabled = False

Enable the following settings for increased security with minimal user impact

    geo.enabled = False
    network.captive-portal-service.enabled = False
    media.peerconnection.enabled = False
    media.navigator.enabled = False
    #webgl.enable-debug-renderer-info = False (looks to be masked anyway)
    #dom.battery.enabled =  False
    #dom.vibrator.enabled = False
    #device.sensors.enabled = False
    #dom.enable_performance = False
    #browser.safebrowsing.downloads.remote.enabled = False

Optionally enable the following settings for increased security at expense of user experience

    privacy.resistFingerprinting = true

Optionally enable the following settings for different User experience

    keyword.enabled = False
    browser.urlbar.trimURLs = False
    dom.webnotifications.enabled = False
    browser.formfill.enable = False

### Firefox Addons

The following Firefox addons are also installed for security:

- [Decentraleyes](https://addons.mozilla.org/en-US/firefox/addon/decentraleyes/)
- [Firefox Multi-Account Containers](https://addons.mozilla.org/en-GB/firefox/addon/multi-account-containers/)
- [KeePassXC-Browser](https://addons.mozilla.org/en-US/firefox/addon/keepassxc-browser/)
- [NoScript](https://addons.mozilla.org/en-US/firefox/addon/noscript/?src=search)
- [uBlock Origin](https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/)

## Darktable Setup

Recursively import only folders that contain a Camera RAW file.

    $darktable = 'C:\Program Files\darktable\bin\darktable.exe'
    $delayPerImage = 0.1

    foreach ($folder in Get-ChildItem | Sort) {
        $rawCount = (Get-ChildItem -Path $folder -Force | Where-Object {$_.Extension -in ('.CR2','.CR3')}).Count
        if ($rawCount -gt 0) {
            Write-Host "& '$darktable' '$folder'"
            $totalDelay = [math]::Ceiling($rawCount * $delayPerImage)
            Write-Host "Start-Sleep -Seconds $totalDelay"
        }
    }

Generate Cache files.
Cache lives in C:\Users\[USERNAME]\AppData\Local\Microsoft\Windows\INetCache\darktable

    & 'C:\Program Files\darktable\bin\darktable-generate-cache.exe' -m 4
