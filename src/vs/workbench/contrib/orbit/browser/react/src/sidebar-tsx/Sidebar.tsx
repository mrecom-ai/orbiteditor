/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useIsDark, useThemeSettingsId, useOrbitProviderAuthState, useAccessor } from '../util/services.js';
import { VOID_OPEN_ACCOUNT_SETTINGS_ACTION_ID } from '../../../actionIDs.js';
// import { SidebarThreadSelector } from './SidebarThreadSelector.js';
// import { SidebarChat } from './SidebarChat.js';

import '../styles.css'
import { SidebarChat } from './SidebarChat.js';
import ErrorBoundary from './ErrorBoundary.js';

export const Sidebar = ({ className }: { className: string }) => {

	const isDark = useIsDark()
	const themeSettingsId = useThemeSettingsId()
	const isOrbitDarkTheme = /orbit dark/i.test(themeSettingsId)
	const orbitAuth = useOrbitProviderAuthState()
	const accessor = useAccessor()
	const commandService = accessor.get('ICommandService')
	const openAccount = () => commandService.executeCommand(VOID_OPEN_ACCOUNT_SETTINGS_ACTION_ID)

	const headerStrip = (
		<div className="flex items-center justify-between px-3 py-1.5 border-b border-void-border-3 bg-void-bg-2">
			{orbitAuth.isAuthenticated ? (
				<div className="flex items-center gap-2 min-w-0">
					{orbitAuth.avatarUrl && <img src={orbitAuth.avatarUrl} className="w-5 h-5 rounded-full flex-shrink-0" alt="" />}
					<span className="text-void-fg-2 text-xs truncate">{orbitAuth.login}</span>
				</div>
			) : (
				<span className="text-void-fg-3 text-xs">Signed out</span>
			)}
			<button
				type="button"
				className="text-xs text-void-link-color hover:underline shrink-0"
				onClick={openAccount}
			>
				{orbitAuth.isAuthenticated ? 'Manage' : 'Sign in with GitHub'}
			</button>
		</div>
	)

	return <div
		className={`@@void-scope ${isDark ? 'dark' : ''} ${isOrbitDarkTheme ? 'void-theme-orbit-dark' : ''}`}
		style={{ width: '100%', height: '100%' }}
	>
		<div
			// default background + text styles for sidebar
			className={`
				w-full h-full
				bg-[var(--void-sidebar-shell-bg)]
				text-void-fg-1
			`}
		>

			<div className={`w-full h-full flex flex-col`}>
				{headerStrip}
				<div className="flex-1 min-h-0">
				<ErrorBoundary>
					<SidebarChat />
				</ErrorBoundary>
				</div>

			</div>
		</div>
	</div>


}
