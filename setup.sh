#!/bin/bash
# Creates links for config files

if [ -e "$HOME/.vimrc" ]; then
	echo "~/.vimrc" exists. Did not create link
else
	echo Creating link for vim
	ln -s $PWD/vimrc ~/.vimrc
fi

if [ -e "$HOME/.tmux.conf" ]; then
	echo "~/.tmux.con" exists. Did not create link
else
	echo Creating link for tmux
	ln -s $PWD/tmux.conf ~/.tmux.conf
fi

if [ -e "$HOME/.nanorc" ]; then
	echo "~/.tmux.con" exists. Did not create link
else
	echo Creating link for nano
	ln -s $PWD/nanorc ~/.nanorc
fi
