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

At minimum make the following changes:

    browser.cache.disk.enable = False
    browser.fixup.alternate.enabled = False
    browser.formfill.enable = False
    browser.safebrowsing.downloads.remote.enabled = False
    browser.urlbar.trimURLs = False
    device.sensors.enabled = False
    dom.battery.enabled =  False
    dom.enable_performance = False
    dom.vibrator.enabled = False
    dom.webnotifications.enabled = False
    extensions.pocket.enabled = False
    geo.enabled = False
    keyword.enabled = False
    media.peerconnection.enabled = False
    network.captive-portal-service.enabled = False
    webgl.enable-debug-renderer-info = False

Optionally enable resist fingerprinting in about:config

    privacy.resistFingerprinting = true

### Firefox Addons

The following Firefox addons are also installed for security:

-   [Decentraleyes](https://addons.mozilla.org/en-US/firefox/addon/decentraleyes/)
-   [Firefox Multi-Account Containers](https://addons.mozilla.org/en-GB/firefox/addon/multi-account-containers/)
-   [KeePassXC-Browser](https://addons.mozilla.org/en-US/firefox/addon/keepassxc-browser/)
-   [NoScript](https://addons.mozilla.org/en-US/firefox/addon/noscript/?src=search)
-   [uBlock Origin](https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/)

## Atom Editor Setup

Good packages

    apm install atom-beautify indent-guide-improved file-icons auto-detect-indentation highlight-selected minimap minimap-highlight-selected split-diff sort-lines sublime-style-column-selection

Autocomplete packages

    apm install autocomplete-python autocomplete-xml autocomplete-math

Linter packages

    apm install linter linter-ui-default linter-clang linter-flake8 linter-lintr linter-markdown linter-php linter-pydocstyle linter-shellcheck linter-stylelint linter-xmllint

## Darktable Setup

recursively import only folders that contain a raw folder.

    $darktable = 'C:\Program Files\darktable\bin\darktable.exe'
    foreach($folder in Get-ChildItem){
        if (Test-Path $folder\Raw){
            & $darktable $folder\Raw
            Start-Sleep -Seconds 20
        }
    }