/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { removeAnsiEscapeCodes } from '../../../../base/common/strings.js';
import { ITerminalCapabilityImplMap, TerminalCapability } from '../../../../platform/terminal/common/capabilities/capabilities.js';
import { URI } from '../../../../base/common/uri.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ITerminalService, ITerminalInstance, ICreateTerminalOptions } from '../../terminal/browser/terminal.js';
import { MAX_TERMINAL_CHARS } from '../common/prompt/prompts.js';
import { timeout } from '../../../../base/common/async.js';

export type ShellRunResult = {
	kind: 'done' | 'timeout' | 'backgrounded';
	result?: string;
	exitCode?: number;
	shellId: string;
	durationMs?: number;
	elapsedMs?: number;
	pid?: number;
};

export type AwaitShellResult = {
	kind: 'done' | 'timeout' | 'notfound';
	result?: string;
	exitCode?: number;
	runningForMs: number;
	matchedPattern?: boolean;
	error?: string;
};

type NotifyWatcher = {
	pattern: RegExp;
	debounceMs: number;
	reason: string;
	onMatch: (matchedText: string) => void;
	lastFiredAt: number;
	timer: ReturnType<typeof setTimeout> | null;
	lastMatchedText: string;
};

export type ShellInstance = {
	id: string;
	terminal: ITerminalInstance;
	workingDirectory: string | null;
	threadId: string | null;
	createdAt: number;
	lastCommand: string | null;
	lastExitCode: number | null;
	pid: number | null;
	commandInFlight: boolean;
	notifyWatchers: NotifyWatcher[];
	commandFinishedDisposable: IDisposable | null;
	outputBuffer: string;
	onDataDisposable: IDisposable | null;
	/** Resolves an in-flight runShell/awaitShell wait without interrupting the shell. */
	waitRelease?: () => void;
};

export interface ITerminalToolService {
	readonly _serviceBrand: undefined;

	createShell(opts: { shellId: string; workingDirectory: string | null; threadId?: string | null }): Promise<{ shellId: string; pid: number | null }>;
	getOrCreateShellForThread(opts: { threadId: string; proposedShellId: string; workingDirectory: string | null }): Promise<{ shellId: string; pid: number | null; created: boolean }>;
	killShell(shellId: string): Promise<void>;
	killShellsForThread(threadId: string): Promise<void>;
	interruptShell(shellId: string): void;
	listShellIds(): string[];
	shellExists(shellId: string): boolean;
	getShell(shellId: string): ShellInstance | undefined;

	runShell(
		shellId: string,
		command: string,
		opts: { blockUntilMs: number; workingDirectory?: string | null }
	): Promise<ShellRunResult>;

	awaitShell(
		shellId: string | null,
		opts: { blockUntilMs: number; pattern: string | null }
	): Promise<AwaitShellResult>;

	readShell(shellId: string): Promise<string>;
	focusShell(shellId: string): Promise<void>;
	/** Release a blocking runShell/awaitShell wait early (command keeps running). */
	releaseShellWait(shellId: string | null | undefined): void;

	addNotifyWatcher(shellId: string, w: { pattern: string; debounceMs: number; reason: string; onMatch: (m: string) => void }): IDisposable;
}

export const ITerminalToolService = createDecorator<ITerminalToolService>('TerminalToolService');

const shellDisplayName = (id: string) => `Orbit Shell (${id.slice(0, 8)})`;

export class TerminalToolService extends Disposable implements ITerminalToolService {
	readonly _serviceBrand: undefined;

	private shellInstanceOfId: Record<string, ShellInstance> = {};
	private defaultShellIdByThread: Record<string, string> = {};
	private _sleepWaitRelease: (() => void) | undefined;

	constructor(
		@ITerminalService private readonly terminalService: ITerminalService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		super();
	}

	listShellIds(): string[] {
		return Object.keys(this.shellInstanceOfId);
	}

	shellExists(shellId: string): boolean {
		return shellId in this.shellInstanceOfId;
	}

	getShell(shellId: string): ShellInstance | undefined {
		return this.shellInstanceOfId[shellId];
	}

	private _listShellsForThread(threadId: string): ShellInstance[] {
		return Object.values(this.shellInstanceOfId).filter(shell => shell.threadId === threadId);
	}

