/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Side-effect import: registers the renderer-side `IBrowserViewService` singleton that
// proxies calls to the main process `BrowserViewMainService` over the `browserView` IPC
// channel, injecting the current window id as context.
import './browserViewService.js';
