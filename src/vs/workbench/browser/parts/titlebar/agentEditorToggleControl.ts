/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $ } from '../../../../base/browser/dom.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

export type AgentEditorMode = 'agents' | 'editor';

export class AgentEditorToggleControl extends Disposable {

	private readonly _onDidChangeMode = this._register(new Emitter<AgentEditorMode>());
	readonly onDidChangeMode: Event<AgentEditorMode> = this._onDidChangeMode.event;

	readonly element: HTMLElement;

	private readonly toggleButton: HTMLButtonElement;
	private readonly iconElement: HTMLElement;

	private _currentMode: AgentEditorMode;

	get currentMode(): AgentEditorMode {
		return this._currentMode;
	}

	/**
	 * Creates the Agent/Editor toggle control.
	 * @param initialMode The initial mode to start with. This should be derived from
	 *                    the current sidebar position configuration to ensure persistence.
	 */
	constructor(initialMode: AgentEditorMode = 'editor') {
		super();

		this._currentMode = initialMode;

		// Create container
		this.element = $('div.agent-editor-toggle');

		// Create single toggle button
		this.toggleButton = document.createElement('button');
		this.toggleButton.className = 'toggle-button';
		this.toggleButton.setAttribute('role', 'switch');
		this.toggleButton.setAttribute('aria-label', 'Switch between Agent and Editor mode');

		// Create icon element using codicon-arrow-swap
		this.iconElement = document.createElement('span');
		this.iconElement.className = 'toggle-icon codicon codicon-arrow-swap';

		// Append icon to button
		this.toggleButton.appendChild(this.iconElement);

		// Append button to container
		this.element.appendChild(this.toggleButton);

		// Set initial state
		this.updateActiveState();

		// Register click handler
		this._register({
			dispose: () => {
				this.toggleButton.onclick = null;
			}
		});

		this.toggleButton.onclick = () => {
			const newMode = this._currentMode === 'agents' ? 'editor' : 'agents';
			this.setMode(newMode);
		};
	}

	private updateActiveState(): void {
		const isAgentsActive = this._currentMode === 'agents';

		// Update container class
		this.element.classList.toggle('mode-agents', isAgentsActive);
		this.element.classList.toggle('mode-editor', !isAgentsActive);

		// Update button attributes
		this.toggleButton.setAttribute('aria-checked', String(isAgentsActive));
		this.toggleButton.title = isAgentsActive ? 'Switch Agent Side' : 'Switch Agent Side';

		// Update icon to show current mode
		// Using pseudo-elements for the dual arrow design
		this.iconElement.setAttribute('data-mode', this._currentMode);
	}

	setMode(mode: AgentEditorMode): void {
		if (this._currentMode !== mode) {
			this._currentMode = mode;
			this.updateActiveState();
			this._onDidChangeMode.fire(mode);
		}
	}
}
