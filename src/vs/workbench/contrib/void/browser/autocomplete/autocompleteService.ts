/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ILanguageFeaturesService } from '../../../../../editor/common/services/languageFeatures.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { ITextModel } from '../../../../../editor/common/model.js';
import { Position } from '../../../../../editor/common/core/position.js';
import { InlineCompletion, } from '../../../../../editor/common/languages.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { isCodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { EditorResourceAccessor } from '../../../../common/editor.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { extractCodeFromRegular } from '../../common/helpers/extractCodeFromResult.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../../common/contributions.js';
import { ILLMMessageService } from '../../common/sendLLMMessageService.js';
import { IVoidSettingsService } from '../../common/voidSettingsService.js';
import { FeatureName } from '../../common/voidSettingsTypes.js';
import { IConvertToLLMMessageService } from '../convertToLLMMessageService.js';
import { LRUCache } from './cache/lruCache.js';
import { createPrefixHash } from './cache/completionCache.js';
import { processStartAndEndSpaces, removeAllWhitespace, getPrefixAndSuffixInfo } from './utils/stringUtils.js';
import { getLanguageInfo, getImportsContext, getEnclosingContext } from './utils/languageAnalysis.js';
import { getAutocompletionMatchup } from './processing/matchup.js';
import { toInlineCompletions } from './processing/postprocessing.js';
import { getCompletionOptions } from './processing/completionOptions.js';
import { _ln, DEBOUNCE_TIME, DEBOUNCE_TIME_FAST, TIMEOUT_TIME, MAX_CACHE_SIZE, MAX_PENDING_REQUESTS } from './constants.js';
import type { Autocompletion } from './types.js';

export interface IAutocompleteService {
	readonly _serviceBrand: undefined;
}

export const IAutocompleteService = createDecorator<IAutocompleteService>('AutocompleteService');

export class AutocompleteService extends Disposable implements IAutocompleteService {

	static readonly ID = 'void.autocompleteService'

	_serviceBrand: undefined;

	private _autocompletionId: number = 0;
	private _autocompletionsOfDocument: { [docUriStr: string]: LRUCache<number, Autocompletion> } = {}
	// Hash index for faster cache lookups: normalized prefix -> autocompletion IDs
	private _prefixHashIndex: { [docUriStr: string]: Map<string, number[]> } = {}

	private _lastCompletionStart = 0
	private _lastCompletionAccept = 0
	private _prefetchingActive = false // Track if we're currently prefetching
	// private _lastPrefix: string = ''