	private _refreshShellPid(shell: ShellInstance): void {
		shell.pid = shell.terminal.processId ?? shell.pid;
	}

	async killShell(shellId: string): Promise<void> {
		const shell = this.shellInstanceOfId[shellId];
		if (!shell) return;
		this._disposeShellListeners(shell);
		shell.terminal.dispose();
		delete this.shellInstanceOfId[shellId];
		for (const [threadId, defaultId] of Object.entries(this.defaultShellIdByThread)) {
			if (defaultId === shellId) {
				delete this.defaultShellIdByThread[threadId];
			}
		}
	}

	async killShellsForThread(threadId: string): Promise<void> {
		const shellIds = this._listShellsForThread(threadId).map(shell => shell.id);
		delete this.defaultShellIdByThread[threadId];
		for (const shellId of shellIds) {
			await this.killShell(shellId);
		}
	}

	interruptShell(shellId: string): void {
		const shell = this.shellInstanceOfId[shellId];
		if (!shell) return;
		// Phase 2.13 (H16) fix: bail if no command is currently running. Sending
		// \x03 to an idle shell either is a no-op (Unix) or breaks the idle prompt
		// (Windows). When `commandInFlight` is false, there is nothing to interrupt.
		if (!shell.commandInFlight) {
			return;
		}
		// ETX (Ctrl+C). On Windows the equivalent is also \x03 (the terminal
		// emulator handles the platform difference).
		void shell.terminal.sendText('\x03', false);
	}

	releaseShellWait(shellId: string | null | undefined): void {
		if (shellId) {
			this.shellInstanceOfId[shellId]?.waitRelease?.();
			return;
		}
		this._sleepWaitRelease?.();
	}

	private _disposeShellListeners(shell: ShellInstance): void {
		shell.commandFinishedDisposable?.dispose();
		shell.commandFinishedDisposable = null;
		shell.onDataDisposable?.dispose();
		shell.onDataDisposable = null;
		for (const watcher of shell.notifyWatchers) {
			if (watcher.timer) clearTimeout(watcher.timer);
		}
		shell.notifyWatchers = [];
	}

	private async _createTerminal(props: { cwd: string | null, config: ICreateTerminalOptions['config'] }) {
		const { cwd: override_cwd, config } = props;

		const cwd: URI | string | undefined = (override_cwd ?? undefined) ?? this.workspaceContextService.getWorkspace().folders[0]?.uri;

		const options: ICreateTerminalOptions = {
			cwd,
			location: TerminalLocation.Panel,
			config: {
				name: config && 'name' in config ? config.name : undefined,
				forceShellIntegration: true,
				...config,
			},
			skipContributedProfileCheck: true,
		};

		return this.terminalService.createTerminal(options);
	}

	createShell: ITerminalToolService['createShell'] = async ({ shellId, workingDirectory, threadId }) => {
		await this.terminalService.whenConnected;
		const config = { name: shellDisplayName(shellId), title: shellDisplayName(shellId) };
		const terminal = await this._createTerminal({ cwd: workingDirectory, config });

		const shell: ShellInstance = {
			id: shellId,
			terminal,
			workingDirectory,
			threadId: threadId ?? null,
			createdAt: Date.now(),
			lastCommand: null,
			lastExitCode: null,
			pid: terminal.processId ?? null,
			commandInFlight: false,
			notifyWatchers: [],
			commandFinishedDisposable: null,
			outputBuffer: '',
			onDataDisposable: null,
		};

		this.shellInstanceOfId[shellId] = shell;
		this._ensureDataListener(shell);

		this._register(terminal.onExit(() => {
			if (shellId in this.shellInstanceOfId) {
				this._disposeShellListeners(shell);
				delete this.shellInstanceOfId[shellId];
				for (const [tid, defaultId] of Object.entries(this.defaultShellIdByThread)) {
					if (defaultId === shellId) {
						delete this.defaultShellIdByThread[tid];
					}
				}
			}
		}));

		return { shellId, pid: shell.pid };
	};

