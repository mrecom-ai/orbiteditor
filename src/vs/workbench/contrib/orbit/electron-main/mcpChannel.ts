/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// registered in app.ts
// can't make a service responsible for this, because it needs
// to be connected to the main process and node dependencies

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { MCPConfigFileJSON, MCPConfigFileEntryJSON, MCPServer, RawMCPToolCall, MCPToolErrorResponse, MCPServerEventResponse, MCPToolCallParams, removeMCPToolNamePrefix, ResponseImageTypes } from '../common/mcpServiceTypes.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolResult, CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { MCPUserStateOfName } from '../common/orbitSettingsTypes.js';
import { OrbitBuiltinMcpRegistry } from './builtinMcp/orbitBuiltinMcpRegistry.js';

const getClientConfig = (serverName: string) => {
	return {
		name: `${serverName}-client`,
		version: '0.1.0',
		// debug: true,
	}
}

type MCPServerNonError = MCPServer & { status: Omit<MCPServer['status'], 'error'> }
type MCPServerError = MCPServer & { status: 'error' }



type ClientInfo = {
	_client: Client, // _client is the client that connects with an mcp client. We're calling mcp clients "server" everywhere except here for naming consistency.
	mcpServerEntryJSON: MCPConfigFileEntryJSON,
	mcpServer: MCPServerNonError,
} | {
	_client?: undefined,
	mcpServerEntryJSON: MCPConfigFileEntryJSON,
	mcpServer: MCPServerError,
}

type InfoOfClientId = {
	[clientId: string]: ClientInfo
}

export class MCPChannel implements IServerChannel {

	private readonly infoOfClientId: InfoOfClientId = {}
	private readonly _refreshingServerNames: Set<string> = new Set()
	private readonly _looseCallToolResultSchema = z.object({
		_meta: z.object({}).passthrough().optional(),
	}).passthrough()

	// mcp emitters
	private readonly mcpEmitters = {
		serverEvent: {
			onAdd: new Emitter<MCPServerEventResponse>(),
			onUpdate: new Emitter<MCPServerEventResponse>(),
			onDelete: new Emitter<MCPServerEventResponse>(),
		}
	} satisfies {
		serverEvent: {
			onAdd: Emitter<MCPServerEventResponse>,
			onUpdate: Emitter<MCPServerEventResponse>,
			onDelete: Emitter<MCPServerEventResponse>,
		}
	}

	constructor(
		private readonly builtinRegistry?: OrbitBuiltinMcpRegistry,
	) {
		// Re-emit built-in server events through the same emitters external
		// servers use, so the renderer IMCPService sees one unified event stream
		// and never has to know whether a server is built-in or external.
		if (builtinRegistry) {
			builtinRegistry.onDidChangeServer((e: MCPServerEventResponse) => {
				const name = e.response.name;
				if (e.response.newServer === undefined) {
					this.mcpEmitters.serverEvent.onDelete.fire({ response: { name, prevServer: e.response.prevServer } });
				} else if (this.infoOfClientId[name] || this._builtinServerExistedBefore(name)) {
					this.mcpEmitters.serverEvent.onUpdate.fire({ response: { name, newServer: e.response.newServer, prevServer: e.response.prevServer } });
				} else {
					this.mcpEmitters.serverEvent.onAdd.fire({ response: { name, newServer: e.response.newServer } });
				}
				this._knownBuiltinNames.add(name);
			});
		}
	}

	private readonly _knownBuiltinNames = new Set<string>();
	private _builtinServerExistedBefore(name: string): boolean {
		return this._knownBuiltinNames.has(name);
	}

	/** Mutable enabled flag for browser automation, synced from the renderer setting. */
	private _browserAutomationEnabled = true;
	private _onBrowserAutomationEnabledChange: ((enabled: boolean) => void) | undefined;

	/** Sets the callback fired when the browser automation enabled flag changes. */
	setOnBrowserAutomationEnabledChange(cb: (enabled: boolean) => void): void {
		this._onBrowserAutomationEnabledChange = cb;
	}

