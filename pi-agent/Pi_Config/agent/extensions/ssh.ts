/**
 * SSH Remote Execution Extension
 *
 * This module allows delegating standard file operations (read, write, edit) and terminal commands
 * (bash execution) to a remote machine over an SSH tunnel. It intercepts local tool calls and swaps
 * the underlying file system and shell operations behind the scenes.
 *
 * Usage:
 *   pi --ssh user@host
 *   pi --ssh user@host:/remote/path
 *
 * Requirements:
 *   - The user must have passwordless SSH key authentication set up with the target host.
 *   - The remote machine must have basic Unix utilities (e.g. bash, cat, base64, mkdir).
 */

import { spawn } from "node:child_process";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	type BashOperations,
	createBashTool,
	createEditTool,
	createReadTool,
	createWriteTool,
	type EditOperations,
	type ReadOperations,
	type WriteOperations,
} from "@earendil-works/pi-coding-agent";

/**
 * Creates a path translator function that maps paths from the local machine CWD
 * to the remote machine's targeted workspace directory.
 * 
 * @param remoteCwd - The working directory on the remote machine.
 * @param localCwd - The local working directory.
 * @returns A translator function that takes a local path and returns the resolved remote path.
 */
function createPathTranslator(remoteCwd: string, localCwd: string) {
	const normalizedLocal = path.resolve(localCwd).replace(/\\/g, "/").toLowerCase();
	const normalizedRemote = remoteCwd.replace(/\\/g, "/");

	return (p: string) => {
		// If it's already an absolute Unix-style path, return it directly
		// to prevent Windows-native path resolution from corrupting it.
		if (p.startsWith("/")) {
			return p;
		}

		const resolved = path.resolve(p).replace(/\\/g, "/");
		const normalizedResolved = resolved.toLowerCase();

		// If the path resides within the local workspace directory,
		// translate it to the corresponding path relative to the remote directory.
		if (normalizedResolved.startsWith(normalizedLocal)) {
			const relativePart = resolved.slice(normalizedLocal.length);
			return (normalizedRemote + relativePart).replace(/\/+/g, "/");
		}
		return resolved;
	};
}

/**
 * Safely wraps a shell argument in single quotes, escaping any internal single quotes.
 * 
 * @param arg - The argument string to escape.
 * @returns The escaped argument safe for bash shell execution.
 */
function shellEscape(arg: string): string {
	return "'" + arg.replace(/'/g, "'\\''") + "'";
}

/**
 * Spawns an SSH child process to execute a single remote command synchronously-feeling (via Promise).
 * 
 * @param remoteArgs - Arguments containing user, host, and port (e.g., ["-p", "22", "user@host"]).
 * @param command - The command string to execute on the remote machine.
 * @returns A Promise resolving to a buffer of stdout. Rejects if exit code is non-zero.
 */
function sshExec(remoteArgs: string[], command: string): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const child = spawn("ssh", [...remoteArgs, command], { stdio: ["ignore", "pipe", "pipe"] });
		const chunks: Buffer[] = [];
		const errChunks: Buffer[] = [];
		
		child.stdout.on("data", (data) => chunks.push(data));
		child.stderr.on("data", (data) => errChunks.push(data));
		child.on("error", reject);
		child.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(`SSH failed (${code}): ${Buffer.concat(errChunks).toString()}`));
			} else {
				resolve(Buffer.concat(chunks));
			}
		});
	});
}

/**
 * Implements ReadOperations using remote SSH calls (cat, file, test).
 */
function createRemoteReadOps(remoteArgs: string[], remoteCwd: string, localCwd: string): ReadOperations {
	const toRemote = createPathTranslator(remoteCwd, localCwd);
	return {
		// Read a file remotely over SSH by running `cat`
		readFile: (p) => sshExec(remoteArgs, `cat ${shellEscape(toRemote(p))}`),
		// Test if file exists and is readable
		access: (p) => sshExec(remoteArgs, `test -r ${shellEscape(toRemote(p))}`).then(() => {}),
		// Detect image mimetype remotely using the `file` utility
		detectImageMimeType: async (p) => {
			try {
				const r = await sshExec(remoteArgs, `file --mime-type -b ${shellEscape(toRemote(p))}`);
				const m = r.toString().trim();
				return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(m) ? m : null;
			} catch {
				return null;
			}
		},
	};
}