	// used internally by vscode
	// fires after every keystroke and returns the completion to show
	async _provideInlineCompletionItems(
		model: ITextModel,
		position: Position,
	): Promise<InlineCompletion[]> {

		const isEnabled = this._settingsService.state.globalSettings.enableAutocomplete
		if (!isEnabled) return []

		const testMode = false

		const docUriStr = model.uri.fsPath;

		const prefixAndSuffix = getPrefixAndSuffixInfo(model, position)
		const { prefix, suffix } = prefixAndSuffix

		// initialize cache if it doesnt exist
		// note that whenever an autocompletion is accepted, it is removed from cache
		if (!this._autocompletionsOfDocument[docUriStr]) {
			this._autocompletionsOfDocument[docUriStr] = new LRUCache<number, Autocompletion>(
				MAX_CACHE_SIZE,
				(autocompletion: Autocompletion) => {
					if (autocompletion.requestId)
						this._llmMessageService.abort(autocompletion.requestId)
					// Remove from hash index when disposing
					this._removeFromHashIndex(docUriStr, autocompletion);
				}
			)
			this._prefixHashIndex[docUriStr] = new Map();
		}
		// this._lastPrefix = prefix

		// print all pending autocompletions
		// let _numPending = 0
		// this._autocompletionsOfDocument[docUriStr].items.forEach((a: Autocompletion) => { if (a.status === 'pending') _numPending += 1 })
		// console.log('@numPending: ' + _numPending)

		// get autocompletion from cache (optimized with hash index)
		let cachedAutocompletion: Autocompletion | undefined = undefined
		let autocompletionMatchup: ReturnType<typeof getAutocompletionMatchup> | undefined = undefined

		// Fast-path 1: check for exact prefix match first (common case when user continues typing)
		for (const autocompletion of this._autocompletionsOfDocument[docUriStr].items.values()) {
			if (autocompletion.prefix === prefix) {
				cachedAutocompletion = autocompletion;
				autocompletionMatchup = { startIdx: 0, startLine: 0, startCharacter: 0 };
				break;
			}
		}

		// Fast-path 2: use hash index for likely matches
		if (!cachedAutocompletion) {
			const prefixHash = createPrefixHash(prefix);
			const candidateIds = this._prefixHashIndex[docUriStr]?.get(prefixHash) || [];

			// Check only candidate autocompletions from hash index
			for (const id of candidateIds) {
				const autocompletion = this._autocompletionsOfDocument[docUriStr].items.get(id);
				if (autocompletion) {
					autocompletionMatchup = getAutocompletionMatchup({ prefix, autocompletion })
					if (autocompletionMatchup !== undefined) {
						cachedAutocompletion = autocompletion
						break;
					}
				}
			}
		}

		// Fallback: if hash index didn't help, do full search (shouldn't happen often)
		if (!cachedAutocompletion) {
			for (const autocompletion of this._autocompletionsOfDocument[docUriStr].items.values()) {
				// if the user's change matches with the autocompletion
				autocompletionMatchup = getAutocompletionMatchup({ prefix, autocompletion })
				if (autocompletionMatchup !== undefined) {
					cachedAutocompletion = autocompletion
					break;
				}
			}
		}

		// if there is a cached autocompletion, return it
		if (cachedAutocompletion && autocompletionMatchup) {

			console.log('AA')


			// console.log('id: ' + cachedAutocompletion.id)

			if (cachedAutocompletion.status === 'finished') {
				console.log('A1')

				const inlineCompletions = toInlineCompletions({ autocompletionMatchup, autocompletion: cachedAutocompletion, prefixAndSuffix, position, debug: true })
				return inlineCompletions

			} else if (cachedAutocompletion.status === 'pending') {
				console.log('A2')

				try {
					await cachedAutocompletion.llmPromise;
					const inlineCompletions = toInlineCompletions({ autocompletionMatchup, autocompletion: cachedAutocompletion, prefixAndSuffix, position })
					return inlineCompletions

				} catch (e) {
					this._autocompletionsOfDocument[docUriStr].delete(cachedAutocompletion.id)
					console.error('Error creating autocompletion (1): ' + e)
				}

			} else if (cachedAutocompletion.status === 'error') {
				console.log('A3')
			} else {
				console.log('A4')
			}

			return []
		}

		// else if no more typing happens, then go forwards with the request

		// Adaptive debounce: use shorter time if cache hit is likely
		const prefixHash = createPrefixHash(prefix);
		const hasPotentialCacheHit = (this._prefixHashIndex[docUriStr]?.get(prefixHash)?.length || 0) > 0;
		const debounceTime = hasPotentialCacheHit ? DEBOUNCE_TIME_FAST : DEBOUNCE_TIME;

		// wait for the user to stop typing
		const thisTime = Date.now()

		const justAcceptedAutocompletion = thisTime - this._lastCompletionAccept < 500

		this._lastCompletionStart = thisTime
		const didTypingHappenDuringDebounce = await new Promise((resolve, reject) =>
			setTimeout(() => {
				if (this._lastCompletionStart === thisTime) {
					resolve(false)
				} else {
					resolve(true)
				}
			}, debounceTime)
		)

		// if more typing happened, then do not go forwards with the request
		if (didTypingHappenDuringDebounce) {
			return []
		}


		// if there are too many pending requests, cancel the oldest one
		let numPending = 0
		let oldestPending: Autocompletion | undefined = undefined
		for (const autocompletion of this._autocompletionsOfDocument[docUriStr].items.values()) {
			if (autocompletion.status === 'pending') {
				numPending += 1
				if (oldestPending === undefined) {
					oldestPending = autocompletion
				}
				if (numPending >= MAX_PENDING_REQUESTS) {
					// cancel the oldest pending request and remove it from cache
					this._autocompletionsOfDocument[docUriStr].delete(oldestPending.id)
					break
				}
			}
		}


		// gather relevant context from the code around the user's selection and definitions
		// const relevantSnippetsList = await this._contextGatheringService.readCachedSnippets(model, position, 3);
		// const relevantSnippetsList = this._contextGatheringService.getCachedSnippets();
		// const relevantSnippets = relevantSnippetsList.map((text) => `${text}`).join('\n-------------------------------\n')
		// console.log('@@---------------------\n' + relevantSnippets)
		const relevantContext = ''

		const cursorOffset = model.getOffsetAt(position);

		const { shouldGenerate, predictionType, llmPrefix, llmSuffix, stopTokens } = getCompletionOptions(prefixAndSuffix, relevantContext, justAcceptedAutocompletion, model, cursorOffset)

		if (!shouldGenerate) return []

		if (testMode && this._autocompletionId !== 0) { // TODO remove this
			return []
		}



		// create a new autocompletion and add it to cache
		const newAutocompletion: Autocompletion = {
			id: this._autocompletionId++,
			prefix: prefix, // the actual prefix and suffix
			suffix: suffix,
			llmPrefix: llmPrefix, // the prefix and suffix the llm sees
			llmSuffix: llmSuffix,
			startTime: Date.now(),
			endTime: undefined,
			type: predictionType,
			status: 'pending',
			llmPromise: undefined,
			insertText: '',
			requestId: null,
			_newlineCount: 0,
		}

		console.log('starting autocomplete...', predictionType)

		const featureName: FeatureName = 'Autocomplete'
		const overridesOfModel = this._settingsService.state.overridesOfModel
		const modelSelection = this._settingsService.state.modelSelectionOfFeature[featureName]
		const modelSelectionOptions = modelSelection ? this._settingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName] : undefined

