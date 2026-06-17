# MacOS Setup

## System Settings

- Turn on FileVault
- Enable Firewall (with Stealth Mode)
- Disable sending diagnostic and usage data to Apple
- Set Timezone Correctly
- Swap "Command" and "Control" Modifier keys for attached keyboards
- Disbale scroll inertia
- Disable Sharing
  - Disable Screen Sharing
  - Disable File Sharing
  - Disable Media Sharing
  - Disable Printer Sharing
  - Disable Remote Login (SSH)
  - Disable Remote Management (ARD)
  - Disable Remote Apple Events
  - Disable Bluetooth Sharing
  - Disable Internet Sharing
  - Disable Content Caching
  - Disable AirPlay Receiver

### Homebrew

Install Xcode Command Line Tools

    xcode-select --install

Install Homebrew.

    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

### Terminal Tweaks

Configure Zsh to use Grml config and install plugins via Homebrew.

    # Install ZSH plugins via Homebrew
    brew install zsh-autosuggestions zsh-syntax-highlighting

    # Download Grml zshrc config
    curl -Lo ~/.zshrc https://git.grml.org/f/grml-etc-core/etc/zsh/zshrc

    # Enable plugins in ~/.zshrc.local
    echo "source $(brew --prefix)/share/zsh-autosuggestions/zsh-autosuggestions.zsh" >> ~/.zshrc.local
    echo "source $(brew --prefix)/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh" >> ~/.zshrc.local

### General UI/UX Tweaks

    # Set a fast keyboard repeat rate
    defaults write NSGlobalDomain KeyRepeat -int 2
    defaults write NSGlobalDomain InitialKeyRepeat -int 15

    # Disable "Are you sure you want to open this application?" dialog
    defaults write com.apple.LaunchServices LSQuarantine -bool false

    # Expand save panel by default
    defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode -bool true
    defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode2 -bool true

    # Expand print panel by default
    defaults write NSGlobalDomain PMPrintingExpandedStateForPrint -bool true
    defaults write NSGlobalDomain PMPrintingExpandedStateForPrint2 -bool true

    # Automatically quit printer app once the print jobs complete
    defaults write com.apple.print.PrintingPrefs "Quit When Finished" -bool true

    # Disable the "Are you sure you want to quit?" warning for multiple apps
    defaults write com.apple.Safari ConfirmClosingMultiplePages -bool false
    defaults write com.apple.iTerm2 PromptOnQuit -bool false

## Finder Tweaks

    # Show all filename extensions
    defaults write NSGlobalDomain AppleShowAllExtensions -bool true

    # Show path bar in Finder
    defaults write com.apple.finder ShowPathbar -bool true

    # Show status bar in Finder
    defaults write com.apple.finder ShowStatusBar -bool true

    # Keep folders on top when sorting by name
    defaults write com.apple.finder _FXSortFoldersFirst -bool true

    # When performing a search, search the current folder by default
    defaults write com.apple.finder FXDefaultSearchScope -string "SCcf"

    # Disable the warning when changing a file extension
    defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false

    # Avoid creating .DS_Store files on network or USB volumes
    defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true
    defaults write com.apple.desktopservices DSDontWriteUSBStores -bool true

    # Show the ~/Library folder
    chflags nohidden ~/Library

### Dock & Mission Control Tweaks

    # Set the icon size of Dock items
    defaults write com.apple.dock tilesize -int 48

    # Automatically hide and show the Dock
    defaults write com.apple.dock autohide -bool true

    # Remove the auto-hiding Dock delay
    defaults write com.apple.dock autohide-delay -float 0

    # Make Dock icons of hidden applications translucent
    defaults write com.apple.dock showhidden -bool true

    # Don't automatically rearrange Spaces based on most recent use
    defaults write com.apple.dock mru-spaces -bool false

    # Speed up Mission Control animations
    defaults write com.apple.dock expose-animation-duration -float 0.1

    # Remove recent applications from the Dock
    defaults write com.apple.dock show-recents -bool false

## Software

### General Tools

