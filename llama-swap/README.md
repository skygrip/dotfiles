# Llama-Swap Installation & Configuration Guide

[Llama-swap](https://github.com/mostlygeek/llama-swap) is an OpenAI API-compatible proxy server designed to manage and dynamically swap local Large Language Models (LLMs) on-demand. When an API call is made, Llama-swap starts the appropriate model server (e.g., `llama-server` from `llama.cpp`), routes the request, and automatically unloads inactive models after a specified Time-to-Live (TTL) to free up VRAM/RAM.

This document guides you through installing `llama.cpp` and `llama-swap` on Windows, Linux, and macOS, configuring the services, and documenting the active setup defined in [config.yaml](config.yaml).

---

## Installation of llama.cpp

`llama.cpp` serves as the underlying inference engine. Depending on your platform, follow the instructions below to install it.

### Windows

The easiest way to install `llama.cpp` on Windows is via the Windows Package Manager (**winget**), which installs precompiled binaries (usually configured with Vulkan support for broad GPU compatibility).

1. Open PowerShell or Command Prompt and run:
   ```powershell
   winget install -e --id ggml.llamacpp
   ```
2. By default, winget installs package binaries under the local app data path:
   ```
   %USERPROFILE%\AppData\Local\Microsoft\WinGet\Packages\ggml.llamacpp_Microsoft.Winget.Source_<hash>\
   ```

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
   User=$USER
   ExecStart=/usr/local/bin/llama-swap --config /etc/llama-swap/config.yaml --listen 127.0.0.1:8080
   Restart=always
   RestartSec=5
   # Optional: Redirect stderr/stdout logs
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   ```
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
           <string>/usr/local/bin/llama-swap</string>
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