	getOrCreateShellForThread: ITerminalToolService['getOrCreateShellForThread'] = async ({ threadId, proposedShellId, workingDirectory }) => {
		const idleShell = this._listShellsForThread(threadId).find(shell => !shell.commandInFlight);
		if (idleShell) {
			this._refreshShellPid(idleShell);
			return { shellId: idleShell.id, pid: idleShell.pid, created: false };
		}

		const created = await this.createShell({ shellId: proposedShellId, workingDirectory, threadId });
		if (!this.defaultShellIdByThread[threadId]) {
			this.defaultShellIdByThread[threadId] = proposedShellId;
		}
		return { shellId: created.shellId, pid: created.pid, created: true };
	};

	focusShell: ITerminalToolService['focusShell'] = async (shellId) => {
		const shell = this.shellInstanceOfId[shellId];
		if (!shell) return;
		this.terminalService.setActiveInstance(shell.terminal);
		await this.terminalService.focusActiveInstance();
	};

	readShell: ITerminalToolService['readShell'] = async (shellId) => {
		const shell = this.shellInstanceOfId[shellId];
		if (!shell) {
			throw new Error(`Read Shell: Shell with ID ${shellId} does not exist.`);
		}

		if (!shell.terminal.xterm) {
			return this._capOutput(removeAnsiEscapeCodes(shell.outputBuffer));
		}

		const lines: string[] = [];
		for (const line of shell.terminal.xterm.getBufferReverseIterator()) {
			lines.unshift(line);
		}

		const result = removeAnsiEscapeCodes(lines.join('\n'));
		shell.outputBuffer = result;
		return this._capOutput(result);
	};

	private _capOutput(result: string): string {
		if (result.length > MAX_TERMINAL_CHARS) {
			const half = MAX_TERMINAL_CHARS / 2;
			result = result.slice(0, half) + '\n...\n' + result.slice(result.length - half);
		}
		return result;
	}

	private _ensureDataListener(shell: ShellInstance): void {
		if (shell.onDataDisposable) return;

		shell.onDataDisposable = shell.terminal.onData((chunk) => {
			shell.outputBuffer += chunk;
			if (shell.outputBuffer.length > MAX_TERMINAL_CHARS * 2) {
				shell.outputBuffer = shell.outputBuffer.slice(-MAX_TERMINAL_CHARS);
			}
			this._runNotifyWatchers(shell);
		});
	}

	private _getBufferText(shell: ShellInstance): string {
		return removeAnsiEscapeCodes(shell.outputBuffer);
	}

	private _matchPatternInBuffer(text: string, regex: RegExp): RegExpMatchArray | null {
		return text.match(regex);
	}

	private _runNotifyWatchers(shell: ShellInstance): void {
		const text = this._getBufferText(shell);
		for (const watcher of shell.notifyWatchers) {
			const match = this._matchPatternInBuffer(text, watcher.pattern);
			if (!match) continue;

			watcher.lastMatchedText = match[0];

			if (watcher.timer) {
				clearTimeout(watcher.timer);
			}

			watcher.timer = setTimeout(() => {
				watcher.timer = null;
				const now = Date.now();
				if (now - watcher.lastFiredAt < watcher.debounceMs) return;
				watcher.lastFiredAt = now;
				watcher.onMatch(watcher.lastMatchedText);
			}, watcher.debounceMs);
		}
	}

	addNotifyWatcher(shellId: string, w: { pattern: string; debounceMs: number; reason: string; onMatch: (m: string) => void }): IDisposable {
		const shell = this.shellInstanceOfId[shellId];
		if (!shell) {
			return Disposable.None;
		}

		const watcher: NotifyWatcher = {
			pattern: new RegExp(w.pattern, 'm'),
			debounceMs: w.debounceMs,
			reason: w.reason,
			onMatch: w.onMatch,
			lastFiredAt: 0,
			timer: null,
			lastMatchedText: '',
		};
		shell.notifyWatchers.push(watcher);
		this._runNotifyWatchers(shell);

		return toDisposable(() => {
			const idx = shell.notifyWatchers.indexOf(watcher);
			if (idx >= 0) {
				if (watcher.timer) clearTimeout(watcher.timer);
				shell.notifyWatchers.splice(idx, 1);
			}
		});
	}

