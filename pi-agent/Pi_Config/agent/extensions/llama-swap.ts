import * as fs from "node:fs";
import * as path from "node:path";
import type {
	ApiKeyCredential,
	AuthResult,
	Model,
	Provider,
	ProviderStreamOptions,
	RefreshModelsContext,
	ThinkingLevelMap,
} from "@earendil-works/pi-ai";
import { stream, streamSimple } from "@earendil-works/pi-ai/compat";
import { type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent";

export const LLAMA_SWAP_PROVIDER_ID = "llama-swap";
export const DEFAULT_LLAMA_SWAP_URL = "http://127.0.0.1:8080";
export const DEFAULT_API_KEY = "not-needed";

export interface LlamaSwapModelMeta {
	type?: string;
	reasoning?: boolean;
	maxTokens?: number;
	max_completion_tokens?: number;
	thinkingLevelMap?: ThinkingLevelMap;
}

export interface LlamaSwapModelEntry {
	id: string;
	name?: string;
	description?: string;
	context_window?: number;
	context_length?: number;
	architecture?: {
		input_modalities?: string[];
		output_modalities?: string[];
	};
	capabilities?: {
		vision?: boolean;
		function_calling?: boolean;
		tools?: boolean;
		in?: string[];
		out?: string[];
		context?: number;
	};
	meta?: {
		n_ctx?: number;
		llamaswap?: LlamaSwapModelMeta;
	};
	metadata?: LlamaSwapModelMeta;
}

export interface StoredLlamaSwapServer {
	name: string;
	serverUrl: string;
	apiKey: string;
}

export const BINARY_THINKING_MAP: ThinkingLevelMap = {
	off: "none",
	minimal: null,
	low: null,
	medium: "medium",
	high: null,
	xhigh: null,
};

export const MULTI_LEVEL_THINKING_MAP: ThinkingLevelMap = {
	off: "none",
	minimal: null,
	low: "low",
	medium: "medium",
	high: "xhigh",
	xhigh: null,
};

const CORE_THINKING_LEVELS: readonly (keyof ThinkingLevelMap)[] = [
	"off",
	"minimal",
	"low",
	"medium",
	"high",
];

function normalizeThinkingLevelMap(
	customMap: ThinkingLevelMap | undefined,
	fallbackMap: ThinkingLevelMap,
): ThinkingLevelMap {
	if (!customMap || typeof customMap !== "object") {
		return fallbackMap;
	}
	const normalized: ThinkingLevelMap = {
		...customMap,
		xhigh: Object.hasOwn(customMap, "xhigh") ? customMap.xhigh : null,
	};
	for (const level of CORE_THINKING_LEVELS) {
		if (!Object.hasOwn(customMap, level)) {
			normalized[level] = null;
		}
	}
	return normalized;
}

export function normalizeServerUrl(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error("Server URL must not be empty");
	}
	const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmed);
	let withProtocol = trimmed;
	if (!hasScheme) {
		const hostPort = trimmed.split("/")[0] ?? "";
		const isLocalOrIp =
			/^(?:localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|\[::1\])(?::\d+)?$/iu.test(
				hostPort,
			);
		const hasExplicitNonHttpsPort = /:(?!443$)\d+$/u.test(hostPort);
		const useHttps = /:443$/u.test(hostPort) || (!isLocalOrIp && !hasExplicitNonHttpsPort && hostPort.includes("."));
		withProtocol = `${useHttps ? "https" : "http"}://${trimmed}`;
	}
	const url = new URL(withProtocol);
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("Server URL must use http or https");
	}
	url.hash = "";
	url.search = "";
	url.pathname = url.pathname.replace(/\/+$/u, "").replace(/\/v1$/u, "") || "/";
	return url.toString().replace(/\/$/u, "");
}

export function tryNormalizeServerUrl(value: string | undefined): string | undefined {
	if (typeof value !== "string" || !value.trim()) return undefined;
	try {
		return normalizeServerUrl(value);
	} catch {
		return undefined;
	}
}

export function inferenceBaseUrl(serverUrl: string): string {
	return `${normalizeServerUrl(serverUrl)}/v1`;
}

function credentialServerUrl(credential: ApiKeyCredential | undefined): string | undefined {
	return tryNormalizeServerUrl(credential?.env?.LLAMA_SWAP_URL);
}