/**
 * Implements WriteOperations using remote SSH calls (mkdir -p, base64 write piping).
 */
function createRemoteWriteOps(remoteArgs: string[], remoteCwd: string, localCwd: string): WriteOperations {
	const toRemote = createPathTranslator(remoteCwd, localCwd);
	return {
		// Write a file remotely by piping the raw buffer over stdin directly to cat.
		// This avoids base64-encoding overhead and E2BIG (Argument list too long) shell limits.
		writeFile: (p, content) => {
			return new Promise((resolve, reject) => {
				const child = spawn("ssh", [...remoteArgs, `cat > ${shellEscape(toRemote(p))}`], {
					stdio: ["pipe", "ignore", "pipe"],
				});
				child.stdin.write(content);
				child.stdin.end();

				const errChunks: Buffer[] = [];
				child.stderr.on("data", (data) => errChunks.push(data));
				child.on("error", reject);
				child.on("close", (code) => {
					if (code !== 0) {
						reject(new Error(`SSH writeFile failed (${code}): ${Buffer.concat(errChunks).toString()}`));
					} else {
						resolve();
					}
				});
			});
		},
		// Create remote directories recursively
		mkdir: (dir) => sshExec(remoteArgs, `mkdir -p ${shellEscape(toRemote(dir))}`).then(() => {}),
	};
}

/**
 * Implements EditOperations by combining remote Read and Write operations.
 */
function createRemoteEditOps(remoteArgs: string[], remoteCwd: string, localCwd: string): EditOperations {
	const r = createRemoteReadOps(remoteArgs, remoteCwd, localCwd);
	const w = createRemoteWriteOps(remoteArgs, remoteCwd, localCwd);
	return { readFile: r.readFile, access: r.access, writeFile: w.writeFile };
}

/**
 * Implements BashOperations by spawning commands wrapped inside remote SSH processes.
 */
function createRemoteBashOps(remoteArgs: string[], remoteCwd: string, localCwd: string): BashOperations {
	const toRemote = createPathTranslator(remoteCwd, localCwd);
	return {
		exec: (command, cwd, { onData, signal, timeout }) =>
			new Promise((resolve, reject) => {
				// Navigate to the translated remote working directory before running the command
				const cmd = `cd ${shellEscape(toRemote(cwd))} && ${command}`;
				const child = spawn("ssh", [...remoteArgs, cmd], { stdio: ["ignore", "pipe", "pipe"] });
				let timedOut = false;
				
				const timer = timeout
					? setTimeout(() => {
							timedOut = true;
							child.kill();
						}, timeout * 1000)
					: undefined;
					
				child.stdout.on("data", onData);
				child.stderr.on("data", onData);
				child.on("error", (e) => {
					if (timer) clearTimeout(timer);
					reject(e);
				});
				
				const onAbort = () => child.kill();
				signal?.addEventListener("abort", onAbort, { once: true });
				
				child.on("close", (code) => {
					if (timer) clearTimeout(timer);
					signal?.removeEventListener("abort", onAbort);
					if (signal?.aborted) reject(new Error("aborted"));
					else if (timedOut) reject(new Error(`timeout:${timeout}`));
					else resolve({ exitCode: code });
				});
			}),
	};
}

/**
 * Registers SSH commands, CLI flags, and intercepts tool calls to bind them
 * to the remote environment when --ssh is active.
 */