	private async _waitForCommandDetectionCapability(terminal: ITerminalInstance) {
		const cmdCap = terminal.capabilities.get(TerminalCapability.CommandDetection);
		if (cmdCap) return cmdCap;

		const disposables: IDisposable[] = [];

		const waitTimeout = timeout(10_000);
		const waitForCapability = new Promise<ITerminalCapabilityImplMap[TerminalCapability.CommandDetection]>((res) => {
			disposables.push(
				terminal.capabilities.onDidAddCapability((e) => {
					if (e.id === TerminalCapability.CommandDetection) res(e.capability);
				})
			);
		});

		const capability = await Promise.any([waitTimeout, waitForCapability])
			.finally(() => { disposables.forEach((d) => d.dispose()); });

		return capability ?? undefined;
	}

	runShell: ITerminalToolService['runShell'] = async (shellId, command, opts) => {
		await this.terminalService.whenConnected;

		const shell = this.shellInstanceOfId[shellId];
		if (!shell) {
			throw new Error(`Shell with ID ${shellId} does not exist.`);
		}

		this._ensureDataListener(shell);
		shell.lastCommand = command;
		if (opts.workingDirectory !== undefined) {
			shell.workingDirectory = opts.workingDirectory;
		}
		shell.commandInFlight = true;
		this._refreshShellPid(shell);
		const startedAt = Date.now();

		if (opts.blockUntilMs === 0) {
			await shell.terminal.sendText(command, true);
			// Phase 1.8 (C8) fix: the previous code returned immediately without resetting
			// `commandInFlight`. If the caller of the resulting backgrounded shell
			// subsequently invoked `runShell` again on the same shell, the new call would
			// see `commandInFlight === true` and mis-classify the request.
			// We register a one-shot listener that fires when the backgrounded command
			// completes; that resets the flag. (Phase 2.13 also adds a guard in
			// `interruptShell` so an idle shell cannot be interrupted.)
			const bgShell = shell;
			const bgTerminal = bgShell.terminal;
			void (async () => {
				try {
					// Wait briefly for the terminal to register a command-detection
					// capability, then attach a one-shot listener.
					const cap = await this._waitForCommandDetectionCapability(bgTerminal);
					if (!cap) {
						// No command detection available; clear the flag heuristically
						// after a short delay. This is a fallback so we never leave
						// `commandInFlight === true` indefinitely.
						setTimeout(() => { bgShell.commandInFlight = false; }, 1000);
						return;
					}
					const dispose = cap.onCommandFinished(() => {
						bgShell.commandInFlight = false;
						dispose.dispose();
					});
				} catch {
					bgShell.commandInFlight = false;
				}
			})();
			return {
				kind: 'backgrounded',
				shellId,
				pid: shell.pid ?? undefined,
			};
		}

		const disposables: IDisposable[] = [];
		let resolveReason: 'done' | 'timeout' | 'background' | undefined;
		let exitCode = 0;
		let cmdOutput = '';

		const cmdCap = await this._waitForCommandDetectionCapability(shell.terminal);

		const waitUntilDone = new Promise<void>((resolve) => {
			if (!cmdCap) return;
			const l = cmdCap.onCommandFinished(cmd => {
				if (resolveReason) return;
				resolveReason = 'done';
				exitCode = cmd.exitCode ?? 0;
				cmdOutput = cmd.getOutput() ?? '';
				shell.lastExitCode = exitCode;
				shell.commandInFlight = false;
				l.dispose();
				resolve();
			});
			disposables.push(l);
		});

		const waitUntilTimeout = new Promise<void>((resolve) => {
			const timer = setTimeout(() => {
				if (resolveReason) return;
				resolveReason = 'timeout';
				resolve();
			}, opts.blockUntilMs);
			shell.waitRelease = () => {
				if (resolveReason) return;
				resolveReason = 'background';
				clearTimeout(timer);
				resolve();
			};
		});

		await shell.terminal.sendText(command, true);
		this.terminalService.setActiveInstance(shell.terminal);

		try {
			await Promise.race([waitUntilDone, waitUntilTimeout]);
		} finally {
			disposables.forEach(d => d.dispose());
			shell.waitRelease = undefined;
		}

		const durationMs = Date.now() - startedAt;
		const result = removeAnsiEscapeCodes(resolveReason === 'done' && cmdOutput ? cmdOutput : await this.readShell(shellId));

		if (resolveReason === 'done') {
			return { kind: 'done', result: this._capOutput(result), exitCode, shellId, durationMs };
		}

		if (resolveReason === 'background') {
			return {
				kind: 'backgrounded',
				result: this._capOutput(result),
				shellId,
				durationMs,
				pid: shell.pid ?? undefined,
			};
		}

		return {
			kind: 'timeout',
			result: this._capOutput(result),
			shellId,
			durationMs,
			elapsedMs: opts.blockUntilMs,
		};
	};

