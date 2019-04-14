# dotfiles

A collection of configuration files stored here for convenience only.

## Setup

The included script can be used to install the configs using a softlink.

## Firefox configuration

link Firefox_user.js to ~/.mozilla/firefox/\*.default/user.js.

Based upon [This](https://github.com/pyllyukko/user.js) user.js file
with some tweaks to make it easier to use bookmarks.

### Firefox Addons

The following firefox addons are also installed for security

- Certificate Patrol
- Decentraleyes
- HTTPS-Everywhere
- No Resource URI Leak
- NoScript
- uBlock Origin
- CanvasBlocker

Combined all these things will break most websites, NoScript mostly.

## Atom configuration

Good packages

    apm install atom-language-r atom-beautify indent-guide-improved file-icons auto-detect-indentation busy-signal minimap minimap-highlight-selected highlight-selected intentions intentions-colorpicker

Autocomplete packages

    apm install autocomplete-python autocomplete-xml autocomplete-r autocomplete-math

Linter packages

    apm install linter linter-ui-default linter-clang linter-flake8 linter-lintr linter-markdown linter-php linter-pydocstyle linter-shellcheck linter-stylelint linter-xmllint

Hydrogen code run

    apm install hydrogen hydrogen-python data-explorer

Additional tools

    apm install platformio-ide-terminal emmet







pop-syntax
pop-ui