	/** Returns the current browser automation enabled flag. */
	getBrowserAutomationEnabled(): boolean {
		return this._browserAutomationEnabled;
	}

	/**
	 * Emits add events for every enabled built-in server. Called once after the
	 * renderer's IMCPService connects, so built-in tools appear alongside
	 * external MCP tools without requiring a config-file change.
	 */
	emitBuiltinServers(): void {
		if (!this.builtinRegistry) {
			return;
		}
		for (const { name, server } of this.builtinRegistry.listEnabledServers()) {
			this._knownBuiltinNames.add(name);
			this.mcpEmitters.serverEvent.onAdd.fire({ response: { name, newServer: server } });
		}
	}

	// browser uses this to listen for changes
	listen(_: unknown, event: string): Event<any> {

		// server events
		if (event === 'onAdd_server') return this.mcpEmitters.serverEvent.onAdd.event;
		else if (event === 'onUpdate_server') return this.mcpEmitters.serverEvent.onUpdate.event;
		else if (event === 'onDelete_server') return this.mcpEmitters.serverEvent.onDelete.event;
		// else if (event === 'onLoading_server') return this.mcpEmitters.serverEvent.onChangeLoading.event;

		// tool call events

		// handle unknown events
		else throw new Error(`Event not found: ${event}`);
	}

	// browser uses this to call (see this.channel.call() in mcpConfigService.ts for all usages)
	async call(_: unknown, command: string, params: any): Promise<any> {
		try {
			if (command === 'refreshMCPServers') {
				await this._refreshMCPServers(params)
			}
			else if (command === 'closeAllMCPServers') {
				await this._closeAllMCPServers()
			}
			else if (command === 'toggleMCPServer') {
				await this._toggleMCPServer(params.serverName, params.isOn)
			}
		else if (command === 'callTool') {
			const p: MCPToolCallParams = params
			const response = await this._safeCallTool(p.serverName, p.toolName, p.params)
			return response
		}
		else if (command === 'emitBuiltinServers') {
			this.emitBuiltinServers()
		}
		else if (command === 'setBrowserAutomationEnabled') {
			// Mutates the enabled flag read by the orbit-ide-browser MCP server.
			// The renderer calls this whenever the Browser Automation setting
			// changes, so the built-in server's tools appear/disappear without
			// a restart (avoiding Cursor's toggle-requires-restart bug).
			this._browserAutomationEnabled = params?.enabled === true
			this._onBrowserAutomationEnabledChange?.(this._browserAutomationEnabled)
		}
		else if (command === 'getBuiltinInstructions') {
			// Returns the MCP instructions text for a built-in server, used to
			// augment the agent system prompt when browser automation is enabled.
			const serverName: string = params.serverName
			const server = this.builtinRegistry?.get(serverName)
			return server?.getInstructions() ?? ''
		}
		else {
			throw new Error(`Orbit sendLLM: command "${command}" not recognized.`)
		}
		}
		catch (e) {
			console.error('mcp channel: Call Error:', e)
		}
	}

	// server functions