	awaitShell: ITerminalToolService['awaitShell'] = async (shellId, opts) => {
		const start = Date.now();

		// Sleep-only mode when no shell_id (matches Cursor Await contract)
		if (!shellId) {
			if (opts.blockUntilMs === 0) {
				return { kind: 'timeout', result: '', runningForMs: 0, matchedPattern: false };
			}
			await new Promise<void>((resolve) => {
				const timer = setTimeout(() => resolve(), opts.blockUntilMs);
				this._sleepWaitRelease = () => {
					clearTimeout(timer);
					resolve();
				};
			}).finally(() => {
				this._sleepWaitRelease = undefined;
			});
			return { kind: 'timeout', result: '', runningForMs: Date.now() - start, matchedPattern: false };
		}

		const shell = this.shellInstanceOfId[shellId];
		if (!shell) {
			return {
				kind: 'notfound',
				error: `Shell with id "${shellId}" does not exist.`,
				runningForMs: 0,
			};
		}

		if (opts.blockUntilMs === 0) {
			const result = await this.readShell(shellId);
			return {
				kind: 'timeout',
				result,
				runningForMs: 0,
				matchedPattern: false,
			};
		}

		let patternMatched = false;
		let exitCode: number | undefined;
		let resolveReason: 'done' | 'timeout' | 'pattern' | undefined;
		const regex = opts.pattern ? new RegExp(opts.pattern, 'm') : undefined;

		const checkBufferForPattern = (): boolean => {
			if (!regex) return false;
			const text = this._getBufferText(shell);
			const m = this._matchPatternInBuffer(text, regex);
			if (m) {
				patternMatched = true;
				return true;
			}
			return false;
		};

		if (checkBufferForPattern()) {
			const result = await this.readShell(shellId);
			return { kind: 'timeout', result, runningForMs: Date.now() - start, matchedPattern: true };
		}

		const disposables: IDisposable[] = [];

		const patternPromise = new Promise<void>((resolve) => {
			if (!regex) {
				resolve();
				return;
			}
			const onData = shell.terminal.onData(() => {
				if (checkBufferForPattern()) {
					resolveReason = 'pattern';
					onData.dispose();
					resolve();
				}
			});
			disposables.push(onData);
		});

		const cmdCap = await this._waitForCommandDetectionCapability(shell.terminal);
		const donePromise = new Promise<void>((resolve) => {
			if (!cmdCap) return;
			const l = cmdCap.onCommandFinished(cmd => {
				if (resolveReason) return;
				resolveReason = 'done';
				exitCode = cmd.exitCode ?? 0;
				shell.lastExitCode = exitCode;
				shell.commandInFlight = false;
				l.dispose();
				resolve();
			});
			disposables.push(l);
		});

		const timeoutPromise = new Promise<void>((resolve) => {
			const timer = setTimeout(() => {
				if (resolveReason) return;
				resolveReason = 'timeout';
				resolve();
			}, opts.blockUntilMs);
			shell.waitRelease = () => {
				if (resolveReason) return;
				resolveReason = 'timeout';
				clearTimeout(timer);
				resolve();
			};
		});

		try {
			await Promise.race([patternPromise, donePromise, timeoutPromise]);
		} finally {
			disposables.forEach(d => d.dispose());
			shell.waitRelease = undefined;
		}

		const runningForMs = Date.now() - start;
		const result = await this.readShell(shellId);

		if (patternMatched) {
			return { kind: 'timeout', result, runningForMs, matchedPattern: true };
		}
		if (resolveReason === 'done') {
			return { kind: 'done', result, exitCode: exitCode ?? 0, runningForMs };
		}
		return { kind: 'timeout', result, runningForMs, matchedPattern: false };
	};
}

registerSingleton(ITerminalToolService, TerminalToolService, InstantiationType.Delayed);
