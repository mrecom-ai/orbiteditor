/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { errorDetails } from '../../../../common/sendLLMMessageTypes.js';

const ACTION_ICON_SIZE = 14;

export const ErrorDisplay = ({
	message: message_,
	fullError,
	onDismiss,
	showDismiss,
}: {
	message: string,
	fullError: Error | null,
	onDismiss: (() => void) | null,
	showDismiss?: boolean,
}) => {
	const [isExpanded, setIsExpanded] = useState(false);

	const details = errorDetails(fullError);
	const isExpandable = !!details;
	const message = message_ + '';

	return (
		<div className="@@sidebar-chat-error" role="alert" aria-live="polite">
			<div className="flex items-start gap-2.5 p-3 min-w-0">
				<AlertCircle
					className="@@sidebar-chat-error-icon mt-px"
					size={15}
					strokeWidth={2}
					aria-hidden
				/>

				<div className="flex-1 min-w-0">
					<h3 className="@@sidebar-chat-error-title">Error</h3>
					<p className="@@sidebar-chat-error-message mt-1">{message}</p>
				</div>

				<div className="flex shrink-0 items-center gap-0.5 -mr-1 -mt-0.5">
					{isExpandable && (
						<button
							type="button"
							className="@@sidebar-chat-error-action-btn"
							onClick={() => setIsExpanded(!isExpanded)}
							aria-label={isExpanded ? 'Collapse error details' : 'Expand error details'}
							aria-expanded={isExpanded}
						>
							{isExpanded ? (
								<ChevronUp size={ACTION_ICON_SIZE} strokeWidth={2} />
							) : (
								<ChevronDown size={ACTION_ICON_SIZE} strokeWidth={2} />
							)}
						</button>
					)}
					{showDismiss && onDismiss && (
						<button
							type="button"
							className="@@sidebar-chat-error-action-btn"
							onClick={onDismiss}
							aria-label="Dismiss error"
						>
							<X size={ACTION_ICON_SIZE} strokeWidth={2} />
						</button>
					)}
				</div>
			</div>

			{isExpanded && details && (
				<div className="@@sidebar-chat-error-details px-3 py-2.5 overflow-auto max-h-48">
					<span className="@@sidebar-chat-error-title text-[10px]">Full error</span>
					<pre className="@@sidebar-chat-error-details-pre mt-1.5">{details}</pre>
				</div>
			)}
		</div>
	);
};