	private async _refreshMCPServers(params: { mcpConfigFileJSON: MCPConfigFileJSON, userStateOfName: MCPUserStateOfName, addedServerNames: string[], removedServerNames: string[], updatedServerNames: string[] }) {

		const {
			mcpConfigFileJSON,
			userStateOfName,
			addedServerNames,
			removedServerNames,
			updatedServerNames,
		} = params

		const { mcpServers: mcpServersJSON } = mcpConfigFileJSON

		const allChanges: { type: 'added' | 'removed' | 'updated', serverName: string }[] = [
			...addedServerNames.map(n => ({ serverName: n, type: 'added' }) as const),
			...removedServerNames.map(n => ({ serverName: n, type: 'removed' }) as const),
			...updatedServerNames.map(n => ({ serverName: n, type: 'updated' }) as const),
		]

		const claimedServerNames: string[] = []

		await Promise.all(
			allChanges.map(async ({ serverName, type }) => {

				// check if already refreshing
				if (this._refreshingServerNames.has(serverName)) return
				this._refreshingServerNames.add(serverName)
				claimedServerNames.push(serverName)

				const prevServer = this.infoOfClientId[serverName]?.mcpServer;

				// close and delete the old client
				if (type === 'removed' || type === 'updated') {
					await this._closeClient(serverName)
					delete this.infoOfClientId[serverName]
					this.mcpEmitters.serverEvent.onDelete.fire({ response: { prevServer, name: serverName, } })
				}

				// create a new client
				if (type === 'added' || type === 'updated') {
					const clientInfo = await this._createClient(mcpServersJSON[serverName], serverName, userStateOfName[serverName]?.isOn)
					this.infoOfClientId[serverName] = clientInfo
					this.mcpEmitters.serverEvent.onAdd.fire({ response: { newServer: clientInfo.mcpServer, name: serverName, } })
				}
			})
		)

		claimedServerNames.forEach(serverName => {
			this._refreshingServerNames.delete(serverName)
		})

	}

	private async _createClientUnsafe(server: MCPConfigFileEntryJSON, serverName: string, isOn: boolean): Promise<ClientInfo> {

		const clientConfig = getClientConfig(serverName)
		const client = new Client(clientConfig)
		let transport: Transport;
		let info: MCPServerNonError;

		try {
			if (server.url) {
			// first try HTTP, fall back to SSE
			try {
				transport = new StreamableHTTPClientTransport(server.url);
				await client.connect(transport);
				console.log(`Connected via HTTP to ${serverName}`);
				const { tools } = await client.listTools()
				const toolsWithUniqueName = tools.map(({ name, ...rest }) => ({ name: this._addUniquePrefix(name), ...rest }))
				info = {
					status: isOn ? 'success' : 'offline',
					tools: toolsWithUniqueName,
					command: server.url.toString(),
				}
			} catch (httpErr) {
				console.warn(`HTTP failed for ${serverName}, trying SSE…`, httpErr);
				await client.close().catch(() => { });
				transport = new SSEClientTransport(server.url);
				await client.connect(transport);
				const { tools } = await client.listTools()
				const toolsWithUniqueName = tools.map(({ name, ...rest }) => ({ name: this._addUniquePrefix(name), ...rest }))
				console.log(`Connected via SSE to ${serverName}`);
				info = {
					status: isOn ? 'success' : 'offline',
					tools: toolsWithUniqueName,
					command: server.url.toString(),
				}
			}
		} else if (server.command) {
			// console.log('ENV DATA: ', server.env)
			transport = new StdioClientTransport({
				command: server.command,
				args: server.args,
				env: {
					...process.env,
					...server.env
				} as Record<string, string>,
			});

			await client.connect(transport)

			// Get the tools from the server
			const { tools } = await client.listTools()
			const toolsWithUniqueName = tools.map(({ name, ...rest }) => ({ name: this._addUniquePrefix(name), ...rest }))

			// Create a full command string for display
			const fullCommand = `${server.command} ${server.args?.join(' ') || ''}`

			// Format server object
			info = {
				status: isOn ? 'success' : 'offline',
				tools: toolsWithUniqueName,
				command: fullCommand,
			}

		} else {
			throw new Error(`No url or command for server ${serverName}`);
		}


		return { _client: client, mcpServerEntryJSON: server, mcpServer: info }
		} catch (err) {
			await client.close().catch(() => { });
			throw err;
		}
	}

	private _addUniquePrefix(base: string) {
		return `${Math.random().toString(36).slice(2, 8)}_${base}`;
	}

	private readonly _responseImageTypes: ResponseImageTypes[] = [
		'image/png',
		'image/jpeg',
		'image/gif',
		'image/webp',
		'image/svg+xml',
		'image/bmp',
		'image/tiff',
		'image/vnd.microsoft.icon',
	]

	private _isResponseImageType(value: string): value is ResponseImageTypes {
		return this._responseImageTypes.includes(value as ResponseImageTypes)
	}