		// Model-specific optimization: check if model supports FIM
		// If not, log a warning (FIM-capable models like Codestral work much better for autocomplete)
		if (modelSelection) {
			const { getModelCapabilities } = await import('../../common/modelCapabilities.js');
			const capabilities = getModelCapabilities(modelSelection.providerName, modelSelection.modelName, overridesOfModel);
			if (!capabilities.supportsFIM && !testMode) {
				console.warn(`Autocomplete: Model ${modelSelection.modelName} does not support FIM (Fill-In-Middle). Consider using a FIM-capable model like Codestral for better autocomplete performance.`);
			}
		}

		// Gather rich context metadata for better accuracy (following Copilot/Cursor best practices)
		const { languageId, fileName } = getLanguageInfo(model);
		const fullText = model.getValue();
		const importsContext = getImportsContext(fullText, languageId);
		const enclosingContext = getEnclosingContext(fullText, cursorOffset, languageId);

		// set parameters of `newAutocompletion` appropriately
		newAutocompletion.llmPromise = new Promise((resolve, reject) => {

			const requestId = this._llmMessageService.sendLLMMessage({
				messagesType: 'FIMMessage',
				messages: this._convertToLLMMessageService.prepareFIMMessage({
					messages: {
						prefix: llmPrefix,
						suffix: llmSuffix,
						stopTokens: stopTokens,
					},
					metadata: {
						fileName,
						languageId,
						enclosingContext,
						importsContext,
					}
				}),
				modelSelection,
				modelSelectionOptions,
				overridesOfModel,
				logging: { loggingName: 'Autocomplete' },
				onText: async ({ fullText }) => {
					// Streaming enabled: show partial completions as they arrive

					// Skip if only whitespace so far
					if (!fullText.trim()) return;

					// Critical: Filter out model explanations and instructions immediately
					const lowerText = fullText.toLowerCase();
					const badPhrases = [
						'here is', 'here\'s', 'the code', 'complete', 'this code',
						'i can help', 'to complete', 'fill in', '<fill', 'explanation',
						'this will', 'this should', 'the above'
					];

					// If model starts explaining instead of coding, reject immediately
					if (badPhrases.some(phrase => lowerText.trim().startsWith(phrase))) {
						reject('Model provided explanation instead of code')
						return;
					}

					const previousLen = newAutocompletion.insertText.length;
					newAutocompletion.insertText = fullText;
					const newText = fullText.substring(previousLen);

					// count newlines in newText
					const numNewlines = newText.match(/\n|\r\n/g)?.length || 0
					newAutocompletion._newlineCount += numNewlines

					// if too many newlines, resolve up to last newline
					if (newAutocompletion._newlineCount > 10) {
						const lastNewlinePos = fullText.lastIndexOf('\n')
						newAutocompletion.insertText = fullText.substring(0, lastNewlinePos)
						resolve(newAutocompletion.insertText)
						return
					}

					// For single-line completions, stop at first newline
					if (predictionType === 'single-line-fill-middle' || predictionType === 'single-line-redo-suffix') {
						const firstNewlinePos = fullText.indexOf(_ln);
						if (firstNewlinePos > -1) {
							newAutocompletion.insertText = fullText.substring(0, firstNewlinePos);
						}
					}
				},
				onFinalMessage: ({ fullText }) => {

					// console.log('____res: ', JSON.stringify(newAutocompletion.insertText))

					newAutocompletion.endTime = Date.now()
					newAutocompletion.status = 'finished'
					const [text, _] = extractCodeFromRegular({ text: fullText, recentlyAddedTextLen: 0 })
					newAutocompletion.insertText = processStartAndEndSpaces(text)

					// handle special case for predicting starting on the next line, add a newline character
					if (newAutocompletion.type === 'multi-line-start-on-next-line') {
						newAutocompletion.insertText = _ln + newAutocompletion.insertText
					}

					resolve(newAutocompletion.insertText)

				},
				onError: ({ message }) => {
					newAutocompletion.endTime = Date.now()
					newAutocompletion.status = 'error'
					reject(message)
				},
				onAbort: () => { reject('Aborted autocomplete') },
			})
			newAutocompletion.requestId = requestId

			// if the request hasnt resolved in TIMEOUT_TIME seconds, reject it
			setTimeout(() => {
				if (newAutocompletion.status === 'pending') {
					reject('Timeout receiving message to LLM.')
				}
			}, TIMEOUT_TIME)

		})