export default function (pi: ExtensionAPI) {
	// Register the command line flag configuration
	pi.registerFlag("ssh", { description: "SSH remote: user@host or user@host:/path", type: "string" });

	const localCwd = process.cwd();
	const localRead = createReadTool(localCwd);
	const localWrite = createWriteTool(localCwd);
	const localEdit = createEditTool(localCwd);
	const localBash = createBashTool(localCwd);

	// Holds the parsed connection details and CWD once established
	let resolvedSsh: { remoteArgs: string[]; remoteCwd: string } | null = null;
	const getSsh = () => resolvedSsh;

	// ----------------------------------------------------
	// Tool Overrides
	// Intercept standard tools and inject remote operations if SSH is active.
	// ----------------------------------------------------

	pi.registerTool({
		...localRead,
		async execute(id, params, signal, onUpdate, _ctx) {
			const ssh = getSsh();
			if (ssh) {
				const tool = createReadTool(localCwd, {
					operations: createRemoteReadOps(ssh.remoteArgs, ssh.remoteCwd, localCwd),
				});
				return tool.execute(id, params, signal, onUpdate);
			}
			return localRead.execute(id, params, signal, onUpdate);
		},
	});

	pi.registerTool({
		...localWrite,
		async execute(id, params, signal, onUpdate, _ctx) {
			const ssh = getSsh();
			if (ssh) {
				const tool = createWriteTool(localCwd, {
					operations: createRemoteWriteOps(ssh.remoteArgs, ssh.remoteCwd, localCwd),
				});
				return tool.execute(id, params, signal, onUpdate);
			}
			return localWrite.execute(id, params, signal, onUpdate);
		},
	});

	pi.registerTool({
		...localEdit,
		async execute(id, params, signal, onUpdate, _ctx) {
			const ssh = getSsh();
			if (ssh) {
				const tool = createEditTool(localCwd, {
					operations: createRemoteEditOps(ssh.remoteArgs, ssh.remoteCwd, localCwd),
				});
				return tool.execute(id, params, signal, onUpdate);
			}
			return localEdit.execute(id, params, signal, onUpdate);
		},
	});

	pi.registerTool({
		...localBash,
		async execute(id, params, signal, onUpdate, _ctx) {
			const ssh = getSsh();
			if (ssh) {
				const tool = createBashTool(localCwd, {
					operations: createRemoteBashOps(ssh.remoteArgs, ssh.remoteCwd, localCwd),
				});
				return tool.execute(id, params, signal, onUpdate);
			}
			return localBash.execute(id, params, signal, onUpdate);
		},
	});

	// ----------------------------------------------------
	// Event Listeners
	// Initialize connection, handle terminal redirects, and update LLM context prompts.
	// ----------------------------------------------------

	pi.on("session_start", async (_event, ctx) => {
		const arg = pi.getFlag("ssh") as string | undefined;
		if (arg) {
			let remoteStr = "";
			let remoteCwd = "";
			
			// Parse out the target remote working directory if appended with a colon (e.g. user@host:/path)
			const idx = arg.indexOf(":");
			if (idx !== -1) {
				remoteStr = arg.slice(0, idx);
				remoteCwd = arg.slice(idx + 1);
			} else {
				remoteStr = arg;
			}
			const remoteArgs = remoteStr.split(/\s+/).filter(Boolean);

			try {
				if (remoteCwd === "") {
					// Connection verification: evaluate pwd on remote to get the default home directory
					const pwd = (await sshExec(remoteArgs, "pwd")).toString().trim();
					remoteCwd = pwd;
				} else {
					// Verify connection and assert that the specified remote directory exists
					await sshExec(remoteArgs, `test -d ${shellEscape(remoteCwd)}`);
				}
				resolvedSsh = { remoteArgs, remoteCwd };
				
				const displayString = remoteArgs.join(" ");
				ctx.ui.setStatus("ssh", ctx.ui.theme.fg("accent", `SSH: ${displayString}:${resolvedSsh.remoteCwd}`));
				ctx.ui.notify(`SSH mode: ${displayString}:${resolvedSsh.remoteCwd}`, "info");
			} catch (e: any) {
				resolvedSsh = null;
				ctx.ui.notify(`⚠️ SSH connection failed: ${e.message}. Falling back to local execution.`, "error");
			}
		}
	});

	// Redirect interactive user shell commands (!) to the SSH connection
	pi.on("user_bash", (_event) => {
		const ssh = getSsh();
		if (!ssh) return;
		return { operations: createRemoteBashOps(ssh.remoteArgs, ssh.remoteCwd, localCwd) };
	});

	// Intercept and update the system prompt context so the LLM is aware of the remote working environment
	pi.on("before_agent_start", async (event) => {
		const ssh = getSsh();
		if (ssh) {
			const displayString = ssh.remoteArgs.join(" ");
			
			// Escape regex special chars in local CWD and construct a robust case-insensitive pattern 
			// that accommodates both slash types to handle drive/separator casing mismatches on Windows.
			const escapedLocal = localCwd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const regexStr = "Current working directory:\\s*" + escapedLocal.replace(/\\\\|\\/g, "[\\\\/]");
			const regex = new RegExp(regexStr, "i");

			const modified = event.systemPrompt.replace(
				regex,
				`Current working directory: ${ssh.remoteCwd} (via SSH: ${displayString})`,
			);
			return { systemPrompt: modified };
		}
	});
}
