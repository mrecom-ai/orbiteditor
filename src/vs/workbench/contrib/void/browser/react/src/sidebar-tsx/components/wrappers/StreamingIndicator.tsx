/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { TextShimmer } from '../../../util/TextShimmer.js';

export const StreamingIndicator = ({ verb }: { verb: string }) => {
	return (
		<TextShimmer
			duration={2.5}
			spread={2}
		>
			{verb}
		</TextShimmer>
	);
};
