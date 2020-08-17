#!/bin/bash
# Creates links for config files

# Vim
#########
if [ -e "$HOME/.vimrc" ]; then
	echo 'vim: "~/.vimrc" exists. Did not create link.'
else
	echo "vim: Creating link for vim."
	ln -s $PWD/vimrc ~/.vimrc
fi

# Tmux
#########
if [ -e "$HOME/.tmux.conf" ]; then
	echo 'Tmux: "~/.tmux.con" exists. Did not create link.'
else
	echo "Tmux: Creating link for tmux."
	ln -s $PWD/tmux.conf ~/.tmux.conf
fi

# Nano
#########
if [ -e "$HOME/.nanorc" ]; then
	echo 'Nano: "~/.nanorc" exists. Did not create link.'
else
	echo "Nano: Creating link for nano."
	ln -s $PWD/nanorc ~/.nanorc
fi

# Firefox
#########
firefox_path=`echo $HOME/.mozilla/firefox/*.default-release/user.js`
if [ -e $firefox_path ]; then
	echo "Firefox: $firefox_path" exists. Did not create link.
else
	echo "Firefox: Creating link for Firefox."
	ln -s $PWD/Firefox_user.js ~/.mozilla/firefox/*.default/user.js
fi

# Darktable Scripts
#########
if [ -e "$HOME/.config/darktable/luarc" ]; then
	echo 'Darktable: ~/.config/darktable/luarc" exists. Did not create link'
else
	echo "Darktable: Fetching darktable scripts"
	git clone https://github.com/darktable-org/lua-scripts.git ~/.config/darktable/lua
	echo "Darktable: Creating link for Darktable Scripts"
	ln -s $PWD/darktable_luarc.lua $HOME/.config/darktable/luarc
fi