	private async _createClient(serverConfig: MCPConfigFileEntryJSON, serverName: string, isOn = true): Promise<ClientInfo> {
		try {
			const c: ClientInfo = await this._createClientUnsafe(serverConfig, serverName, isOn)
			return c
		} catch (err) {
			console.error(`❌ Failed to connect to server "${serverName}":`, err)
			const fullCommand = !serverConfig.command ? '' : `${serverConfig.command} ${serverConfig.args?.join(' ') || ''}`
			const c: MCPServerError = { status: 'error', error: err + '', command: fullCommand, }
			return { mcpServerEntryJSON: serverConfig, mcpServer: c, }
		}
	}

	private async _closeAllMCPServers() {
		for (const serverName in this.infoOfClientId) {
			await this._closeClient(serverName)
			delete this.infoOfClientId[serverName]
		}
		console.log('Closed all MCP servers');
	}

	private async _closeClient(serverName: string) {
		const info = this.infoOfClientId[serverName]
		if (!info) return
		const { _client: client } = info
		if (client) {
			await client.close()
		}
		console.log(`Closed MCP server ${serverName}`);
	}


	private async _toggleMCPServer(serverName: string, isOn: boolean) {
		const entry = this.infoOfClientId[serverName]
		if (!entry) return
		const prevServer = entry.mcpServer
		// Handle turning on the server
		if (isOn) {
			// this.mcpEmitters.serverEvent.onChangeLoading.fire(getLoadingServerObject(serverName, isOn))
			const clientInfo = await this._createClientUnsafe(entry.mcpServerEntryJSON, serverName, isOn)
			this.infoOfClientId[serverName] = clientInfo
			this.mcpEmitters.serverEvent.onUpdate.fire({
				response: {
					name: serverName,
					newServer: clientInfo.mcpServer,
					prevServer: prevServer,
				}
			})
		}
		// Handle turning off the server
		else {
			// this.mcpEmitters.serverEvent.onChangeLoading.fire(getLoadingServerObject(serverName, isOn))
			await this._closeClient(serverName)
			delete this.infoOfClientId[serverName]._client

			this.mcpEmitters.serverEvent.onUpdate.fire({
				response: {
					name: serverName,
					newServer: {
						status: 'offline',
						tools: [],
						command: '',
						// Explicitly set error to undefined to reset the error state
						error: undefined,
					},
					prevServer: prevServer,
				}
			})
		}
	}

	// tool call functions

