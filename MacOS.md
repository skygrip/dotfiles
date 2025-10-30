# MacOS Setup

Change the following System Settings:

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

Install Xcode Command Line Tools

    xcode-select --install

Install Homebrew.

    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

Install iTerm2, Zsh, Oh My Zsh, and fonts.

    # Install iTerm2
    brew install --cask iterm2
    
    # Install Oh My Zsh
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
    
    # Install Powerlevel10k theme
    git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k
    
    # Install Nerd Fonts (FiraCode is a great one)
    brew tap homebrew/cask-fonts
    brew install --cask font-fira-code-nerd-font
    
    # ZSH plugins
    git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
    git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting


Set ZSH_THEME="powerlevel10k/powerlevel10k" in your ~/.zshrc.

Add zsh-autosuggestions and zsh-syntax-highlighting to the plugins=(...) list in your ~/.zshrc.

Set your iTerm2 font to FiraCode Nerd Font.

Run p10k configure to set up your prompt.

Other steps

    # ---
    # General UI/UX
    # ---
    
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
    # ---
    # Finder
    # ---
    
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
    
    # ---
    # Dock & Mission Control
    # ---
    
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
    

# Software

General Tools:

|App|Cask|
|---|---|
|[Adobe Reader](https://get.adobe.com/reader/)|
|[Calibre Ebook](https://calibre-ebook.com/download_osx)|
|[Chrome](https://www.google.com/chrome/)|
|[Dropbox](https://www.dropbox.com/install)|
|[Firefox](https://www.mozilla.org/en-US/firefox/new/)|
|[KeepassXC](https://keepassxc.org/)|
|[Kindle](https://www.amazon.com.au/kindle-dbs/fd/kcp)|
|[LibreOffice](https://www.libreoffice.org/)|
|[Microsoft Remote Desktop](https://apps.apple.com/us/app/microsoft-remote-desktop/id1295203466)|
|[Speedcrunch](https://speedcrunch.org/)|
|[VLC](https://www.videolan.org/vlc/)|
|[Keka](https://www.keka.io/en/)
|[Sublime Text](https://www.sublimetext.com/)

Messaging Applications:

|App|Cask|
|---|---|
|[Discord](https://discordapp.com/)
|[Microsoft Teams](https://teams.microsoft.com/downloads)
|[Telegram](https://macos.telegram.org/)
|[Thunderbird](https://www.thunderbird.net/en-US/)
|[WhatsApp](https://www.whatsapp.com/download/?lang=en)
|[Zoom](https://zoom.us/support/download)

Creative Tools:

|App|Cask|
|---|---|
|[Adobe Creative Cloud](https://creativecloud.adobe.com/apps/download/creative-cloud)
|[Blender](https://www.blender.org/)
|[FreeCAD](https://www.freecadweb.org/)
|[GIMP](https://www.gimp.org/)
|[Hugin](http://hugin.sourceforge.net/download/)
|[Inkscape](https://inkscape.org/)
|[Luminance HDR](http://qtpfsgui.sourceforge.net)
|[OpenSCAD](https://www.openscad.org/)|brew install --cask openscad@snapshot|

Development Tools:

|App|Cask|
|---|---|
|[Anaconda3](https://www.anaconda.com/products/individual)
|[AWS CLI](https://awscli.amazonaws.com/AWSCLIV2.pkg)
|[Cyberduck](https://cyberduck.io/)
|[Git](https://git-scm.com/downloads)
|[GitHub Desktop](https://desktop.github.com/)
|[Virtualbox](https://www.virtualbox.org/wiki/Downloads)
|[Visual Studio Code](https://code.visualstudio.com/)
|[VMWare Workstation](https://www.vmware.com/au/products/workstation-pro/workstation-pro-evaluation.html)
