"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => VIM plugins
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
set nocompatible
filetype off

" Setup Vundle
set rtp+=~/.vim/bundle/Vundle.vim/
call vundle#begin()

" let Vundle manage Vundle, required
Plugin 'VundleVim/Vundle.vim'

" General Plugins
Plugin 'kien/ctrlp.vim' " fuzzy find files
Plugin 'scrooloose/nerdtree' " file drawer, open with :NERDTreeToggle
Plugin 'scrooloose/syntastic' " Syntax checking

" Visual Plugins
Plugin 'chriskempson/base16-vim'
Plugin 'vim-airline/vim-airline' " statusline
Plugin 'vim-airline/vim-airline-themes'

" Finish up setting up plugins
call vundle#end()

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => Indents
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" Setup tab settings
set noexpandtab " Use tabs
set tabstop=4 " the visible width of tabs
set softtabstop=4 " edit as if the tabs are 4 characters wide
set shiftwidth=4 " number of spaces to use for indent and unindent
set shiftround " round indent to a multiple of 'shiftwidth'

set smartindent
set autoindent

filetype plugin indent on

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => General
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Sets how many lines of history VIM has to remember
set history=500
set undolevels=500

" Set to auto read when a file is changed from the outside
set autoread

" No annoying sound on errors
set noerrorbells
set novisualbell

" Don't write backup or swap files
set nobackup
set noswapfile

" Enable the mouse
set mouse=a

" clipboard works cross session
set clipboard=unnamed

" make backspace behave in a sane manner
set backspace=indent,eol,start

" Set file encoding and newlines
set encoding=utf8
set filetype=unix

" faster redrawing
set ttyfast

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => VIM user interface
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Set 7 lines to the cursor - when moving vertically using j/k
set so=6

" Turn on the WiLd menu
set wildmenu

" Set status line
"set statusline="%f%m%r%h%w [%Y] [0x%02.2B]%< %F%=%4v,%4l %3p%% of %L"
set laststatus=2

" Searching
set ignorecase " case insensitive searching
set smartcase " case-sensitive if expression contains a capital letter
set hlsearch " Highlight search terms
set incsearch " set incremental search, like modern browsers
set magic " Set magic on, for regex

" Don't redraw while executing macros
set nolazyredraw

set showmatch " show matching braces
set mat=2 " how many tenths of a second to blink

" Show line numbers
set number

" Spell checking and auto complete bad spell
set complete+=kspell
setlocal spell spelllang=en_au
set spell!

" Show white space chars
set listchars=tab:➝\ ,extends:#,nbsp:.
set list

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => GUI VIM user interface
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
"Disable Menubar, Toolbar, and both scroll bars
set guioptions-=m
set guioptions-=T
set guioptions-=r
set guioptions-=L

""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => Colour Settings
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" manual workaround for issues with xterm and screen
set t_ut=

" syntax highlighting
syntax on
let base16colorspace=256  " Access colours present in 256 colour space"
set t_Co=256 " Explicitly tell vim that the terminal supports 256 colours"
set background=dark

" Use Gruvbox Theme
colorscheme base16-ocean

" Enable Italis on gnome-terminal
let g:gruvbox_italic=1

""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => Plug-in Settings
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Syntastic
let g:syntastic_always_populate_loc_list = 1
let g:syntastic_auto_loc_list = 1
let g:syntastic_check_on_open = 1
let g:syntastic_check_on_wq = 0
let g:syntastic_enable_signs = 1
let g:syntastic_error_symbol = "✗"
let g:syntastic_warning_symbol = "⚠"

"Airline Theme
"let g:airline_theme = 'bubblegum'
let g:airline_left_sep = ''
let g:airline_right_sep = ''

""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => Per file type settings
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Ignore compiled files
set wildignore=*.o,*~,*.pyc
if has("win16") || has("win32")
    set wildignore+=*/.git/*,*/.hg/*,*/.svn/*,*/.DS_Store
else
    set wildignore+=.git\*,.hg\*,.svn\*
endif

""""""""""
" Python "
""""""""""
" Use tabs for python
au FileType python setl tabstop=4 softtabstop=4 shiftwidth=4 textwidth=79 noexpandtab autoindent

" Ignore tabs as warnings
let g:syntastic_python_flake8_args='--ignore=W191'

""""""""""""
"   Ruby   "
""""""""""""
" Use rubocop for ruby code
let g:syntastic_ruby_checkers = ['rubocop']

" Use soft-tabs
au FileType ruby setl tabstop=4 shiftwidth=2 softtabstop=2 expandtab autoindent

""""""""""""
" Markdown "
""""""""""""
" Enable Spell Checking
au FileType markdown setl spell

