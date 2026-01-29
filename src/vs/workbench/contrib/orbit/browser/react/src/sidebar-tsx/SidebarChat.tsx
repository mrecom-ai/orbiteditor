/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { Fragment, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Services and hooks
import { useAccessor, useChatThreadsState, useChatThreadsStreamState, useSettingsState, useCommandBarState, useMCPServiceState } from '../util/services.js';

// Common imports
import { URI } from '../../../../../../../base/common/uri.js';
import { ChatMessage, StagingSelectionItem } from '../../../../common/chatThreadServiceTypes.js';
import { isFeatureNameDisabled } from '../../../../common/voidSettingsTypes.js';
import { builtinToolNames, isABuiltinToolName, resolveBuiltinToolNameLoose } from '../../../../common/prompt/prompts.js';
import { RawToolCallObj } from '../../../../common/sendLLMMessageTypes.js';
import { TextAreaFns, VoidInputBox2 } from '../util/inputs.js';
import { VOID_CTRL_L_ACTION_ID } from '../../../actionIDs.js';
import { VOID_OPEN_SETTINGS_ACTION_ID } from '../../../voidSettingsPane.js';

// External components (not extracted)
import ErrorBoundary from './ErrorBoundary.js';
import { ErrorDisplay } from './ErrorDisplay.js';
import { WarningBox } from '../void-settings-tsx/WarningBox.js';
import { PastThreadsList } from './SidebarThreadSelector.js';

// Extracted components - Icons
import { IconX } from './components/icons/IconX.js';
import { IconLoading } from './components/icons/IconLoading.js';

// Extracted components - Buttons
import { ButtonAddImage } from './components/buttons/ButtonAddImage.js';
import { ButtonOpenBrowser } from './components/buttons/ButtonOpenBrowser.js';

// Extracted components - Wrappers
import { ProseWrapper } from './components/wrappers/ProseWrapper.js';

// Extracted components - Chat
import { ScrollToBottomContainer } from './components/chat/ScrollToBottomContainer.js';
import { VoidChatArea } from './components/chat/VoidChatArea.js';

// Extracted components - Chat Components
import { ChatBubble } from './components/chatComponents/ChatBubble.js';
import { ParallelToolGroup } from './components/chatComponents/ParallelToolGroup.js';
import { CommandBarInChat } from './components/chatComponents/CommandBarInChat.js';

// Context providers
import { TodoProvider } from './contexts/TodoContext.js';

// Extracted components - Tool Results
import { StreamingTool } from './components/toolResults/StreamingTool.js';

// Extracted utilities
import { scrollToBottom } from './utils/scrollUtils.js';

// Extracted hooks
import { useStickyUserMessages } from './hooks/useStickyUserMessages.js';

// ============================================================================
// RE-EXPORTS FOR BACKWARDS COMPATIBILITY
// These allow other files to continue importing from SidebarChat.tsx
// ============================================================================

// Re-export Icons
export { IconX } from './components/icons/IconX.js';
export { IconArrowUp } from './components/icons/IconArrowUp.js';
export { IconSquare } from './components/icons/IconSquare.js';
export { IconWarning } from './components/icons/IconWarning.js';
export { IconLoading } from './components/icons/IconLoading.js';
export { CircleSpinner } from './components/icons/CircleSpinner.js';

// Re-export Buttons
export { ButtonSubmit } from './components/buttons/ButtonSubmit.js';
export { ButtonStop } from './components/buttons/ButtonStop.js';
export { ButtonAddImage } from './components/buttons/ButtonAddImage.js';
export { ButtonOpenBrowser } from './components/buttons/ButtonOpenBrowser.js';

// Re-export Wrappers
export { ProseWrapper } from './components/wrappers/ProseWrapper.js';
export { SmallProseWrapper } from './components/wrappers/SmallProseWrapper.js';

// Re-export Chat Components
export { ScrollToBottomContainer } from './components/chat/ScrollToBottomContainer.js';
export { VoidChatArea } from './components/chat/VoidChatArea.js';

// Re-export File Components
export { SelectedFiles } from './components/files/SelectedFiles.js';

// Re-export Tool Headers
export { ToolHeaderWrapper } from './components/toolHeaders/ToolHeaderWrapper.js';

// Re-export EditTool Components
export { EditToolCardWrapper } from './components/editTool/EditToolCardWrapper.js';

// Re-export Tool Wrappers
export { ToolChildrenWrapper } from './components/toolWrappers/ToolChildrenWrapper.js';
export { CodeChildren } from './components/toolWrappers/CodeChildren.js';
export { ListableToolItem } from './components/toolWrappers/ListableToolItem.js';

// Re-export Utilities
export { getRelative, getFolderName, getBasename, voidOpenFileFn } from './utils/fileUtils.js';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SidebarChat = () => {
	const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
	const textAreaFnsRef = useRef<TextAreaFns | null>(null)

	const accessor = useAccessor()
	const commandService = accessor.get('ICommandService')
	const chatThreadsService = accessor.get('IChatThreadService')

	const settingsState = useSettingsState()
	const mcpServiceState = useMCPServiceState()
	// ----- HIGHER STATE -----

	// threads state
	const chatThreadsState = useChatThreadsState()

	const currentThread = chatThreadsService.getCurrentThread()
	const previousMessages = currentThread?.messages ?? []

	const selections = currentThread.state.stagingSelections
	const setSelections = (s: StagingSelectionItem[]) => { chatThreadsService.setCurrentThreadState({ stagingSelections: s }) }

	// stream state
	const currThreadStreamState = useChatThreadsStreamState(chatThreadsState.currentThreadId)
	const isRunning = currThreadStreamState?.isRunning
	const latestError = currThreadStreamState?.error
	const { displayContentSoFar, toolCallSoFar, toolCallsSoFar, reasoningSoFar } = currThreadStreamState?.llmInfo ?? {}

	const mcpToolNameSet = useMemo(() => {
		const names = new Set<string>()
		for (const server of Object.values(mcpServiceState.mcpServerOfName)) {
			if (!server?.tools) continue
			for (const tool of server.tools) {
				if (tool?.name) names.add(tool.name)
			}
		}
		return names
	}, [mcpServiceState])

	const normalizeToolNameForPrefix = useCallback((name: string) => {
		return name.trim().replace(/[\s-]+/g, '_')
	}, [])

	const isRenderableStreamingTool = useCallback((tool: RawToolCallObj | null | undefined) => {
		if (!tool?.name) return false
		const toolName = tool.name.trim()
		if (!toolName) return false

		if (resolveBuiltinToolNameLoose(toolName, { mcpToolNames: mcpToolNameSet }) || mcpToolNameSet.has(toolName)) return true

		const normalized = normalizeToolNameForPrefix(toolName)
		const isBuiltinPrefix = normalized ? builtinToolNames.some(name => name.startsWith(normalized)) : true
		if (isBuiltinPrefix) return false

		if (mcpToolNameSet.size > 0) {
			for (const name of mcpToolNameSet) {
				if (name.startsWith(toolName)) return false
			}
		}

		// Unknown tool name: don't render while streaming to avoid flicker/phantom MCP calls.
		return false
	}, [mcpToolNameSet, normalizeToolNameForPrefix])

	const rawStreamingTools = (toolCallsSoFar && toolCallsSoFar.length > 0)
		? toolCallsSoFar
		: (toolCallSoFar && !toolCallSoFar.isDone ? [toolCallSoFar] : [])

	const streamingToolsToRender = rawStreamingTools.filter(isRenderableStreamingTool)

	// this is just if it's currently being generated, NOT if it's currently running
	const toolIsGenerating = streamingToolsToRender.some(tool => !tool.isDone) // show loading for slow tools (right now just edit)

	// Loading indicator should show when:
	// 1. isRunning is truthy (LLM, tool, idle with pending work, or awaiting_user)
	// 2. AND there's no visible content yet (no display content or reasoning tokens)
	// 3. AND no tool is currently generating visible content (edit tool streaming)
	// 4. AND we're not awaiting user action (tool approval buttons shown instead)
	const hasVisibleStreamingContent = !!(displayContentSoFar || reasoningSoFar)
	const isAwaitingUserAction = isRunning === 'awaiting_user'
	const isWaitingForAIResponse = !!isRunning && !hasVisibleStreamingContent && !toolIsGenerating && !isAwaitingUserAction

	// ----- SIDEBAR CHAT state (local) -----

	// state of current message
	const initVal = ''
	const [instructionsAreEmpty, setInstructionsAreEmpty] = useState(!initVal)

	const isDisabled = instructionsAreEmpty || !!isFeatureNameDisabled('Chat', settingsState)

	const sidebarRef = useRef<HTMLDivElement>(null)
	const scrollContainerRef = useRef<HTMLDivElement | null>(null)
	// State for images
	const [images, setImages] = useState<string[]>([])
	// State for drag and drop visual feedback
	const [isDragOver, setIsDragOver] = useState(false)

	// Helper function to process image files (used for file input, paste, and drop)
	const processImageFiles = useCallback((files: FileList | File[] | null | undefined) => {
		if (!files || files.length === 0) return

		const imagePromises: Promise<string>[] = []
		for (let i = 0; i < files.length; i++) {
			const file = files[i]
			if (!file.type.startsWith('image/')) continue

			const promise = new Promise<string>((resolve, reject) => {
				const reader = new FileReader()
				reader.onload = (event) => {
					const dataUrl = event.target?.result as string
					resolve(dataUrl)
				}
				reader.onerror = reject
				reader.readAsDataURL(file)
			})
			imagePromises.push(promise)
		}

		if (imagePromises.length > 0) {
			Promise.all(imagePromises).then((dataUrls) => {
				setImages(prev => [...prev, ...dataUrls])
			}).catch((error) => {
				console.error('Error reading image files:', error)
			})
		}
	}, [])

	const onSubmit = useCallback(async (_forceSubmit?: string, _images?: string[]) => {

		if (isDisabled && !_forceSubmit) return
		if (isRunning) return

		const threadId = chatThreadsService.state.currentThreadId

		// send message to LLM
		const userMessage = _forceSubmit || textAreaRef.current?.value || ''
		const imagesToSend = _images ?? images

		try {
			await chatThreadsService.addUserMessageAndStreamResponse({ userMessage, _images: imagesToSend.length > 0 ? imagesToSend : undefined, threadId })
		} catch (e) {
			console.error('Error while sending message in chat:', e)
		}

		setSelections([]) // clear staging
		setImages([]) // clear images
		textAreaFnsRef.current?.setValue('')
		textAreaRef.current?.focus() // focus input after submit

	}, [chatThreadsService, isDisabled, isRunning, textAreaRef, textAreaFnsRef, setSelections, settingsState, images])

	const onAbort = useCallback(async () => {
		const threadId = currentThread.id
		await chatThreadsService.abortRunning(threadId)
	}, [currentThread.id, chatThreadsService])

	// Memoize scroll callback to prevent recreating on every render
	const scrollToBottomCallback = useCallback(() => {
		scrollToBottom(scrollContainerRef)
	}, [scrollContainerRef])

	const keybindingString = accessor.get('IKeybindingService').lookupKeybinding(VOID_CTRL_L_ACTION_ID)?.getLabel()

	const threadId = currentThread.id
	const currCheckpointIdx = chatThreadsState.allThreads[threadId]?.state?.currCheckpointIdx ?? undefined  // if not exist, treat like checkpoint is last message (infinity)



	// resolve mount info
	const isResolved = chatThreadsState.allThreads[threadId]?.state.mountedInfo?.mountedIsResolvedRef.current
	useEffect(() => {
		if (isResolved) return
		chatThreadsState.allThreads[threadId]?.state.mountedInfo?._whenMountedResolver?.({
			textAreaRef: textAreaRef,
			scrollToBottom: scrollToBottomCallback,
		})

	}, [chatThreadsState, threadId, textAreaRef, scrollToBottomCallback, isResolved])

	// Compute user message indices for sticky tracking
	// Use a stable key to prevent infinite loops (memo returning new array ref -> effect fires -> set state -> re-render)
	const messageRolesString = previousMessages.map(m => m.role).join(',');
	const userMessageIndices = useMemo(() => {
		return previousMessages
			.map((msg, idx) => msg.role === 'user' ? idx : -1)
			.filter(idx => idx !== -1);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [messageRolesString]);

	const { stickyOffset, stickyMessageIndex } = useStickyUserMessages(scrollContainerRef, userMessageIndices)

	const previousMessagesHTML = useMemo(() => {
		// Simplified parallel tool grouping logic
		const PARALLEL_TOOLS = ['read_file', 'ls_dir', 'get_dir_tree', 'search_pathnames_only', 'search_for_files', 'search_in_file', 'read_lint_errors'] as const

		const isParallelTool = (msg: ChatMessage): boolean => {
			return msg.role === 'tool'
				&& msg.type !== 'invalid_params'
				&& msg.type !== 'tool_request' // Don't group pending requests
				&& isABuiltinToolName(msg.name)
				&& PARALLEL_TOOLS.includes(msg.name as any)
		}

		const groupedMessages: Array<{ type: 'single', message: ChatMessage, index: number } | { type: 'parallel', messages: Array<{ message: ChatMessage, index: number }> }> = []
		let currentParallelGroup: Array<{ message: ChatMessage, index: number }> = []

		// Helper to close current group
		const closeCurrentGroup = () => {
			if (currentParallelGroup.length > 1) {
				groupedMessages.push({ type: 'parallel', messages: [...currentParallelGroup] })
			} else if (currentParallelGroup.length === 1) {
				groupedMessages.push({ type: 'single', message: currentParallelGroup[0].message, index: currentParallelGroup[0].index })
			}
			currentParallelGroup = []
		}

		for (let i = 0; i < previousMessages.length; i++) {
			const message = previousMessages[i]

			if (isParallelTool(message)) {
				// Start or continue a parallel group
				currentParallelGroup.push({ message, index: i })

				// Peek ahead to see if we should continue the group
				const nextIndex = i + 1
				if (nextIndex < previousMessages.length) {
					const nextMsg = previousMessages[nextIndex]

					// Close group if next message is:
					// 1. Not a parallel tool
					// 2. A user message (new conversation turn)
					// 3. An assistant message (tool results complete)
					// 4. A checkpoint
					const shouldCloseGroup = !isParallelTool(nextMsg) ||
						nextMsg.role === 'user' ||
						nextMsg.role === 'assistant' ||
						nextMsg.role === 'checkpoint'

					if (shouldCloseGroup) {
						closeCurrentGroup()
					}
				} else {
					// Last message - close group
					closeCurrentGroup()
				}
			} else {
				// Non-parallel-tool message
				// First close any pending parallel group
				closeCurrentGroup()

				// Add current message as single
				groupedMessages.push({ type: 'single', message, index: i })
			}
		}

		// Handle any remaining items (safety check)
		closeCurrentGroup()

		// Render grouped messages
		return groupedMessages.map((group, groupIdx) => {
			if (group.type === 'single') {
				const i = group.index
				const previousMessage = i > 0 ? previousMessages[i - 1] : null
				const previousRole = previousMessage?.role
				const currentRole = group.message.role

				// Add extra spacing if switching between user and assistant messages
				const shouldAddGap = (previousRole === 'user' && currentRole === 'assistant') ||
					(previousRole === 'assistant' && currentRole === 'user')

				const isUserMessage = group.message.role === 'user'
				const isThisStickyMessage = isUserMessage && stickyMessageIndex === i

				return (
					<div
						key={`msg-${i}-${group.message.role}`}
						data-message-index={i}
						data-role={group.message.role}
						className={`${shouldAddGap ? 'mt-2' : ''}${isThisStickyMessage ? ' sticky' : ''}`}
						style={isThisStickyMessage ? {
							top: `${stickyOffset}px`,
							backgroundColor: 'var(--vscode-editor-background)',
							zIndex: 20,
							boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.15)',
						} : undefined}
					>
						<ChatBubble
							currCheckpointIdx={currCheckpointIdx}
							chatMessage={group.message}
							messageIdx={i}
							isCommitted={true}
							chatIsRunning={isRunning}
							threadId={threadId}
							_scrollToBottom={scrollToBottomCallback}
						/>
					</div>
				)
			} else {
				// Parallel group - render all tools with stable key
				const groupKey = `parallel-${group.messages.map(m => m.index).join('-')}`
				return (
					<div key={groupKey} className="my-0.5">
						<ParallelToolGroup
							messages={group.messages}
							previousMessages={previousMessages}
							threadId={threadId}
							currCheckpointIdx={currCheckpointIdx}
							isRunning={isRunning}
							scrollContainerRef={scrollContainerRef}
							scrollToBottomCallback={scrollToBottomCallback}
						/>
					</div>
				)
			}
		})
	}, [previousMessages, threadId, currCheckpointIdx, isRunning, scrollToBottomCallback, stickyOffset, stickyMessageIndex])

	const streamingChatIdx = previousMessagesHTML.length
	const lastMessage = previousMessages[previousMessages.length - 1]
	const shouldAddGapForStreaming = lastMessage?.role === 'user'

	const currStreamingMessageHTML = reasoningSoFar || displayContentSoFar || isRunning ?
		<div className={shouldAddGapForStreaming ? 'mt-2' : ''}>
			<ChatBubble
				key={'curr-streaming-msg'}
				currCheckpointIdx={currCheckpointIdx}
				chatMessage={{
					role: 'assistant',
					displayContent: displayContentSoFar ?? '',
					reasoning: reasoningSoFar ?? '',
					anthropicReasoning: null,
				}}
				messageIdx={streamingChatIdx}
				isCommitted={false}
				chatIsRunning={isRunning}
				threadId={threadId}
				_scrollToBottom={null}
			/>
		</div> : null


	const generatingTools = streamingToolsToRender.map((tool, i) => {
		// Create stable key based on tool name and params
		const toolKey = tool.id
			? `streaming-${tool.id}`
			: (tool.name ? `streaming-${tool.name}-${i}` : `streaming-unknown-${i}`)

		return (
			<ErrorBoundary key={toolKey}>
				<StreamingTool toolCallSoFar={tool} />
			</ErrorBoundary>
		)
	})

	const messagesHTML = <ScrollToBottomContainer
		key={'messages' + chatThreadsState.currentThreadId} // force rerender on all children if id changes
		scrollContainerRef={scrollContainerRef}
		className={`
			flex flex-col
			px-4 pb-3
			w-full flex-1 min-h-0
			overflow-x-hidden
			overflow-y-auto
			${previousMessagesHTML.length === 0 && !displayContentSoFar && generatingTools.length === 0 ? 'hidden' : ''}
		`}
	>
		{/* previous messages */}
		{previousMessagesHTML}
		{currStreamingMessageHTML}

		{/* Generating tools */}
		{generatingTools}

		{/* loading indicator - show when AI is processing but no visible content yet */}
		{isWaitingForAIResponse ? <ProseWrapper>
			{<IconLoading className='opacity-50 text-sm' />}
		</ProseWrapper> : null}


		{/* error message */}
		{latestError === undefined ? null :
			<div className='px-2 my-1'>
				<ErrorDisplay
					message={latestError.message}
					fullError={latestError.fullError}
					onDismiss={() => { chatThreadsService.dismissStreamError(currentThread.id) }}
					showDismiss={true}
				/>

				<WarningBox className='text-sm my-2 mx-4' onClick={() => { commandService.executeCommand(VOID_OPEN_SETTINGS_ACTION_ID) }} text='Open settings' />
			</div>
		}
	</ScrollToBottomContainer>


	const onChangeText = useCallback((newStr: string) => {
		setInstructionsAreEmpty(!newStr)
	}, [setInstructionsAreEmpty])
	const onKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
			onSubmit()
		} else if (e.key === 'Escape' && isRunning) {
			onAbort()
		}
	}, [onSubmit, onAbort, isRunning])

	// Handle image file selection
	const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		processImageFiles(e.target.files)
		// Reset input
		e.target.value = ''
	}, [processImageFiles])

	// Handle paste event for images
	const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
		const clipboardData = e.clipboardData
		if (!clipboardData) return

		// Check if clipboard contains files (images)
		const files = clipboardData.files
		if (files && files.length > 0) {
			// Check if any files are images
			const hasImages = Array.from(files).some(file => file.type.startsWith('image/'))
			if (hasImages) {
				e.preventDefault() // Prevent default paste behavior
				processImageFiles(files)
			}
		}
		// Allow normal text paste if no images
	}, [processImageFiles])

	// Unified drag and drop handlers for images (reusable across all elements)
	// Check if the drag contains image files
	const hasImageFiles = useCallback((e: React.DragEvent): boolean => {
		if (!e.dataTransfer.types.includes('Files')) return false
		const items = Array.from(e.dataTransfer.items)
		return items.some(item => item.type.startsWith('image/'))
	}, [])

	// Create reusable drag handlers that can be attached to any element
	const createDragHandlers = useCallback(() => {
		const handleDragEnter = (e: React.DragEvent) => {
			if (hasImageFiles(e)) {
				e.preventDefault()
				setIsDragOver(true)
				e.dataTransfer.dropEffect = 'copy'
			}
		}

		const handleDragOver = (e: React.DragEvent) => {
			if (hasImageFiles(e)) {
				e.preventDefault() // Must preventDefault on each element to allow drop
				setIsDragOver(true)
				e.dataTransfer.dropEffect = 'copy'
			}
		}

		const handleDragLeave = (e: React.DragEvent) => {
			// Check if we're actually leaving the drop zone (not just entering a child)
			const relatedTarget = e.relatedTarget as Node | null
			const currentTarget = e.currentTarget as Node | null

			if (currentTarget && (!relatedTarget || !currentTarget.contains(relatedTarget))) {
				setIsDragOver(false)
			}
		}

		const handleDrop = (e: React.DragEvent) => {
			e.preventDefault()
			setIsDragOver(false)

			const files = e.dataTransfer.files
			if (files && files.length > 0) {
				processImageFiles(files)
			}
		}

		return { handleDragEnter, handleDragOver, handleDragLeave, handleDrop }
	}, [hasImageFiles, processImageFiles])

	// Get the handlers (created once and reused)
	const dragHandlers = createDragHandlers()

	// Remove image
	const removeImage = useCallback((index: number) => {
		setImages(prev => prev.filter((_, i) => i !== index))
	}, [])

	// File input ref for image button
	const fileInputRef = useRef<HTMLInputElement | null>(null)

	const handleImageButtonClick = useCallback(() => {
		fileInputRef.current?.click()
	}, [])


	const chatAreaRef = useRef<HTMLDivElement | null>(null)

	const handleBrowserButtonClick = useCallback(() => {
		commandService.executeCommand('simpleBrowser.show', 'https://www.google.com')
	}, [commandService])

	const inputChatArea = <VoidChatArea
		featureName='Chat'
		onSubmit={() => onSubmit()}
		onAbort={onAbort}
		isStreaming={!!isRunning}
		isDisabled={isDisabled}
		showSelections={true}
		// showProspectiveSelections={previousMessagesHTML.length === 0}
		selections={selections}
		setSelections={setSelections}
		onClickAnywhere={() => { textAreaRef.current?.focus() }}
		divRef={chatAreaRef}
		imageButton={
			<>
				<input
					ref={fileInputRef}
					type='file'
					accept='image/*'
					multiple
					onChange={handleImageSelect}
					className='hidden'
				/>
				<ButtonAddImage onClick={handleImageButtonClick} />
				<ButtonOpenBrowser onClick={handleBrowserButtonClick} />
			</>
		}
		onDragEnter={dragHandlers.handleDragEnter}
		onDragOver={dragHandlers.handleDragOver}
		onDragLeave={dragHandlers.handleDragLeave}
		onDrop={dragHandlers.handleDrop}
		isDragOver={isDragOver}
	>
		<div
			className='w-full min-h-[40px]'
			onDragEnter={dragHandlers.handleDragEnter}
			onDragOver={dragHandlers.handleDragOver}
			onDragLeave={dragHandlers.handleDragLeave}
			onDrop={dragHandlers.handleDrop}
		>
			<VoidInputBox2
				enableAtToMention
				className={`min-h-[40px] px-0.5 py-0.5 !overflow-hidden resize-none placeholder:text-void-fg-4/15`}
				placeholder={`@ to mention, ${keybindingString ? `${keybindingString} to add a selection. ` : ''}Enter instructions...`}
				onChangeText={onChangeText}
				onKeyDown={onKeyDown}
				onFocus={() => { chatThreadsService.setCurrentlyFocusedMessageIdx(undefined) }}
				onPaste={handlePaste}
				onDragEnter={dragHandlers.handleDragEnter}
				onDragOver={dragHandlers.handleDragOver}
				onDragLeave={dragHandlers.handleDragLeave}
				onDrop={dragHandlers.handleDrop}
				ref={textAreaRef}
				fnsRef={textAreaFnsRef}
				multiline={true}
			/>

			{/* Image preview */}
			{images.length > 0 && (
				<div
					className='flex flex-wrap gap-1.5 mt-1'
					onDragEnter={dragHandlers.handleDragEnter}
					onDragOver={dragHandlers.handleDragOver}
					onDragLeave={dragHandlers.handleDragLeave}
					onDrop={dragHandlers.handleDrop}
				>
					{images.map((imageUrl, index) => (
						<div key={index} className='relative'>
							<img
								src={imageUrl}
								alt={`Upload ${index + 1}`}
								className='w-12 h-12 object-cover rounded border border-void-border-3 shadow-sm'
							/>
							<button
								type='button'
								onClick={() => removeImage(index)}
								className='absolute -top-1 -right-1 bg-void-bg-3 rounded-full p-0.5 hover:brightness-125 cursor-pointer shadow-sm'
							>
								<IconX size={12} className='stroke-[2]' />
							</button>
						</div>
					))}
				</div>
			)}
		</div>

	</VoidChatArea>


	const isLandingPage = previousMessages.length === 0


	const initiallySuggestedPromptsHTML = <div className='flex flex-col gap-2 w-full text-nowrap text-void-fg-3 select-none'>
		{[
			'Summarize my codebase',
			'How do types work in Rust?',
			'Create a .orbitrules file for me'
		].map((text, index) => (
			<div
				key={index}
				className='py-1 px-2 rounded text-sm bg-zinc-700/5 hover:bg-zinc-700/10 dark:bg-zinc-300/5 dark:hover:bg-zinc-300/10 cursor-pointer opacity-80 hover:opacity-100'
				onClick={() => onSubmit(text)}
			>
				{text}
			</div>
		))}
	</div>



	const threadPageInput = <div key={'input' + chatThreadsState.currentThreadId}>
		<div className='px-4'>
			<CommandBarInChat />
		</div>
		<div className='px-2 pb-2'>
			{inputChatArea}
		</div>
	</div>

	const landingPageInput = <div>
		<div className='pt-8'>
			{inputChatArea}
		</div>
	</div>

	const landingPageContent = <div
		ref={sidebarRef}
		className='w-full h-full max-h-full flex flex-col overflow-auto px-4'
	>
		<ErrorBoundary>
			{landingPageInput}
		</ErrorBoundary>

		{Object.keys(chatThreadsState.allThreads).length > 1 ? // show if there are threads
			<ErrorBoundary>
				<div className='pt-8 mb-2 text-void-fg-3 text-root select-none pointer-events-none'>Previous Threads</div>
				<PastThreadsList />
			</ErrorBoundary>
			:
			<ErrorBoundary>
				<div className='pt-8 mb-2 text-void-fg-3 text-root select-none pointer-events-none'>Suggestions</div>
				{initiallySuggestedPromptsHTML}
			</ErrorBoundary>
		}
	</div>


	// const threadPageContent = <div>
	// 	{/* Thread content */}
	// 	<div className='flex flex-col overflow-hidden'>
	// 		<div className={`overflow-hidden ${previousMessages.length === 0 ? 'h-0 max-h-0 pb-2' : ''}`}>
	// 			<ErrorBoundary>
	// 				{messagesHTML}
	// 			</ErrorBoundary>
	// 		</div>
	// 		<ErrorBoundary>
	// 			{inputForm}
	// 		</ErrorBoundary>
	// 	</div>
	// </div>
	const threadPageContent = <div
		ref={sidebarRef}
		className='w-full h-full flex flex-col overflow-hidden'
	>
		<ErrorBoundary>
			{messagesHTML}
		</ErrorBoundary>
		<ErrorBoundary>
			{threadPageInput}
		</ErrorBoundary>
	</div>


	return (
		<TodoProvider threadId={threadId}>
			<Fragment key={threadId} // force rerender when change thread
			>
				{isLandingPage ?
					landingPageContent
					: threadPageContent}
			</Fragment>
		</TodoProvider>
	)
}
