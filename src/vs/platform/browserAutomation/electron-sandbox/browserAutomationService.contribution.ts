/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerSingleton, InstantiationType } from '../../instantiation/common/extensions.js';
import { IBrowserAutomationService } from '../common/browserAutomation.js';
import { BrowserAutomationService } from './browserAutomationService.js';

registerSingleton(IBrowserAutomationService, BrowserAutomationService, InstantiationType.Delayed);
