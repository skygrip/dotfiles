# Llama-Swap Installation & Configuration Guide

[Llama-swap](https://github.com/mostlygeek/llama-swap) is an OpenAI API-compatible proxy server designed to manage and dynamically swap local Large Language Models (LLMs) on-demand. When an API call is made, Llama-swap starts the appropriate model server (e.g., `llama-server` from `llama.cpp`), routes the request, and automatically unloads inactive models after a specified Time-to-Live (TTL) to free up VRAM/RAM.

This document guides you through installing `llama.cpp` and `llama-swap` on Windows, Linux, and macOS, configuring the services, and documenting the active setup defined in [config.yaml](config.yaml).

---

## Backend Inference Engines

`llama-swap` can orchestrate and hot-swap multiple backend engines as defined in [config.yaml](config.yaml). The primary backends configured are **`llama.cpp`** (for standard dense & MoE models via CUDA) and **`Basalt`** (optimized runner for Qwen 3.8 Flash Next 125B).

---

### 1. llama.cpp

#### Windows (NVIDIA CUDA Setup & Updater)

The active `llama-swap` profile relies on the dedicated NVIDIA CUDA build located at `${env.USERPROFILE}/Build/llama.cpp-cuda/llama-server.exe`.

##### Full Installer & Updater Script
This PowerShell script handles both **fresh installations** and **in-place upgrades**. It queries the latest release from `ggml-org/llama.cpp`, downloads the CUDA binaries and CUDA runtime DLLs (`cublas64_13.dll`, `cudart64_13.dll`, etc.), and extracts them into place:

```powershell
# Set target directory
$destDir = "$env:USERPROFILE\Build\llama.cpp-cuda"
$tag = (gh release list -R ggml-org/llama.cpp --limit 1 --json tagName --jq '.[0].tagName')
Write-Host "Fetching latest llama.cpp CUDA release: $tag" -ForegroundColor Cyan

$tempDir = "$env:TEMP\llama-cuda-$tag"
New-Item -ItemType Directory -Path $destDir -Force | Out-Null
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Download binary package and cudart runtime libraries
gh release download $tag -R ggml-org/llama.cpp `
  -p "llama-*-bin-win-cuda-13.4-x64.zip" `
  -p "cudart-llama-bin-win-cuda-13.4-x64.zip" `
  --dir $tempDir --clobber

# Extract all archives into target build directory
Get-ChildItem -Path $tempDir -Filter "*.zip" | ForEach-Object {
    Write-Host "Extracting $($_.Name)..." -ForegroundColor Yellow
    Expand-Archive -Path $_.FullName -DestinationPath $destDir -Force
}

# Clean up temporary downloads
Remove-Item -Recurse -Force $tempDir
Write-Host "Successfully installed/updated llama.cpp ($tag) at $destDir" -ForegroundColor Green
```

##### Quick Binary-Only Update One-Liner
If CUDA runtime DLLs are already present and you just want to update the executables to the newest tag:
```powershell
$tag = (gh release list -R ggml-org/llama.cpp --limit 1 --json tagName --jq '.[0].tagName'); gh release download $tag -R ggml-org/llama.cpp -p "llama-*-bin-win-cuda-13.4-x64.zip" --dir "$env:USERPROFILE\Downloads" --clobber; Expand-Archive -Path "$env:USERPROFILE\Downloads\llama-$tag-bin-win-cuda-13.4-x64.zip" -DestinationPath "$env:USERPROFILE\Build\llama.cpp-cuda" -Force
```

##### Alternative: Vulkan via Winget (Cross-Vendor GPU)
For systems without NVIDIA CUDA, winget provides precompiled Vulkan binaries:
```powershell
winget install -e --id ggml.llamacpp
```
*(Binaries will reside under `%USERPROFILE%\AppData\Local\Microsoft\WinGet\Packages\ggml.llamacpp_Microsoft.Winget.Source_<hash>\`)*

---

### 2. Basalt (MoE & Vision Runner)

[Basalt](https://github.com/jesdga95/basalt) is used in `config.yaml` for heavyweight MoE models (such as Qwen 3.8 Flash Next 125B GSQ/RCO):
```yaml
macros:
  basalt-server: "${env.USERPROFILE}/Build/basalt/bin/Release/basalt.exe serve --port ${PORT}"
```

#### Windows Installer & Updater Script

This PowerShell script handles both **initial cloning/building** and **pulling updates/recompilation**:

```powershell
$buildDir = "$env:USERPROFILE\Build"
$basaltDir = "$buildDir\basalt"
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null

if (-not (Test-Path $basaltDir)) {
    Write-Host "Cloning Basalt repository..." -ForegroundColor Cyan
    git clone https://github.com/jesdga95/basalt.git $basaltDir
} else {
    Write-Host "Updating existing Basalt repository..." -ForegroundColor Cyan
    git -C $basaltDir pull
}

Set-Location $basaltDir

# Configure and compile Release binary
Write-Host "Compiling Basalt (Release)..." -ForegroundColor Cyan
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j

# Virtual environment and Python dependencies
if (-not (Test-Path ".venv")) {
    Write-Host "Initializing virtualenv via uv..." -ForegroundColor Cyan
    uv venv
}
uv pip install -r requirements.txt

Write-Host "Basalt is ready at: $basaltDir\bin\Release\basalt.exe" -ForegroundColor Green
```

---

### 3. Linux & macOS Setup for llama.cpp

### Linux

Depending on your distribution and hardware acceleration, choose one of the following:

#### Arch Linux
Install precompiled packages from the official repositories:
* **For Vulkan Support (AMD/NVIDIA/Intel):**
  ```bash
  sudo pacman -S llama-cpp-vulkan
  ```
* **For AMD GPU (ROCm) Support:**
  ```bash
  sudo pacman -S llama-cpp-rocm
  ```
* **For CPU-Only / CUDA Support (AUR):**
  ```bash
  yay -S llama.cpp-cuda
  ```

### macOS

On Apple Silicon (M1/M2/M3), compile or install with Metal support for hardware acceleration.

#### Via Homebrew
```bash
brew install llama.cpp
```

---

## Installation of llama-swap

### Windows

#### Install from winget

```powershell
winget install -e --id mostlygeek.llama-swap
```

### Linux

#### Build from Source
```bash
git clone https://github.com/mostlygeek/llama-swap.git
cd llama-swap
# Build requires Go (>= 1.21) and Node.js (for Web UI)
make clean all
sudo cp build/llama-swap /usr/local/bin/
```

### macOS

#### Via Homebrew
```bash
brew tap mostlygeek/llama-swap
brew install llama-swap
```

---

## Registering Llama-Swap as a Service

To keep `llama-swap` running continuously in the background, configure it as a service.

### Windows (Using NSSM)

Windows does not natively run arbitrary executables as background services. The **Non-Sucking Service Manager (NSSM)** is the recommended tool for wrapping the console binary.

1. Download NSSM from [nssm.cc](https://nssm.cc/download) and add it to your path.
2. Create the configuration directory and copy your configuration file:
   ```powershell
   New-Item -ItemType Directory -Force -Path "$HOME\Build\llama-swap"
   Copy-Item -Path "llama-swap\config.yaml" -Destination "$HOME\Build\llama-swap\config.yaml" -Force
   ```
3. Open PowerShell as **Administrator** and run:
   ```powershell
   nssm install LlamaSwap
   ```
4. A GUI window will pop up. Configure the following (replace `<hash>` with your actual Winget folder hash):
   * **Path:** `%USERPROFILE%\AppData\Local\Microsoft\WinGet\Packages\mostlygeek.llama-swap_Microsoft.Winget.Source_<hash>\llama-swap.exe`
   * **Startup directory:** `%USERPROFILE%\AppData\Local\Microsoft\WinGet\Packages\mostlygeek.llama-swap_Microsoft.Winget.Source_<hash>\`
   * **Arguments:** `--config %USERPROFILE%\Build\llama-swap\config.yaml --listen 127.0.0.1:8080`
5. Click **Install service**.
6. Start the service:
   ```powershell
   nssm start LlamaSwap
   ```

> [!TIP]
> Alternatively, you can install the service directly from the command line:
> ```powershell
> nssm install LlamaSwap "%USERPROFILE%\AppData\Local\Microsoft\WinGet\Packages\mostlygeek.llama-swap_Microsoft.Winget.Source_<hash>\llama-swap.exe" "--config %USERPROFILE%\Build\llama-swap\config.yaml --listen 127.0.0.1:8080"
> nssm start LlamaSwap
> ```

---

### Linux (Using Systemd)

Create a dedicated systemd service to manage `llama-swap`.

1. Create a service file at `/etc/systemd/system/llama-swap.service`:
   ```ini
   [Unit]
   Description=Llama-Swap Service (LLM Dynamic Router)
   After=network.target

   [Service]
   Type=simple
   User=YOUR_LINUX_USERNAME
   ExecStart=/usr/local/bin/llama-swap --config /etc/llama-swap/config.yaml --listen 127.0.0.1:8080
   Restart=always
   RestartSec=5
   # Optional: Redirect stderr/stdout logs
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   ```
   *(Note: Replace `YOUR_LINUX_USERNAME` with your actual username, as systemd does not expand `$USER`)*
2. Create the configuration directory and copy your configuration:
   ```bash
   sudo mkdir -p /etc/llama-swap/
   sudo cp llama-swap/config.yaml /etc/llama-swap/config.yaml
   ```
3. Reload systemd daemon, enable, and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable llama-swap.service
   sudo systemctl start llama-swap.service
   ```
4. Verify service status and check logs:
   ```bash
   sudo systemctl status llama-swap.service
   journalctl -u llama-swap.service -n 50 -f
   ```

---

### macOS (Using Launchd)

On macOS, configure a LaunchAgent so that the service runs under your user session context (important for accessing user-level GPU/Metal resources).

1. Create a plist file at `~/Library/LaunchAgents/com.mostlygeek.llama-swap.plist`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>Label</key>
       <string>com.mostlygeek.llama-swap</string>
       <key>ProgramArguments</key>
       <array>
           <!-- Use /opt/homebrew/bin/llama-swap on Apple Silicon, or /usr/local/bin/llama-swap on Intel -->
           <string>/opt/homebrew/bin/llama-swap</string>
           <string>--config</string>
           <string>/etc/llama-swap/config.yaml</string>
           <string>--listen</string>
           <string>127.0.0.1:8080</string>
       </array>
       <key>KeepAlive</key>
       <true/>
       <key>RunAtLoad</key>
       <true/>
       <key>StandardOutPath</key>
       <string>/tmp/llama-swap.stdout.log</string>
       <key>StandardErrorPath</key>
       <string>/tmp/llama-swap.stderr.log</string>
   </dict>
   </plist>
   ```
2. Create the configuration directory and copy your configuration:
   ```bash
   sudo mkdir -p /etc/llama-swap/
   sudo cp llama-swap/config.yaml /etc/llama-swap/config.yaml
   ```
3. Load the launch agent:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.mostlygeek.llama-swap.plist
   ```
4. To stop/unload the service, use:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.mostlygeek.llama-swap.plist
   ```

