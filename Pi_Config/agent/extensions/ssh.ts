/**
 * SSH Remote Execution Example
 *
 * Demonstrates delegating tool operations to a remote machine via SSH.
 * When --ssh is provided, read/write/edit/bash run on the remote.
 *
 * Usage:
 *   pi --ssh user@host
 *   pi --ssh user@host:/remote/path
 *
 * Requirements:
 *   - SSH key-based auth (no password prompts)
 *   - bash on remote
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

function createPathTranslator(remoteCwd: string, localCwd: string) {
	const normalizedLocal = path.resolve(localCwd).replace(/\\/g, "/").toLowerCase();
	const normalizedRemote = remoteCwd.replace(/\\/g, "/");

	return (p: string) => {
		const resolved = path.resolve(p).replace(/\\/g, "/");
		const normalizedResolved = resolved.toLowerCase();

		if (normalizedResolved.startsWith(normalizedLocal)) {
			const relativePart = resolved.slice(normalizedLocal.length);
			return (normalizedRemote + relativePart).replace(/\/+/g, "/");
		}
		return resolved;
	};
}

function shellEscape(arg: string): string {
	return "'" + arg.replace(/'/g, "'\\''") + "'";
}

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

function createRemoteReadOps(remoteArgs: string[], remoteCwd: string, localCwd: string): ReadOperations {
	const toRemote = createPathTranslator(remoteCwd, localCwd);
	return {
		readFile: (p) => sshExec(remoteArgs, `cat ${shellEscape(toRemote(p))}`),
		access: (p) => sshExec(remoteArgs, `test -r ${shellEscape(toRemote(p))}`).then(() => {}),
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

function createRemoteWriteOps(remoteArgs: string[], remoteCwd: string, localCwd: string): WriteOperations {
	const toRemote = createPathTranslator(remoteCwd, localCwd);
	return {
		writeFile: async (p, content) => {
			const b64 = Buffer.from(content).toString("base64");
			await sshExec(remoteArgs, `echo ${shellEscape(b64)} | base64 -d > ${shellEscape(toRemote(p))}`);
		},
		mkdir: (dir) => sshExec(remoteArgs, `mkdir -p ${shellEscape(toRemote(dir))}`).then(() => {}),
	};
}

function createRemoteEditOps(remoteArgs: string[], remoteCwd: string, localCwd: string): EditOperations {
	const r = createRemoteReadOps(remoteArgs, remoteCwd, localCwd);
	const w = createRemoteWriteOps(remoteArgs, remoteCwd, localCwd);
	return { readFile: r.readFile, access: r.access, writeFile: w.writeFile };
}

function createRemoteBashOps(remoteArgs: string[], remoteCwd: string, localCwd: string): BashOperations {
	const toRemote = createPathTranslator(remoteCwd, localCwd);
	return {
		exec: (command, cwd, { onData, signal, timeout }) =>
			new Promise((resolve, reject) => {
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

export default function (pi: ExtensionAPI) {
	pi.registerFlag("ssh", { description: "SSH remote: user@host or user@host:/path", type: "string" });

	const localCwd = process.cwd();
	const localRead = createReadTool(localCwd);
	const localWrite = createWriteTool(localCwd);
	const localEdit = createEditTool(localCwd);
	const localBash = createBashTool(localCwd);

	// Resolved lazily on session_start (CLI flags not available during factory)
	let resolvedSsh: { remoteArgs: string[]; remoteCwd: string } | null = null;

	const getSsh = () => resolvedSsh;

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

	pi.on("session_start", async (_event, ctx) => {
		// Resolve SSH config now that CLI flags are available
		const arg = pi.getFlag("ssh") as string | undefined;
		if (arg) {
			let remoteStr = "";
			let remoteCwd = "";
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
					// Evaluate pwd on remote to test connection and get remote CWD
					const pwd = (await sshExec(remoteArgs, "pwd")).toString().trim();
					remoteCwd = pwd;
				} else {
					// Verify connection and check if the remote directory exists
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

	// Handle user ! commands via SSH
	pi.on("user_bash", (_event) => {
		const ssh = getSsh();
		if (!ssh) return; // No SSH, use local execution
		return { operations: createRemoteBashOps(ssh.remoteArgs, ssh.remoteCwd, localCwd) };
	});

	// Replace local cwd with remote cwd in system prompt
	pi.on("before_agent_start", async (event) => {
		const ssh = getSsh();
		if (ssh) {
			const displayString = ssh.remoteArgs.join(" ");
			const modified = event.systemPrompt.replace(
				`Current working directory: ${localCwd}`,
				`Current working directory: ${ssh.remoteCwd} (via SSH: ${displayString})`,
			);
			return { systemPrompt: modified };
		}
	});
}