function credentialFriendlyName(credential: ApiKeyCredential | undefined): string | undefined {
	const value = credential?.env?.LLAMA_SWAP_NAME;
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function defaultAuthPath(): string {
	return path.join(getAgentDir(), "auth.json");
}

function readAuthJson(authPath: string): Record<string, unknown> {
	try {
		if (!fs.existsSync(authPath)) return {};
		const raw = fs.readFileSync(authPath, "utf8").replace(/^\uFEFF/u, "");
		const parsed = JSON.parse(raw);
		return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

function writeAuthJson(authPath: string, data: Record<string, unknown>): void {
	try {
		const dir = path.dirname(authPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
		}
		fs.writeFileSync(authPath, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
	} catch {
		// Ignore write errors on read-only filesystems or locked files.
	}
}

export function saveInstanceToAuthJson(authPath: string, server: StoredLlamaSwapServer): void {
	const data = readAuthJson(authPath);
	data[server.name] = {
		type: "api_key",
		key: server.apiKey || DEFAULT_API_KEY,
		env: {
			LLAMA_SWAP_NAME: server.name,
			LLAMA_SWAP_URL: server.serverUrl,
		},
	};
	if (server.name !== LLAMA_SWAP_PROVIDER_ID && LLAMA_SWAP_PROVIDER_ID in data) {
		const rootEntry = data[LLAMA_SWAP_PROVIDER_ID] as ApiKeyCredential | undefined;
		if (rootEntry?.env?.LLAMA_SWAP_NAME === server.name) {
			delete data[LLAMA_SWAP_PROVIDER_ID];
		}
	}
	writeAuthJson(authPath, data);
}

export function migrateAndLoadStoredServers(authPath: string = defaultAuthPath()): Map<string, StoredLlamaSwapServer> {
	const data = readAuthJson(authPath);
	const servers = new Map<string, StoredLlamaSwapServer>();
	let mutated = false;

	for (const [providerId, rawCred] of Object.entries(data)) {
		if (typeof rawCred !== "object" || rawCred === null || Array.isArray(rawCred)) continue;
		const cred = rawCred as ApiKeyCredential;
		if (cred.type !== "api_key") continue;
		const url = credentialServerUrl(cred);
		if (!url) continue;

		const friendlyName = credentialFriendlyName(cred) ?? providerId;
		const apiKey = typeof cred.key === "string" && cred.key.trim() ? cred.key.trim() : DEFAULT_API_KEY;

		if (providerId === LLAMA_SWAP_PROVIDER_ID && friendlyName !== LLAMA_SWAP_PROVIDER_ID) {
			data[friendlyName] = {
				type: "api_key",
				key: apiKey,
				env: {
					...cred.env,
					LLAMA_SWAP_NAME: friendlyName,
					LLAMA_SWAP_URL: url,
				},
			};
			delete data[LLAMA_SWAP_PROVIDER_ID];
			mutated = true;
		}

		servers.set(friendlyName, {
			name: friendlyName,
			serverUrl: url,
			apiKey,
		});
	}

	if (mutated) {
		writeAuthJson(authPath, data);
	}

	return servers;
}

export async function fetchCatalog(
	serverUrl: string,
	apiKey: string,
	signal?: AbortSignal,
	fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<LlamaSwapModelEntry[]> {
	const normalizedUrl = normalizeServerUrl(serverUrl);
	const headers = new Headers();
	if (apiKey && apiKey !== DEFAULT_API_KEY) {
		headers.set("Authorization", `Bearer ${apiKey}`);
	}
	const timeout = AbortSignal.timeout(15_000);
	const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

	const response = await fetchImpl(`${normalizedUrl}/v1/models`, {
		headers,
		signal: combinedSignal,
	});

	if (!response.ok) {
		throw new Error(`llama-swap returned HTTP ${response.status}`);
	}

	const payload = (await response.json()) as { data?: unknown };
	if (!payload || typeof payload !== "object" || !Array.isArray(payload.data)) {
		throw new Error("llama-swap returned an invalid /v1/models catalog");
	}

	return payload.data.filter(
		(entry): entry is LlamaSwapModelEntry =>
			typeof entry === "object" &&
			entry !== null &&
			typeof (entry as { id?: unknown }).id === "string",
	);
}

export function toPiModel(
	entry: LlamaSwapModelEntry,
	serverUrl: string,
	providerId: string = LLAMA_SWAP_PROVIDER_ID,
): Model<"openai-completions"> {
	const meta: LlamaSwapModelMeta = entry.meta?.llamaswap ?? entry.metadata ?? {};

	const contextWindow =
		(typeof entry.context_window === "number" && entry.context_window > 0 ? entry.context_window : undefined) ??
		(typeof entry.context_length === "number" && entry.context_length > 0 ? entry.context_length : undefined) ??
		(typeof entry.capabilities?.context === "number" && entry.capabilities.context > 0
			? entry.capabilities.context
			: undefined) ??
		(typeof entry.meta?.n_ctx === "number" && entry.meta.n_ctx > 0 ? entry.meta.n_ctx : undefined) ??
		131072;

	const isVision =
		entry.capabilities?.vision === true ||
		entry.capabilities?.in?.includes("image") === true ||
		entry.architecture?.input_modalities?.includes("image") === true;

	const supportsTools =
		entry.capabilities?.function_calling ?? entry.capabilities?.tools;

	const reasoning =
		typeof meta.reasoning === "boolean"
			? meta.reasoning
			: supportsTools !== false;

	const isMultiLevelModel =
		entry.id.toLowerCase().includes("basalt") ||
		entry.id.toLowerCase().includes("flash-next") ||
		(entry.description?.toLowerCase().includes("basalt") ?? false);

	const defaultMaxTokens = isMultiLevelModel ? 32768 : 16384;
	const configuredMaxTokens =
		(typeof meta.maxTokens === "number" && meta.maxTokens > 0 ? meta.maxTokens : undefined) ??
		(typeof meta.max_completion_tokens === "number" && meta.max_completion_tokens > 0
			? meta.max_completion_tokens
			: undefined) ??
		defaultMaxTokens;
	const maxTokens = Math.min(configuredMaxTokens, contextWindow);

	const fallbackThinkingMap = isMultiLevelModel ? MULTI_LEVEL_THINKING_MAP : BINARY_THINKING_MAP;
	const thinkingLevelMap: ThinkingLevelMap | undefined = reasoning
		? normalizeThinkingLevelMap(meta.thinkingLevelMap, fallbackThinkingMap)
		: undefined;

	return {
		id: entry.id,
		name: entry.name?.trim() || entry.id,
		api: "openai-completions",
		provider: providerId,
		baseUrl: inferenceBaseUrl(serverUrl),
		reasoning,
		...(thinkingLevelMap && { thinkingLevelMap }),
		input: isVision ? ["text", "image"] : ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow,
		maxTokens,
		compat: {
			supportsStore: false,
			supportsDeveloperRole: false,
			supportsReasoningEffort: true,
			supportsUsageInStreaming: true,
			supportsStrictMode: false,
			maxTokensField: "max_tokens",
		},
	};
}

export interface CreateInstanceProviderOptions {
	authPath?: string;
	fetchImpl?: typeof globalThis.fetch;
	allowEnvFallback?: boolean;
	onLogout?: (instanceId: string) => void;
}

export function createInstanceProvider(
	instanceId: string,
	initialServer: StoredLlamaSwapServer,
	initialModels: readonly Model<"openai-completions">[] = [],
	options: CreateInstanceProviderOptions = {},
): Provider<"openai-completions"> {
	let models: readonly Model<"openai-completions">[] = initialModels;
	let currentServer: StoredLlamaSwapServer | undefined = { ...initialServer };
	const authPath = options.authPath ?? defaultAuthPath();
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	const allowEnvFallback = options.allowEnvFallback === true;

	const isStillStored = (credential: ApiKeyCredential | undefined): StoredLlamaSwapServer | undefined => {
		if (credential) {
			const url = credentialServerUrl(credential) ?? currentServer?.serverUrl;
			if (url) {
				const updated: StoredLlamaSwapServer = {
					name: instanceId,
					serverUrl: url,
					apiKey: credential.key?.trim() || currentServer?.apiKey || DEFAULT_API_KEY,
				};
				currentServer = updated;
				return updated;
			}
		}

		const stored = migrateAndLoadStoredServers(authPath).get(instanceId);
		if (stored) {
			currentServer = stored;
			return stored;
		}

		const envUrl = allowEnvFallback ? tryNormalizeServerUrl(process.env.LLAMA_SWAP_URL) : undefined;
		if (envUrl) {
			const envServer: StoredLlamaSwapServer = {
				name: instanceId,
				serverUrl: envUrl,
				apiKey: process.env.LLAMA_SWAP_API_KEY?.trim() || DEFAULT_API_KEY,
			};
			currentServer = envServer;
			return envServer;
		}

		currentServer = undefined;
		return undefined;
	};

	return {
		id: instanceId,
		name: `${instanceId} (llama-swap)`,
		get baseUrl() {
			return inferenceBaseUrl(currentServer?.serverUrl ?? initialServer.serverUrl);
		},
		auth: {
			apiKey: {
				name: `${instanceId} (llama-swap)`,
				login: async (interaction): Promise<ApiKeyCredential> => {
					const enteredUrl = await interaction.prompt({
						type: "text",
						message: `llama-swap server URL for ${instanceId}`,
						placeholder: currentServer?.serverUrl ?? initialServer.serverUrl,
					});
					const serverUrl = normalizeServerUrl(
						enteredUrl.trim() || currentServer?.serverUrl || initialServer.serverUrl,
					);

					const enteredKey = (
						await interaction.prompt({
							type: "secret",
							message: "API token (optional)",
						})
					).trim();
					const apiKey = enteredKey || DEFAULT_API_KEY;

					const catalog = await fetchCatalog(serverUrl, apiKey, interaction.signal, fetchImpl);
					currentServer = { name: instanceId, serverUrl, apiKey };
					models = catalog.map((entry) => toPiModel(entry, serverUrl, instanceId));

					return {
						type: "api_key",
						key: apiKey,
						env: {
							LLAMA_SWAP_NAME: instanceId,
							LLAMA_SWAP_URL: serverUrl,
						},
					};
				},
				check: async ({ credential }) => {
					const active = isStillStored(credential);
					if (!active) {
						models = [];
						options.onLogout?.(instanceId);
						return undefined;
					}
					return {
						type: "api_key",
						source: `${instanceId} (${active.serverUrl})`,
					};
				},
				resolve: async ({ ctx, credential }): Promise<AuthResult | undefined> => {
					const active = isStillStored(credential);
					if (!active) {
						models = [];
						options.onLogout?.(instanceId);
						return undefined;
					}
					const apiKey =
						active.apiKey ||
						(await ctx.env("LLAMA_SWAP_API_KEY"))?.trim() ||
						DEFAULT_API_KEY;
					return {
						auth: { apiKey, baseUrl: inferenceBaseUrl(active.serverUrl) },
						env: {
							...credential?.env,
							LLAMA_SWAP_NAME: instanceId,
							LLAMA_SWAP_URL: active.serverUrl,
						},
						source: `${instanceId} (${active.serverUrl})`,
					};
				},
			},
		},
		getModels: () => models,
		refreshModels: async (context: RefreshModelsContext): Promise<void> => {
			if (context.stored) {
				const restored = context.stored.models.filter(
					(model): model is Model<"openai-completions"> =>
						model.provider === instanceId &&
						(model.type ?? "chat") === "chat" &&
						model.api === "openai-completions",
				);
				if (
					!(await context.publish({
						update: () => {
							models = restored;
						},
					}))
				) {
					return;
				}
			}

			const cred = context.credential?.type === "api_key" ? context.credential : undefined;
			const active = isStillStored(cred);
			if (!active) {
				await context.publish({
					persist: null,
					update: () => {
						models = [];
					},
				});
				options.onLogout?.(instanceId);
				return;
			}

			const shouldFetch = (context.allowNetwork || models.length === 0) && !process.env.PI_OFFLINE;
			if (!shouldFetch || context.signal.aborted) {
				return;
			}

			let catalog: LlamaSwapModelEntry[];
			try {
				catalog = await fetchCatalog(active.serverUrl, active.apiKey, context.signal, fetchImpl);
			} catch (error) {
				if (context.allowNetwork) throw error;
				return;
			}
			if (context.signal.aborted) return;

			const refreshed = catalog.map((entry) => toPiModel(entry, active.serverUrl, instanceId));
			if (context.signal.aborted) return;

			await context.publish({
				persist: { models: refreshed, checkedAt: Date.now() },
				update: () => {
					models = refreshed;
				},
			});
		},
		stream: (model, context, streamOpts) =>
			stream(model, context, {
				...(streamOpts as ProviderStreamOptions | undefined),
				...(options.fetchImpl && !streamOpts?.fetch ? { fetch: options.fetchImpl } : {}),
			}),
		streamSimple: (model, context, streamOpts) =>
			streamSimple(model, context, {
				...streamOpts,
				...(options.fetchImpl && !streamOpts?.fetch ? { fetch: options.fetchImpl } : {}),
			}),
	};
}

export interface LlamaSwapExtensionOptions {
	authPath?: string;
	fetchImpl?: typeof globalThis.fetch;
}

export default function llamaSwapExtension(
	pi: ExtensionAPI,
	options: LlamaSwapExtensionOptions = {},
): void {
	const authPath = options.authPath ?? defaultAuthPath();
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	const registeredInstances = new Set<string>();

	const registerOrUpdateInstance = (
		server: StoredLlamaSwapServer,
		initialModels: readonly Model<"openai-completions">[] = [],
		allowEnvFallback: boolean = false,
	): void => {
		const instanceProvider = createInstanceProvider(server.name, server, initialModels, {
			authPath,
			fetchImpl,
			allowEnvFallback,
			onLogout: (id) => {
				if (registeredInstances.has(id) && id !== LLAMA_SWAP_PROVIDER_ID) {
					registeredInstances.delete(id);
					try {
						pi.unregisterProvider(id);
					} catch {
						// Ignore if already unregistered.
					}
				}
			},
		});
		registeredInstances.add(server.name);
		pi.registerProvider(instanceProvider);
	};

	// 1. Load & migrate all existing llama-swap servers from auth.json
	const storedServers = migrateAndLoadStoredServers(authPath);
	for (const server of storedServers.values()) {
		if (server.name !== LLAMA_SWAP_PROVIDER_ID) {
			registerOrUpdateInstance(server);
		}
	}

	// 2. Support ambient LLAMA_SWAP_URL environment variable when no servers are stored
	const envUrl = tryNormalizeServerUrl(process.env.LLAMA_SWAP_URL);
	if (envUrl && registeredInstances.size === 0 && !storedServers.has(LLAMA_SWAP_PROVIDER_ID)) {
		const envName = process.env.LLAMA_SWAP_NAME?.trim() || LLAMA_SWAP_PROVIDER_ID;
		const envKey = process.env.LLAMA_SWAP_API_KEY?.trim() || DEFAULT_API_KEY;
		if (envName !== LLAMA_SWAP_PROVIDER_ID) {
			registerOrUpdateInstance(
				{ name: envName, serverUrl: envUrl, apiKey: envKey },
				[],
				true,
			);
		}
	}

	// 3. Register the "llama-swap" provider so `/login llama-swap` can add new named instances
	let rootModels: readonly Model<"openai-completions">[] = [];
	const rootProvider: Provider<"openai-completions"> = {
		id: LLAMA_SWAP_PROVIDER_ID,
		name: "llama-swap (Add Endpoint)",
		baseUrl: inferenceBaseUrl(DEFAULT_LLAMA_SWAP_URL),
		auth: {
			apiKey: {
				name: "llama-swap endpoint",
				login: async (interaction): Promise<ApiKeyCredential> => {
					const defaultEndpointName = "node-1";
					const enteredName = await interaction.prompt({
						type: "text",
						message: "Endpoint name (used as [badge] in /model, e.g. node-1)",
						placeholder: process.env.LLAMA_SWAP_NAME?.trim() || defaultEndpointName,
					});
					const friendlyName =
						enteredName.trim() || process.env.LLAMA_SWAP_NAME?.trim() || defaultEndpointName;

					const enteredUrl = await interaction.prompt({
						type: "text",
						message: `llama-swap endpoint URL for ${friendlyName}`,
						placeholder: process.env.LLAMA_SWAP_URL?.trim() || DEFAULT_LLAMA_SWAP_URL,
					});
					const serverUrl = normalizeServerUrl(
						enteredUrl.trim() || process.env.LLAMA_SWAP_URL?.trim() || DEFAULT_LLAMA_SWAP_URL,
					);

					const enteredKey = (
						await interaction.prompt({
							type: "secret",
							message: "API token (optional)",
						})
					).trim();
					const apiKey = enteredKey || DEFAULT_API_KEY;

					const catalog = await fetchCatalog(serverUrl, apiKey, interaction.signal, fetchImpl);
					const mappedModels = catalog.map((entry) => toPiModel(entry, serverUrl, friendlyName));
					const serverRecord: StoredLlamaSwapServer = {
						name: friendlyName,
						serverUrl,
						apiKey,
					};

					if (friendlyName === LLAMA_SWAP_PROVIDER_ID) {
						rootModels = mappedModels;
					} else {
						registerOrUpdateInstance(serverRecord, mappedModels);
					}

					return {
						type: "api_key",
						key: apiKey,
						env: {
							LLAMA_SWAP_NAME: friendlyName,
							LLAMA_SWAP_URL: serverUrl,
						},
					};
				},
				check: async ({ ctx, credential }) => {
					const namedTarget = credentialFriendlyName(credential);
					if (namedTarget && namedTarget !== LLAMA_SWAP_PROVIDER_ID) {
						return undefined;
					}
					const url =
						credentialServerUrl(credential) ??
						(registeredInstances.size === 0
							? tryNormalizeServerUrl(await ctx.env("LLAMA_SWAP_URL"))
							: undefined);
					return url ? { type: "api_key", source: `llama-swap (${url})` } : undefined;
				},
				resolve: async ({ ctx, credential }): Promise<AuthResult | undefined> => {
					const namedTarget = credentialFriendlyName(credential);
					if (namedTarget && namedTarget !== LLAMA_SWAP_PROVIDER_ID) {
						return undefined;
					}
					const serverUrl =
						credentialServerUrl(credential) ??
						(registeredInstances.size === 0
							? tryNormalizeServerUrl(await ctx.env("LLAMA_SWAP_URL"))
							: undefined);
					if (!serverUrl) return undefined;
					const apiKey =
						credential?.key?.trim() ||
						(await ctx.env("LLAMA_SWAP_API_KEY"))?.trim() ||
						DEFAULT_API_KEY;
					return {
						auth: { apiKey, baseUrl: inferenceBaseUrl(serverUrl) },
						env: {
							...credential?.env,
							LLAMA_SWAP_URL: serverUrl,
						},
						source: `llama-swap (${serverUrl})`,
					};
				},
			},
		},
		getModels: () => rootModels,
		refreshModels: async (context: RefreshModelsContext): Promise<void> => {
			// If a named instance was just logged in via `/login llama-swap`, migrate its auth.json entry
			// from "llama-swap" to "[friendlyName]" now that Models.login has released the auth.json lock.
			const cred = context.credential?.type === "api_key" ? context.credential : undefined;
			const targetName = credentialFriendlyName(cred);
			const targetUrl = credentialServerUrl(cred);
			if (cred && targetName && targetUrl && targetName !== LLAMA_SWAP_PROVIDER_ID) {
				const serverRecord: StoredLlamaSwapServer = {
					name: targetName,
					serverUrl: targetUrl,
					apiKey: cred.key?.trim() || DEFAULT_API_KEY,
				};
				saveInstanceToAuthJson(authPath, serverRecord);
				if (!registeredInstances.has(targetName)) {
					registerOrUpdateInstance(serverRecord);
				}
				await context.publish({
					persist: null,
					update: () => {
						rootModels = [];
					},
				});
				return;
			}

			// Fallback when the user explicitly names the server "llama-swap" or uses LLAMA_SWAP_URL without a name
			const envName = process.env.LLAMA_SWAP_NAME?.trim();
			if (envName && envName !== LLAMA_SWAP_PROVIDER_ID) {
				return;
			}
			const serverUrl =
				targetUrl ??
				(registeredInstances.size === 0 ? tryNormalizeServerUrl(process.env.LLAMA_SWAP_URL) : undefined);
			if (!serverUrl) return;

			const shouldFetch = (context.allowNetwork || rootModels.length === 0) && !process.env.PI_OFFLINE;
			if (!shouldFetch || context.signal.aborted) return;

			const apiKey = cred?.key?.trim() || process.env.LLAMA_SWAP_API_KEY?.trim() || DEFAULT_API_KEY;

			let catalog: LlamaSwapModelEntry[];
			try {
				catalog = await fetchCatalog(serverUrl, apiKey, context.signal, fetchImpl);
			} catch (error) {
				if (context.allowNetwork) throw error;
				return;
			}
			if (context.signal.aborted) return;

			const refreshed = catalog.map((entry) => toPiModel(entry, serverUrl, LLAMA_SWAP_PROVIDER_ID));
			await context.publish({
				persist: { models: refreshed, checkedAt: Date.now() },
				update: () => {
					rootModels = refreshed;
				},
			});
		},
		stream: (model, context, streamOpts) =>
			stream(model, context, {
				...(streamOpts as ProviderStreamOptions | undefined),
				...(options.fetchImpl && !streamOpts?.fetch ? { fetch: options.fetchImpl } : {}),
			}),
		streamSimple: (model, context, streamOpts) =>
			streamSimple(model, context, {
				...streamOpts,
				...(options.fetchImpl && !streamOpts?.fetch ? { fetch: options.fetchImpl } : {}),
			}),
	};

	pi.registerProvider(rootProvider);
}
