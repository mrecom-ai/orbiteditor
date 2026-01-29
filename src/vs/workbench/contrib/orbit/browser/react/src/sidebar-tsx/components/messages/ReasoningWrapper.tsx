/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useRef, useState } from 'react';

interface ReasoningWrapperProps {
	isDoneReasoning: boolean;
	isStreaming: boolean;
	children: React.ReactNode;
}

export const ReasoningWrapper = ({
	isDoneReasoning,
	isStreaming,
	children
}: ReasoningWrapperProps) => {
	const isDone = isDoneReasoning || !isStreaming;
	const isWriting = !isDone;
	const [isOpen, setIsOpen] = useState(isWriting);
	const contentRef = useRef<HTMLDivElement | null>(null);

	// Close when reasoning is done
	useEffect(() => {
		if (!isWriting) {
			setIsOpen(false);
		}
	}, [isWriting]);

	// Auto-scroll to bottom while reasoning streams
	useEffect(() => {
		if (!isOpen) return;

		const div = contentRef.current;
		if (div) {
			// Use requestAnimationFrame for smoother scrolling
			const rafId = requestAnimationFrame(() => {
				div.scrollTop = div.scrollHeight;
			});
			return () => cancelAnimationFrame(rafId);
		}
	}, [children, isOpen]);

	const toggleOpen = () => {
		setIsOpen(prev => !prev);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleOpen();
		}
	};

	return (
		<div style={{ margin: '5px 0' }}>
			<button
				onClick={toggleOpen}
				onKeyDown={handleKeyDown}
				aria-expanded={isOpen}
				aria-controls="reasoning-content"
				type="button"
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
					background: 'none',
					border: 'none',
					padding: '4px 0',
					cursor: 'pointer',
					color: '#888',
					fontSize: '13px',
					transition: 'color 0.2s ease',
					WebkitTapHighlightColor: 'transparent'
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.color = '#aaa';
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.color = '#888';
				}}
			>
				<span
					style={{
						fontSize: '10px',
						transition: 'transform 0.2s ease',
						transform: isOpen ? 'rotate(0deg)' : 'rotate(0deg)',
						display: 'inline-block'
					}}
					aria-hidden="true"
				>
					{isOpen ? '▼' : '▶'}
				</span>
				<span style={{ fontWeight: 500 }}>Reasoning</span>
			</button>
			{isOpen && (
				<div
					id="reasoning-content"
					role="region"
					aria-label="Reasoning content"
					style={{
						marginTop: '6px',
						paddingLeft: '16px',
						color: '#999',
						fontSize: '14px',
						lineHeight: '1.4',
						maxHeight: '200px',
						overflowY: 'auto',
						scrollbarWidth: 'none',
						msOverflowStyle: 'none',
						scrollBehavior: 'smooth'
					}}
					className="no-scrollbar"
					ref={contentRef}
				>
					<style>{`
                        .no-scrollbar::-webkit-scrollbar {
                            display: none !important;
                            width: 0 !important;
                            height: 0 !important;
                            background: transparent !important;
                        }
                    `}</style>
					{children}
				</div>
			)}
		</div>
	);
};