		// add autocompletion to cache and hash index
		this._autocompletionsOfDocument[docUriStr].set(newAutocompletion.id, newAutocompletion)
		this._addToHashIndex(docUriStr, newAutocompletion)

		// show autocompletion
		try {
			await newAutocompletion.llmPromise
			// console.log('id: ' + newAutocompletion.id)

			const autocompletionMatchup = { startIdx: 0, startLine: 0, startCharacter: 0 }
			const inlineCompletions = toInlineCompletions({ autocompletionMatchup, autocompletion: newAutocompletion, prefixAndSuffix, position })
			return inlineCompletions

		} catch (e) {
			this._autocompletionsOfDocument[docUriStr].delete(newAutocompletion.id)
			console.error('Error creating autocompletion (2): ' + e)
			return []
		}

	}

	constructor(
		@ILanguageFeaturesService private _langFeatureService: ILanguageFeaturesService,
		@ILLMMessageService private readonly _llmMessageService: ILLMMessageService,
		@IEditorService private readonly _editorService: IEditorService,
		@IModelService private readonly _modelService: IModelService,
		@IVoidSettingsService private readonly _settingsService: IVoidSettingsService,
		@IConvertToLLMMessageService private readonly _convertToLLMMessageService: IConvertToLLMMessageService
		// @IContextGatheringService private readonly _contextGatheringService: IContextGatheringService,
	) {
		super()

		this._register(this._langFeatureService.inlineCompletionsProvider.register('*', {
			provideInlineCompletions: async (model, position, context, token) => {
				const items = await this._provideInlineCompletionItems(model, position)

				// console.log('item: ', items?.[0]?.insertText)
				return { items: items, }
			},
			freeInlineCompletions: (completions) => {
				// get the `docUriStr` and the `position` of the cursor
				const activePane = this._editorService.activeEditorPane;
				if (!activePane) return;
				const control = activePane.getControl();
				if (!control || !isCodeEditor(control)) return;
				const position = control.getPosition();
				if (!position) return;
				const resource = EditorResourceAccessor.getCanonicalUri(this._editorService.activeEditor);
				if (!resource) return;
				const model = this._modelService.getModel(resource)
				if (!model) return;
				const docUriStr = resource.fsPath;
				if (!this._autocompletionsOfDocument[docUriStr]) return;

				const { prefix, } = getPrefixAndSuffixInfo(model, position)

				// go through cached items and remove matching ones
				// autocompletion.prefix + autocompletion.insertedText ~== insertedText
				this._autocompletionsOfDocument[docUriStr].items.forEach((autocompletion: Autocompletion) => {

					// we can do this more efficiently, I just didn't want to deal with all of the edge cases
					const matchup = removeAllWhitespace(prefix) === removeAllWhitespace(autocompletion.prefix + autocompletion.insertText)

					if (matchup) {
						console.log('ACCEPT', autocompletion.id)
						this._lastCompletionAccept = Date.now()
						this._removeFromHashIndex(docUriStr, autocompletion); // Remove from hash index
						this._autocompletionsOfDocument[docUriStr].delete(autocompletion.id);

						// Trigger speculative prefetch for next line (async, don't await)
						this._speculativePrefetch(model, position).catch(err => {
							console.error('Prefetch error:', err);
						});
					}
				});

			},
		}))
	}

	// Speculative prefetching: start generating next-line completion after accept
	private async _speculativePrefetch(model: ITextModel, position: Position): Promise<void> {
		if (this._prefetchingActive) return; // Don't double-prefetch

		const isEnabled = this._settingsService.state.globalSettings.enableAutocomplete
		if (!isEnabled) return;

		this._prefetchingActive = true;

		try {
			// Simulate cursor moving to end of line for next-line prediction
			const docUriStr = model.uri.fsPath;
			const prefixAndSuffix = getPrefixAndSuffixInfo(model, position);
			const { prefix, suffix } = prefixAndSuffix;

			// Add newline to simulate next line
			const prefixWithNewline = prefix + _ln;
			const relevantContext = '';
			const cursorOffset = model.getOffsetAt(position);

			const { shouldGenerate, llmPrefix, llmSuffix, stopTokens, predictionType } = getCompletionOptions(
				{ ...prefixAndSuffix, prefix: prefixWithNewline },
				relevantContext,
				true, // justAcceptedAutocompletion = true
				model,
				cursorOffset
			);

			if (!shouldGenerate) {
				this._prefetchingActive = false;
				return;
			}

			// Create prefetch autocompletion
			const prefetchAutocompletion: Autocompletion = {
				id: this._autocompletionId++,
				prefix: prefixWithNewline,
				suffix: suffix,
				llmPrefix: llmPrefix,
				llmSuffix: llmSuffix,
				startTime: Date.now(),
				endTime: undefined,
				type: predictionType,
				status: 'pending',
				llmPromise: undefined,
				insertText: '',
				requestId: null,
				_newlineCount: 0,
			};

			const featureName: FeatureName = 'Autocomplete'
			const overridesOfModel = this._settingsService.state.overridesOfModel
			const modelSelection = this._settingsService.state.modelSelectionOfFeature[featureName]
			const modelSelectionOptions = modelSelection ? this._settingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName] : undefined

			// Gather context for prefetch too
			const { languageId: prefetchLangId, fileName: prefetchFileName } = getLanguageInfo(model);
			const prefetchFullText = model.getValue();
			const prefetchImportsContext = getImportsContext(prefetchFullText, prefetchLangId);
			const prefetchEnclosingContext = getEnclosingContext(prefetchFullText, cursorOffset, prefetchLangId);

			// Start prefetch (fire and forget)
			prefetchAutocompletion.llmPromise = new Promise((resolve, reject) => {
				const requestId = this._llmMessageService.sendLLMMessage({
					messagesType: 'FIMMessage',
					messages: this._convertToLLMMessageService.prepareFIMMessage({
						messages: {
							prefix: llmPrefix,
							suffix: llmSuffix,
							stopTokens: stopTokens,
						},
						metadata: {
							fileName: prefetchFileName,
							languageId: prefetchLangId,
							enclosingContext: prefetchEnclosingContext,
							importsContext: prefetchImportsContext,
						}
					}),
					modelSelection,
					modelSelectionOptions,
					overridesOfModel,
					logging: { loggingName: 'Autocomplete-Prefetch' },
					onText: () => { }, // Don't show prefetch results until requested
					onFinalMessage: ({ fullText }) => {
						prefetchAutocompletion.endTime = Date.now()
						prefetchAutocompletion.status = 'finished'
						const [text, _] = extractCodeFromRegular({ text: fullText, recentlyAddedTextLen: 0 })
						prefetchAutocompletion.insertText = processStartAndEndSpaces(text)

						if (prefetchAutocompletion.type === 'multi-line-start-on-next-line') {
							prefetchAutocompletion.insertText = _ln + prefetchAutocompletion.insertText
						}

						resolve(prefetchAutocompletion.insertText)
					},
					onError: ({ message }) => {
						prefetchAutocompletion.endTime = Date.now()
						prefetchAutocompletion.status = 'error'
						reject(message)
					},
					onAbort: () => { reject('Aborted prefetch') },
				});
				prefetchAutocompletion.requestId = requestId;
			});

			// Add to cache for future use
			if (!this._autocompletionsOfDocument[docUriStr]) {
				this._autocompletionsOfDocument[docUriStr] = new LRUCache<number, Autocompletion>(
					MAX_CACHE_SIZE,
					(autocompletion: Autocompletion) => {
						if (autocompletion.requestId)
							this._llmMessageService.abort(autocompletion.requestId)
						this._removeFromHashIndex(docUriStr, autocompletion);
					}
				);
				this._prefixHashIndex[docUriStr] = new Map();
			}

			this._autocompletionsOfDocument[docUriStr].set(prefetchAutocompletion.id, prefetchAutocompletion);
			this._addToHashIndex(docUriStr, prefetchAutocompletion);

			// Wait for completion (don't block caller)
			await prefetchAutocompletion.llmPromise;

		} catch (err) {
			console.error('Prefetch failed:', err);
		} finally {
			this._prefetchingActive = false;
		}
	}

	// Helper methods for hash index management
	private _addToHashIndex(docUriStr: string, autocompletion: Autocompletion): void {
		if (!this._prefixHashIndex[docUriStr]) {
			this._prefixHashIndex[docUriStr] = new Map();
		}

		const hash = createPrefixHash(autocompletion.prefix);
		const existing = this._prefixHashIndex[docUriStr].get(hash) || [];
		existing.push(autocompletion.id);
		this._prefixHashIndex[docUriStr].set(hash, existing);
	}

	private _removeFromHashIndex(docUriStr: string, autocompletion: Autocompletion): void {
		if (!this._prefixHashIndex[docUriStr]) return;

		const hash = createPrefixHash(autocompletion.prefix);
		const existing = this._prefixHashIndex[docUriStr].get(hash);
		if (existing) {
			const filtered = existing.filter(id => id !== autocompletion.id);
			if (filtered.length > 0) {
				this._prefixHashIndex[docUriStr].set(hash, filtered);
			} else {
				this._prefixHashIndex[docUriStr].delete(hash);
			}
		}
	}

}

registerWorkbenchContribution2(AutocompleteService.ID, AutocompleteService, WorkbenchPhase.BlockRestore);