	private async _callTool(serverName: string, toolName: string, params: any): Promise<RawMCPToolCall> {
		// Built-in servers (e.g. orbit-ide-browser) are routed directly to their
		// in-process implementation — they don't have an SDK client. Checking
		// the builtin registry FIRST avoids Cursor's dual-registry "No server
		// found" bug, where tool calls only checked the config-based map.
		const builtin = this.builtinRegistry?.get(serverName);
		if (builtin) {
			if (!builtin.isEnabled()) {
				return {
					event: 'error',
					text: `Built-in MCP server "${serverName}" is disabled. Enable it in Settings > Browser Automation.`,
					toolName,
					serverName,
				};
			}
			return builtin.callTool(toolName, params);
		}

		const server = this.infoOfClientId[serverName]
		if (!server) throw new Error(`Server ${serverName} not found`)
		const { _client: client } = server
		if (!client) throw new Error(`Client for server ${serverName} not found`)

		// Call the tool with the provided parameters
		const response = await client.callTool({
			name: removeMCPToolNamePrefix(toolName),
			arguments: params
		}, this._looseCallToolResultSchema as unknown as typeof CallToolResultSchema)
		const result = response as Partial<CallToolResult> & { toolResult?: unknown }
		const { content } = result
		const contentItems = Array.isArray(content) ? content : []

		if (contentItems.length === 0) {
			if (result.toolResult !== undefined) {
				const text = typeof result.toolResult === 'string' ? result.toolResult : JSON.stringify(result.toolResult, null, 2)
				return {
					event: result.isError ? 'error' : 'text',
					text,
					toolName,
					serverName,
				}
			}
			return {
				event: 'error',
				text: `Tool call error: empty tool response for ${toolName} on server ${serverName}`,
				toolName,
				serverName,
			}
		}

		const textItem = contentItems.find(item => item?.type === 'text') as { type: 'text'; text: string } | undefined
		if (textItem) {
			if (result.isError) {
				return {
					event: 'error',
					text: textItem.text,
					toolName,
					serverName,
				}
			}
			return {
				event: 'text',
				text: textItem.text,
				toolName,
				serverName,
			}
		}

		if (result.isError) {
			return {
				event: 'error',
				text: `Tool call error: non-text error response for ${toolName} on server ${serverName}`,
				toolName,
				serverName,
			}
		}

		const imageItem = contentItems.find(item => item?.type === 'image') as { type: 'image'; data: string; mimeType: string } | undefined
		if (imageItem) {
			if (!this._isResponseImageType(imageItem.mimeType)) {
				return {
					event: 'text',
					text: `Tool returned unsupported image MIME type "${imageItem.mimeType}" for ${toolName} on server ${serverName}.`,
					toolName,
					serverName,
				}
			}
			return {
				event: 'image',
				image: { data: imageItem.data, mimeType: imageItem.mimeType },
				toolName,
				serverName,
			}
		}

		const resourceItem = contentItems.find(item => item?.type === 'resource') as { type: 'resource'; resource?: { uri?: string; mimeType?: string; text?: string; blob?: string } } | undefined
		if (resourceItem) {
			const resourceText = resourceItem.resource?.text
			const fallback = `[Resource: ${resourceItem.resource?.uri ?? 'unknown'}${resourceItem.resource?.mimeType ? ` (${resourceItem.resource?.mimeType})` : ''}]`
			return {
				event: 'text',
				text: typeof resourceText === 'string' ? resourceText : fallback,
				toolName,
				serverName,
			}
		}

		if (result.toolResult !== undefined) {
			const text = typeof result.toolResult === 'string' ? result.toolResult : JSON.stringify(result.toolResult, null, 2)
			return {
				event: result.isError ? 'error' : 'text',
				text,
				toolName,
				serverName,
			}
		}

		return {
			event: 'error',
			text: `Tool call error: unsupported response content for ${toolName} on server ${serverName}`,
			toolName,
			serverName,
		}
	}

	// tool call error wrapper
	private async _safeCallTool(serverName: string, toolName: string, params: any): Promise<RawMCPToolCall> {
		try {
			const response = await this._callTool(serverName, toolName, params)
			return response
		} catch (err) {

			let errorMessage: string;

			if (typeof err === 'object' && err !== null && (err as { code?: unknown }).code) {
				const code = (err as { code?: number }).code
				let codeDescription = ''
				if (code === -32700)
					codeDescription = 'Parse Error';
				if (code === -32600)
					codeDescription = 'Invalid Request';
				if (code === -32601)
					codeDescription = 'Method Not Found';
				if (code === -32602)
					codeDescription = 'Invalid Parameters';
				if (code === -32603)
					codeDescription = 'Internal Error';
				errorMessage = `${codeDescription}. Full response:\n${JSON.stringify(err, null, 2)}`
			}
			// Check if it's an MCP error with a code
			else if (typeof err === 'string') {
				// String error
				errorMessage = err;
			} else if (err instanceof Error) {
				errorMessage = err.message;
			} else if (typeof err === 'object' && err !== null && 'message' in err) {
				errorMessage = `${(err as { message?: unknown }).message ?? err}`;
			} else {
				// Unknown error format
				errorMessage = JSON.stringify(err, null, 2);
			}

			const fullErrorMessage = `❌ Failed to call tool "${toolName}" on server "${serverName}": ${errorMessage}`;
			const errorResponse: MCPToolErrorResponse = {
				event: 'error',
				text: fullErrorMessage,
				toolName,
				serverName,
			}
			return errorResponse
		}
	}
}
