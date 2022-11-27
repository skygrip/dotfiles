# dotfiles

A collection of light build guides and configuration files stored here for convenience.

# Operating System Setup

[Windows Desktop Setup](Windows_Desktop.md)

[Linux Setup](Linux.md)

[MacOS Setup](MacOS.md)

# Application Specific

## AWS CLI Config

Enable auto prompt mode

    aws configure set cli_auto_prompt on 

## Firefox Setup

Make the following configuration changes in the settings:

 * Add serach bar to toolbar
 * Disable search suggestions
 * make DuckDuckGo the default search and search shortcut
 * Set Browser Privacy to Strict
 * Disable saved passwords
 * Disable Firefox Data Collection
 * Enable HTTPS mode for all windows

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

Optionally enable the following settings for increased security at expense of user experence

    privacy.resistFingerprinting = true
    
Optionally enable the following settings for different User Experence

    keyword.enabled = False
    browser.urlbar.trimURLs = False
    dom.webnotifications.enabled = False
    browser.formfill.enable = False

### Firefox Addons

The following Firefox addons are also installed for security:

-   [Decentraleyes](https://addons.mozilla.org/en-US/firefox/addon/decentraleyes/)
-   [Firefox Multi-Account Containers](https://addons.mozilla.org/en-GB/firefox/addon/multi-account-containers/)
-   [KeePassXC-Browser](https://addons.mozilla.org/en-US/firefox/addon/keepassxc-browser/)
-   [NoScript](https://addons.mozilla.org/en-US/firefox/addon/noscript/?src=search)
-   [uBlock Origin](https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/)

## Darktable Setup

recursively import only folders that contain a raw folder.

    $darktable = 'C:\Program Files\darktable\bin\darktable.exe'
    foreach($folder in Get-ChildItem | Sort){
        if ((Get-ChildItem -Path $folder -force | Where-Object Extension -in ('.CR2','.CR3') | Measure-Object).Count -ne 0){
            echo "importing folder: $folder"
            & $darktable $folder
            Start-Sleep -Seconds 20
        }
    }
    & 'C:\Program Files\darktable\bin\darktable-generate-cache.exe' -m 4
