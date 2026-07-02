/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type OrbitUpdateAction = 'install' | 'downloading' | 'openRelease';

export type VoidCheckUpdateRespose = {
	message: string;
	action?: OrbitUpdateAction;
	version?: string;
} | {
	message: null;
} | null;