| App                                                                                             | Cask                                             |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [Adobe Reader](https://get.adobe.com/reader/)                                                   | `cask "adobe-acrobat-reader"`                    |
| [Calibre Ebook](https://calibre-ebook.com/download_osx)                                         | `cask "calibre"`                                 |
| [Chrome](https://www.google.com/chrome/)                                                        | `cask "google-chrome"`                           |
| [Firefox](https://www.mozilla.org/en-US/firefox/new/)                                           | `cask "firefox"`                                 |
| [KeepassXC](https://keepassxc.org/)                                                             | `cask "keepassxc"`                               |
| [Keka](https://www.keka.io/en/)                                                                 | `cask "keka"`                                    |
| [LibreOffice](https://www.libreoffice.org/)                                                     | `cask "libreoffice"`                             |
| [Microsoft Remote Desktop](https://apps.apple.com/us/app/microsoft-remote-desktop/id1295203466) | `mas "Microsoft Remote Desktop", id: 1295203466` |
| [Speedcrunch](https://speedcrunch.org/)                                                         | `cask "speedcrunch"`                             |
| [Sublime Text](https://www.sublimetext.com/)                                                    | `cask "sublime-text"`                            |
| [VLC](https://www.videolan.org/vlc/)                                                            | `cask "vlc"`                                     |

### Messaging Applications

| App                                                      | Cask                     |
| -------------------------------------------------------- | ------------------------ |
| [Discord](https://discordapp.com/)                       | `cask "discord"`         |
| [Microsoft Teams](https://teams.microsoft.com/downloads) | `cask "microsoft-teams"` |
| [Telegram](https://macos.telegram.org/)                  | `cask "telegram"`        |
| [Thunderbird](https://www.thunderbird.net/en-US/)        | `cask "thunderbird"`     |
| [WhatsApp](https://www.whatsapp.com/download/?lang=en)   | `cask "whatsapp"`        |
| [Zoom](https://zoom.us/support/download)                 | `cask "zoom"`            |

### Creative Tools

| App                                                                                  | Cask                          |
| ------------------------------------------------------------------------------------ | ----------------------------- |
| [Adobe Creative Cloud](https://creativecloud.adobe.com/apps/download/creative-cloud) | `cask "adobe-creative-cloud"` |
| [Blender](https://www.blender.org/)                                                  | `cask "blender"`              |
| [FreeCAD](https://www.freecadweb.org/)                                               | `cask "freecad"`              |
| [GIMP](https://www.gimp.org/)                                                        | `cask "gimp"`                 |
| [Hugin](http://hugin.sourceforge.net/download/)                                      | `cask "hugin"`                |
| [Inkscape](https://inkscape.org/)                                                    | `cask "inkscape"`             |
| [Luminance HDR](http://qtpfsgui.sourceforge.net)                                     | `cask "luminance-hdr"`        |
| [OpenSCAD](https://www.openscad.org/)                                                | `cask "openscad@snapshot"`    |

### Development Tools

| App                                                                                        | Cask                        |
| ------------------------------------------------------------------------------------------ | --------------------------- |
| [Anaconda3](https://www.anaconda.com/products/individual)                                  | `cask "anaconda"`           |
| [AWS CLI](https://awscli.amazonaws.com/AWSCLIV2.pkg)                                       | `brew "awscli"`             |
| [Cyberduck](https://cyberduck.io/)                                                         | `cask "cyberduck"`          |
| [Git](https://git-scm.com/downloads)                                                       | `brew "git"`                |
| [GitHub Desktop](https://desktop.github.com/)                                              | `cask "github"`             |
| [Virtualbox](https://www.virtualbox.org/wiki/Downloads)                                    | `cask "virtualbox"`         |
| [Visual Studio Code](https://code.visualstudio.com/)                                       | `cask "visual-studio-code"` |
| [VMWare Fusion](https://www.vmware.com/products/desktop-hypervisor/workstation-and-fusion) | `cask "vmware-fusion"`      |

## Ollama with HTTPS & API Key (Caddy Proxy)

This setup runs Ollama locally and configures Caddy as a reverse proxy to:
1. Secure the connection with a locally signed TLS certificate (HTTPS).
2. Protect the API with a custom API key header (`Authorization: Bearer <key>`).

### 1. Install Ollama and Caddy

Install Ollama and Caddy via Homebrew:

```bash
# Install Ollama
brew install ollama

# Install Caddy (used for HTTPS and API Key authentication)
brew install caddy
```

### 2. Configure Caddy

Create or edit your Caddyfile. The default system-wide Caddyfile path for Homebrew is:
- **Apple Silicon macOS:** `/opt/homebrew/etc/Caddyfile`
- **Intel macOS:** `/usr/local/etc/Caddyfile`

Add the following configuration (replace `KEY` with your desired API key):

```caddy
# Listen on port 11435 for HTTPS
https://localhost:11435 {
    # Generate a locally-signed certificate and attempt to install
    # it into the macOS System Keychain so it is trusted locally.
    tls internal

    # Require a Bearer token in the Authorization header
    @no-api-key {
        not header Authorization "Bearer KEY"
    }
    respond @no-api-key "Unauthorized" 401

    # Forward authorized traffic to Ollama's default port
    reverse_proxy localhost:11434
}
```

> [!NOTE]
> If you prefer a custom domain name (e.g., `ollama.local`) instead of `localhost:11435`, replace `https://localhost:11435` with `ollama.local` and add `127.0.0.1 ollama.local` to your `/etc/hosts` file.

### 3. Start and Auto-Start the Services

Depending on your requirements, you can configure these services to start on **user login** or on **system boot** (before any user logs in, like a server).

---

#### Option A: Auto-Start on User Login (LaunchAgents)
This is the default and recommended method for personal computers. The services start when you log into your macOS user account.

```bash
# Start and register Ollama to run at login
brew services start ollama

# Start and register Caddy to run at login
brew services start caddy
```

*If you are using the Ollama Desktop App (`brew install --cask ollama`), you can auto-start it at login by opening the app, clicking the menu bar icon, and checking **Start at login** (or run `osascript -e 'tell application "System Events" to make new login item at end with properties {path:"/Applications/Ollama.app", hidden:false}'` in Terminal).*

---

#### Option B: Auto-Start on Boot (LaunchDaemons)
To run these services as system-wide daemons that start as soon as macOS boots up (before any user logs in):

##### 1. Caddy Boot-Start
Caddy can be easily run on boot as root by using `sudo` with brew services:
```bash
sudo brew services start caddy
```
This registers Caddy as a system-wide LaunchDaemon in `/Library/LaunchDaemons/homebrew.mxcl.caddy.plist`.

##### 2. Ollama Boot-Start (with Custom User)
If you run `sudo brew services start ollama`, Ollama will run as `root` and default to saving/reading models from `/var/root/.ollama/models`.

To start Ollama on boot but run it under your own user account (so it can access your models at `~/.ollama/models`), create a custom LaunchDaemon plist at `/Library/LaunchDaemons/org.ollama.ollama.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>org.ollama.ollama</string>
    <key>ProgramArguments</key>
    <array>
        <!-- Use /usr/local/bin/ollama on Intel Macs -->
        <string>/opt/homebrew/bin/ollama</string>
        <string>serve</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>UserName</key>
    <string>YOUR_MACOS_USERNAME</string>
    <key>StandardOutPath</key>
    <string>/var/log/ollama.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/ollama.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>OLLAMA_HOST</key>
        <string>127.0.0.1:11434</string>
    </dict>
</dict>
</plist>
```

> [!IMPORTANT]
> Replace `YOUR_MACOS_USERNAME` with your actual macOS username (run `whoami` to find it), and ensure the path to the `ollama` binary is correct (`/opt/homebrew/bin/ollama` for Apple Silicon or `/usr/local/bin/ollama` for Intel).

After creating the file, set the correct ownership and register it:
```bash
# Set ownership to root
sudo chown root:wheel /Library/LaunchDaemons/org.ollama.ollama.plist

# Load and start the daemon
sudo launchctl bootstrap system /Library/LaunchDaemons/org.ollama.ollama.plist
```

---

### Ollama Environment Variables

Ollama supports several environment variables to tune its performance, concurrency, and resource footprint. The most relevant ones for server-like configurations include:

| Variable | Description | Default | Example Value |
| :--- | :--- | :--- | :--- |
| `OLLAMA_NUM_PARALLEL` | Maximum number of parallel requests/users handled concurrently per model. | `1` (or `4` depending on VRAM) | `4` |
| `OLLAMA_MAX_QUEUE` | Maximum requests queued before rejecting with HTTP `503 Service Unavailable`. | `512` | `1024` |
| `OLLAMA_MAX_LOADED_MODELS` | Maximum number of models loaded in VRAM concurrently. | `1` | `2` |
| `OLLAMA_KEEP_ALIVE` | Duration a model stays loaded in VRAM after the last request. Set to `-1` to keep loaded indefinitely. | `5m` | `1h` (1 hour) |
| `OLLAMA_MODELS` | Directory path where downloaded models are stored. | `~/.ollama/models` | `/path/to/models` |
| `OLLAMA_FLASH_ATTENTION` | Enables Flash Attention for faster generation and lower memory consumption. | Disabled | `1` (to enable) |

#### How to Apply These Variables

##### 1. When using the Custom LaunchDaemon (`org.ollama.ollama.plist`)
Simply add the keys and string values directly into the `<key>EnvironmentVariables</key>` `<dict>` section of your plist file:

```xml
    <key>EnvironmentVariables</key>
    <dict>
        <key>OLLAMA_HOST</key>
        <string>127.0.0.1:11434</string>
        <key>OLLAMA_NUM_PARALLEL</key>
        <string>4</string>
        <key>OLLAMA_MAX_QUEUE</key>
        <string>512</string>
        <key>OLLAMA_MAX_LOADED_MODELS</key>
        <string>2</string>
        <key>OLLAMA_KEEP_ALIVE</key>
        <string>1h</string>
        <key>OLLAMA_FLASH_ATTENTION</key>
        <string>1</string>
    </dict>
```

##### 2. When using the Default Homebrew Service (LaunchAgent)
Edit the Homebrew-generated plist file located at `~/Library/LaunchAgents/homebrew.mxcl.ollama.plist` to add the environment variables under the `<key>EnvironmentVariables</key>` block, then restart the service:
```bash
brew services restart ollama
```

---

### 4. Verify the Setup

Test the secure proxy using `curl`.

1. **Verify that access is blocked without the correct API key:**
   ```bash
   curl -k -i https://localhost:11435
   ```
   *Should return HTTP status `401 Unauthorized`.*

2. **Verify that access is allowed with the correct API key:**
   ```bash
   curl -k -i -H "Authorization: Bearer YOUR_SUPER_SECRET_KEY" https://localhost:11435
   ```
   *Should return HTTP status `200 OK` (Ollama is running).*

3. **Verify the TLS certificate is trusted locally (without the `-k` / `--insecure` flag):**
   ```bash
   curl -i -H "Authorization: Bearer YOUR_SUPER_SECRET_KEY" https://localhost:11435
   ```
   *Should succeed without SSL verification errors once the root certificate is trusted by macOS.*
