/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Orbit Editor. All rights reserved.
 *  Licensed under the Apache License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { MCPServer, MCPServerEventResponse, MCPTool, RawMCPToolCall } from '../../common/mcpServiceTypes.js';

/**
 * A built-in MCP server: registered in-process (no stdio/HTTP transport),
 * implements its own tool list and tool call handler, and returns results in
 * the same `RawMCPToolCall` shape as external SDK-backed servers.
 *
 * Built-in servers are not written to `mcp.json` and are not user-configurable
 * via the MCP config file — they are controlled by dedicated settings toggles
 * (e.g. Browser Automation). This avoids Cursor's `cursor-ide-browser` confusion
 * where users added a conflicting `@anthropic/mcp-server-puppeteer` entry.
 */
export interface IOrbitBuiltinMcpServer {
	/** Stable server name (e.g. `orbit-ide-browser`). */
	readonly name: string;
	/** Whether the server is currently enabled (controls tool visibility). */
	isEnabled(): boolean;
	/** Returns the server's tool list in the MCP tool shape. */
	listTools(): MCPTool[];
	/** Returns MCP instructions text shipped to the model alongside the tools. */
	getInstructions(): string;
	/** Executes a tool call. Returns a `RawMCPToolCall` in the Orbit MCP result shape. */
	callTool(toolName: string, params: Record<string, unknown>): Promise<RawMCPToolCall>;
}

/**
 * Registry of built-in MCP servers. The `MCPChannel` consults this registry
 * when refreshing servers and when routing tool calls, so built-in and
 * external servers share one routing table (avoiding Cursor's dual-registry
 * "No server found" bug).
 */
export class OrbitBuiltinMcpRegistry extends Disposable {
	private readonly servers = new Map<string, IOrbitBuiltinMcpServer>();

	private readonly _onDidChangeServer = this._register(new Emitter<MCPServerEventResponse>());
	readonly onDidChangeServer = this._onDidChangeServer.event;

	register(server: IOrbitBuiltinMcpServer): void {
		this.servers.set(server.name, server);
		this._onDidChangeServer.fire({
			response: {
				name: server.name,
				newServer: this.toMCPServer(server),
			},
		});
	}

	unregister(name: string): void {
		const existed = this.servers.delete(name);
		if (existed) {
			this._onDidChangeServer.fire({
				response: {
					name,
					newServer: undefined,
				},
			});
		}
	}

	has(name: string): boolean {
		return this.servers.has(name);
	}

	get(name: string): IOrbitBuiltinMcpServer | undefined {
		return this.servers.get(name);
	}

	/** Returns all registered server names. */
	names(): string[] {
		return Array.from(this.servers.keys());
	}

	/** Returns the `MCPServer` view of every enabled built-in server. */
	listEnabledServers(): { name: string; server: MCPServer }[] {
		const out: { name: string; server: MCPServer }[] = [];
		for (const [name, server] of this.servers) {
			if (!server.isEnabled()) {
				continue;
			}
			out.push({ name, server: this.toMCPServer(server) });
		}
		return out;
	}

	/** Emits a refresh event for every registered server (used on MCP init). */
	emitAll(): void {
		for (const [name, server] of this.servers) {
			this._onDidChangeServer.fire({
				response: {
					name,
					newServer: server.isEnabled() ? this.toMCPServer(server) : { status: 'offline', tools: [] },
				},
			});
		}
	}

	private toMCPServer(server: IOrbitBuiltinMcpServer): MCPServer {
		if (!server.isEnabled()) {
			return { status: 'offline', tools: [] };
		}
		return {
			status: 'success',
			tools: server.listTools(),
			command: '(built-in)',
		};
	}
}
