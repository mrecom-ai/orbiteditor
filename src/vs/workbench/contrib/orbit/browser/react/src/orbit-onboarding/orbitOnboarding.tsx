/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccessor, useIsDark, useSettingsState } from '../util/services.js';
import { Brain, Check, ChevronRight, DollarSign, ExternalLink, Lock, X, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { displayInfoOfProviderName, ProviderName, providerNames, localProviderNames, featureNames, FeatureName, isFeatureNameDisabled, customSettingNamesOfProvider, subTextMdOfProviderName, isProviderNameDisabled, displayInfoOfSettingName } from '../../../../common/orbitSettingsTypes.js';
import type { VoidSettingsState } from '../../../../common/orbitSettingsService.js';
import { ChatMarkdownRender } from '../markdown/ChatMarkdownRender.js';
import { OllamaSetupInstructions, OneClickSwitchButton, SettingsForProvider, ModelDump } from '../orbit-settings-tsx/Settings.js';
import { ColorScheme } from '../../../../../../../platform/theme/common/theme.js';
import { ConfigurationTarget } from '../../../../../../../platform/configuration/common/configuration.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';
import { isLinux } from '../../../../../../../base/common/platform.js';

const OVERRIDE_VALUE = false

export const VoidOnboarding = () => {

	const voidSettingsState = useSettingsState()
	const isOnboardingComplete = voidSettingsState.globalSettings.isOnboardingComplete || OVERRIDE_VALUE

	const isDark = useIsDark()

	return (
		<div className={`@@void-scope ${isDark ? 'dark' : ''}`}>
			<div
				className={`
					bg-void-bg-3 fixed top-0 right-0 bottom-0 left-0 width-full z-[99999]
					transition-all duration-1000 ${isOnboardingComplete ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}
				`}
				style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
			>
				<ErrorBoundary>
					<VoidOnboardingContent />
				</ErrorBoundary>
			</div>
		</div>
	)
}

const VoidIcon = () => {
	const accessor = useAccessor()
	const themeService = accessor.get('IThemeService')

	const divRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		// void icon style
		const updateTheme = () => {
			const theme = themeService.getColorTheme().type
			const isDark = theme === ColorScheme.DARK || theme === ColorScheme.HIGH_CONTRAST_DARK
			if (divRef.current) {
				divRef.current.style.maxWidth = '220px'
				divRef.current.style.opacity = '50%'
				divRef.current.style.filter = isDark ? '' : 'invert(1)' //brightness(.5)
			}
		}
		updateTheme()
		const d = themeService.onDidColorThemeChange(updateTheme)
		return () => d.dispose()
	}, [])

	return <div ref={divRef} className='@@orbit-orbit-icon' />
}

const FADE_DURATION_MS = 2000

const FadeIn = ({ children, className, delayMs = 0, durationMs, ...props }: { children: React.ReactNode, delayMs?: number, durationMs?: number, className?: string } & React.HTMLAttributes<HTMLDivElement>) => {

	const [opacity, setOpacity] = useState(0)

	const effectiveDurationMs = durationMs ?? FADE_DURATION_MS

	useEffect(() => {

		const timeout = setTimeout(() => {
			setOpacity(1)
		}, delayMs)

		return () => clearTimeout(timeout)
	}, [setOpacity, delayMs])


	return (
		<div className={className} style={{ opacity, transition: `opacity ${effectiveDurationMs}ms ease-in-out` }} {...props}>
			{children}
		</div>
	)
}

// Onboarding

// =============================================
//  Theme Selection Page
// =============================================

type ThemeOption = {
	settingsId: string;
	label: string;
	description: string;
	colors: {
		editor: string;
		sidebar: string;
		accent: string;
	};
};

const DEFAULT_THEME_SETTINGS_ID = 'Default Dark+';

const themeOptions: ThemeOption[] = [
	{
		settingsId: DEFAULT_THEME_SETTINGS_ID,
		label: 'Dark+',
		description: 'Classic dark theme',
		colors: {
			editor: '#1E1E1E',
			sidebar: '#252526',
			accent: '#007ACC',
		},
	},
	{
		settingsId: 'Default Dark Modern',
		label: 'Dark Modern',
		description: 'Modern dark theme',
		colors: {
			editor: '#181818',
			sidebar: '#181818',
			accent: '#0078D4',
		},
	},
	{
		settingsId: 'Default Light Modern',
		label: 'Light Modern',
		description: 'Clean light theme',
		colors: {
			editor: '#FFFFFF',
			sidebar: '#F8F8F8',
			accent: '#005FB8',
		},
	},
];

const ThemeSelectionPage = ({ pageIndex, setPageIndex }: { pageIndex: number; setPageIndex: (index: number) => void }) => {
	const accessor = useAccessor();
	const themeService = accessor.get('IWorkbenchThemeService');
	const [selectedTheme, setSelectedTheme] = useState<string>(DEFAULT_THEME_SETTINGS_ID);

	// Sync with actual theme on mount and on theme changes
	useEffect(() => {
		const updateSelectedTheme = () => {
			const currentTheme = themeService.getColorTheme();
			const isOneOfOurThemes = themeOptions.some(t => t.settingsId === currentTheme.settingsId);
			if (isOneOfOurThemes) {
				setSelectedTheme(currentTheme.settingsId);
			} else {
				// Set default if not one of our themes
				setSelectedTheme(DEFAULT_THEME_SETTINGS_ID);
			}
		};

		updateSelectedTheme();
		const disposable = themeService.onDidColorThemeChange(() => updateSelectedTheme());
		return () => disposable.dispose();
	}, [themeService]);

	const handleThemeSelect = useCallback(async (settingsId: string) => {
		const previousSettingsId = themeService.getColorTheme().settingsId;
		setSelectedTheme(settingsId);
		try {
			const themes = await themeService.getColorThemes();
			const selected = themes.find(theme => theme.settingsId === settingsId)
				?? themes.find(theme => theme.id === settingsId);

			if (!selected) {
				setSelectedTheme(previousSettingsId);
				return;
			}

			const result = await themeService.setColorTheme(selected, ConfigurationTarget.USER);
			if (!result) {
				setSelectedTheme(previousSettingsId);
			}
		} catch (error) {
			setSelectedTheme(previousSettingsId);
		}
	}, [themeService]);

	return (
		<div className="h-[80vh] flex flex-col w-full max-w-[800px] mx-auto">
			{/* Header */}
			<div className="text-center mb-12">
				<FadeIn>
					<h1 className="text-4xl font-light text-void-fg-1 mb-3">Choose Your Theme</h1>
					<p className="text-void-fg-3 text-base">Select a look that feels right for you</p>
				</FadeIn>
			</div>

			{/* Theme Cards Grid */}
			<FadeIn delayMs={200}>
				<div className="flex flex-col sm:flex-row gap-6 justify-center items-stretch mb-12">
					{themeOptions.map((theme) => (
						<button
							key={theme.settingsId}
							type="button"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								handleThemeSelect(theme.settingsId);
							}}
							className={`void-theme-card flex-1 min-w-[160px] max-w-[220px] p-4 text-left ${
								selectedTheme === theme.settingsId ? 'selected' : ''
							}`}
							style={{ border: 'none', cursor: 'pointer' }}
							disabled={false}
						>
							{/* Theme Preview */}
							<div
								className="void-theme-preview w-full aspect-[4/3] mb-4 relative"
								style={{
									background: theme.colors.editor,
									display: 'flex',
								}}
							>
								{/* Sidebar preview */}
								<div
									style={{
										width: '30%',
										height: '100%',
										background: theme.colors.sidebar,
										borderRight: '1px solid rgba(128,128,128,0.15)',
									}}
								/>
								{/* Content area with accent line */}
								<div className="flex-1 p-3">
									<div
										style={{
											width: '60%',
											height: '4px',
											background: theme.colors.accent,
											borderRadius: '2px',
											marginBottom: '8px',
										}}
									/>
									<div
										style={{
											width: '80%',
											height: '3px',
											background: theme.colors.editor === '#FFFFFF' ? '#E5E5E5' : '#404040',
											borderRadius: '2px',
											marginBottom: '6px',
											opacity: 0.5,
										}}
									/>
									<div
										style={{
											width: '50%',
											height: '3px',
											background: theme.colors.editor === '#FFFFFF' ? '#E5E5E5' : '#404040',
											borderRadius: '2px',
											opacity: 0.3,
										}}
									/>
								</div>

								{/* Selected indicator */}
								{selectedTheme === theme.settingsId && (
									<div className="void-theme-selected-indicator">
										<Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
									</div>
								)}
							</div>

							{/* Theme Label */}
							<div className="text-center">
								<h3 className="text-void-fg-1 font-medium text-sm mb-1">{theme.label}</h3>
								<p className="text-void-fg-3 text-xs">{theme.description}</p>
							</div>
						</button>
					))}
				</div>
			</FadeIn>

			{/* Navigation */}
			<FadeIn delayMs={400}>
				<div className="flex items-center justify-center gap-4 mt-auto">
					<PreviousButton onClick={() => setPageIndex(pageIndex - 1)} />
					<NextButton onClick={() => setPageIndex(pageIndex + 1)} />
				</div>
			</FadeIn>
		</div>
	);
};

// =============================================
//  New AddProvidersPage Component and helpers
// =============================================

const tabNames = ['Free', 'Paid', 'Local'] as const;

type TabName = typeof tabNames[number] | 'Cloud/Other';

// Data for cloud providers tab
const cloudProviders: ProviderName[] = ['googleVertex', 'liteLLM', 'microsoftAzure', 'awsBedrock', 'openAICompatible'];

// Filter out openAICodex from onboarding - users can sign up after onboarding via Settings
const onboardingExcludedProviders: ProviderName[] = ['openAICodex'];

// Data structures for provider tabs
const providerNamesOfTab: Record<TabName, ProviderName[]> = {
	Free: ['gemini', 'openRouter'],
	Local: localProviderNames,
	Paid: providerNames.filter(pn => {
		const excludedProviders = ['gemini', 'openRouter', ...localProviderNames, ...cloudProviders, ...onboardingExcludedProviders] as string[];
		return !excludedProviders.includes(pn);
	}) as ProviderName[],
	'Cloud/Other': cloudProviders,
};

const descriptionOfTab: Record<TabName, string> = {
	Free: `Providers with a 100% free tier. Add as many as you'd like!`,
	Paid: `Connect directly with any provider (bring your own key).`,
	Local: `Active providers should appear automatically. Add as many as you'd like! `,
	'Cloud/Other': `Add as many as you'd like! Reach out for custom configuration requests.`,
};


const featureNameMap: { display: string, featureName: FeatureName }[] = [
	{ display: 'Chat', featureName: 'Chat' },
	{ display: 'Quick Edit', featureName: 'Ctrl+K' },
	{ display: 'Autocomplete', featureName: 'Autocomplete' },
	{ display: 'Fast Apply', featureName: 'Apply' },
	{ display: 'Source Control', featureName: 'SCM' },
];

// Progress indicator component
const SetupProgressIndicator = ({ settingsState }: { settingsState: VoidSettingsState }) => {
	const completedFeatures = featureNameMap.filter(({ featureName }) =>
		settingsState.modelSelectionOfFeature[featureName] !== null
	).length;
	const totalFeatures = featureNameMap.length;
	const progress = Math.round((completedFeatures / totalFeatures) * 100);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between text-xs">
				<span className="text-void-fg-2 font-medium">Setup Progress</span>
				<span className="text-void-fg-3">{completedFeatures}/{totalFeatures} features</span>
			</div>
			<div className="h-1.5 w-full bg-void-bg-1 rounded-full overflow-hidden">
				<div
					className="h-full bg-void-fg-1 rounded-full transition-all duration-500 ease-out"
					style={{ width: `${progress}%` }}
				/>
			</div>
		</div>
	);
};

// Feature checklist item with better styling
const FeatureChecklistItem = ({ display, featureName, settingsState }: {
	display: string;
	featureName: FeatureName;
	settingsState: VoidSettingsState;
}) => {
	const hasModel = settingsState.modelSelectionOfFeature[featureName] !== null;
	const isDisabled = isFeatureNameDisabled(featureName, settingsState);

	return (
		<div className="flex items-center gap-2.5 py-1.5">
			<div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${
				hasModel
					? 'bg-[var(--vscode-testing-iconPassed)]/20'
					: isDisabled === 'addProvider'
						? 'bg-void-bg-1'
						: 'bg-[var(--vscode-testing-iconQueued)]/20'
				}`}>
				{hasModel ? (
					<Check className="w-3 h-3 text-[var(--vscode-testing-iconPassed)]" />
				) : isDisabled === 'addProvider' ? (
					<div className="w-1.5 h-1.5 rounded-full bg-void-fg-4/50" />
				) : (
					<div className="w-1.5 h-1.5 rounded-full bg-[var(--vscode-testing-iconQueued)]" />
				)}
			</div>
			<span className={`text-sm transition-colors duration-200 ${
				hasModel ? 'text-void-fg-1' : 'text-void-fg-3'
			}`}>
				{display}
			</span>
		</div>
	);
};

const AddProvidersPage = ({ pageIndex, setPageIndex }: { pageIndex: number, setPageIndex: (index: number) => void }) => {
	const [currentTab, setCurrentTab] = useState<TabName>('Free');
	const settingsState = useSettingsState();
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Clear error message after 5 seconds
	useEffect(() => {
		let timeoutId: NodeJS.Timeout | null = null;

		if (errorMessage) {
			timeoutId = setTimeout(() => {
				setErrorMessage(null);
			}, 5000);
		}

		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [errorMessage]);

	// Count configured providers for current tab
	const configuredCount = providerNamesOfTab[currentTab].filter(pn =>
		settingsState.settingsOfProvider[pn]._didFillInProviderSettings
	).length;

	return (
		<div className="flex flex-col md:flex-row w-full h-[80vh] gap-8 max-w-[1000px] mx-auto relative">
			{/* Left Column - Sidebar */}
			<div className="md:w-[260px] w-full flex flex-col gap-6 p-6 h-full overflow-y-auto" style={{ borderRight: '1px solid var(--void-border-4)' }}>
				{/* Progress Indicator */}
				<SetupProgressIndicator settingsState={settingsState} />

				<div style={{ height: '1px', background: 'var(--void-border-4)' }} />

				{/* Tab Selector */}
				<div className="flex md:flex-col gap-1">
					{[...tabNames, 'Cloud/Other'].map(tab => (
						<button
							key={tab}
							className="py-2.5 px-3 rounded text-left text-sm flex items-center justify-between group"
							style={{
								background: currentTab === tab ? 'var(--void-bg-1)' : 'transparent',
								color: currentTab === tab ? 'var(--void-fg-1)' : 'var(--void-fg-3)',
								fontWeight: currentTab === tab ? 500 : 400,
								border: 'none',
							}}
							onMouseEnter={(e) => {
								if (currentTab !== tab) {
									e.currentTarget.style.color = 'var(--void-fg-2)';
									e.currentTarget.style.background = 'var(--void-bg-2)';
								}
							}}
							onMouseLeave={(e) => {
								if (currentTab !== tab) {
									e.currentTarget.style.color = 'var(--void-fg-3)';
									e.currentTarget.style.background = 'transparent';
								}
							}}
							onClick={() => {
								setCurrentTab(tab as TabName);
								setErrorMessage(null);
							}}
						>
							<span>{tab}</span>
							{currentTab === tab && (
								<div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--vscode-testing-iconPassed)' }} />
							)}
						</button>
					))}
				</div>

				<div style={{ height: '1px', background: 'var(--void-border-4)' }} />

				{/* Feature Checklist */}
				<div className="flex flex-col">
					<span className="text-xs font-medium text-void-fg-3 mb-2 uppercase tracking-wide">Features</span>
					{featureNameMap.map(({ display, featureName }) => (
						<FeatureChecklistItem
							key={featureName}
							display={display}
							featureName={featureName}
							settingsState={settingsState}
						/>
					))}
				</div>
			</div>

			{/* Right Column - Content */}
			<div className="flex-1 flex flex-col h-full overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--void-border-4)' }}>
					<div>
						<h1 className="text-2xl font-medium text-void-fg-1">Add a Provider</h1>
						<p className="text-sm text-void-fg-3 mt-1">{descriptionOfTab[currentTab]}</p>
					</div>
					{configuredCount > 0 && (
						<div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--vscode-testing-iconPassed)]/10 rounded-full">
							<Check className="w-3.5 h-3.5 text-[var(--vscode-testing-iconPassed)]" />
							<span className="text-xs text-[var(--vscode-testing-iconPassed)] font-medium">
								{configuredCount} configured
							</span>
						</div>
					)}
				</div>

				{/* Scrollable Content */}
				<div className="flex-1 overflow-y-auto px-8 py-6">
					<div className="max-w-xl mx-auto space-y-6">
						{providerNamesOfTab[currentTab].map((providerName) => (
							<ProviderCard
								key={providerName}
								providerName={providerName}
								settingsState={settingsState}
							/>
						))}

						{(currentTab === 'Local' || currentTab === 'Cloud/Other') && (
							<div
								className="mt-8 rounded-lg p-5"
								style={{ background: 'var(--void-bg-1)', border: '1px solid var(--void-border-2)' }}
							>
								<div className="flex items-center gap-2 mb-4">
									<div className="text-sm font-medium text-void-fg-1">Models</div>
								</div>

								{currentTab === 'Local' && (
									<p className="text-xs text-void-fg-3 mb-4">
										Local models should be detected automatically. You can add custom models below.
									</p>
								)}

								{currentTab === 'Local' && <ModelDump filteredProviders={localProviderNames} />}
								{currentTab === 'Cloud/Other' && <ModelDump filteredProviders={cloudProviders} />}
							</div>
						)}
					</div>
				</div>

				{/* Footer with Navigation */}
				<div className="px-8 py-5" style={{ borderTop: '1px solid var(--void-border-4)', background: 'var(--void-bg-2)' }}>
					<div className="flex items-center justify-between max-w-xl mx-auto">
						{errorMessage ? (
							<div className="flex items-center gap-2 text-amber-400 text-sm">
								<div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
								{errorMessage}
							</div>
						) : (
							<div className="text-xs text-void-fg-3">
								Set up at least one Chat model to continue
							</div>
						)}
						<div className="flex items-center gap-3">
							<PreviousButton onClick={() => setPageIndex(pageIndex - 1)} />
							<NextButton
								onClick={() => {
									const isDisabled = isFeatureNameDisabled('Chat', settingsState);

									if (!isDisabled) {
										setPageIndex(pageIndex + 1);
										setErrorMessage(null);
									} else {
										setErrorMessage("Please set up at least one Chat model before moving on.");
									}
								}}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
const ModelSelectionPage = ({ pageIndex, setPageIndex }: { pageIndex: number, setPageIndex: (index: number) => void }) => {
	const settingsState = useSettingsState();
	const accessor = useAccessor();
	const voidSettingsService = accessor.get('IVoidSettingsService');

	// Get all available models across all configured providers
	const allAvailableModels: { providerName: ProviderName, modelName: string }[] = [];
	for (const providerName of providerNames) {
		const providerSettings = settingsState.settingsOfProvider[providerName];
		if (providerSettings._didFillInProviderSettings) {
			for (const model of providerSettings.models) {
				allAvailableModels.push({ providerName, modelName: model.modelName });
			}
		}
	}

	const handleModelSelect = (featureName: FeatureName, providerName: ProviderName, modelName: string) => {
		voidSettingsService.setModelSelectionOfFeature(featureName, { providerName, modelName });
	};

	return (
		<div className="h-[80vh] flex flex-col w-full max-w-[800px] mx-auto overflow-hidden">
			{/* Header */}
			<div className="text-center mb-8">
				<FadeIn>
					<h1 className="text-4xl font-light text-void-fg-1 mb-3">Optimize Your Features</h1>
					<p className="text-void-fg-3 text-base">Assign the best models for each Orbit feature</p>
				</FadeIn>
			</div>

			{/* Feature Model Selection Grid */}
			<FadeIn delayMs={200} className="flex-1 overflow-y-auto px-4 pb-8">
				<div className="space-y-6">
					{featureNameMap.map(({ display, featureName }) => {
						const currentSelection = settingsState.modelSelectionOfFeature[featureName];

						return (
							<div
								key={featureName}
								className="p-6 rounded-lg bg-void-bg-1 border border-void-border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
							>
								<div className="flex-1">
									<h3 className="text-lg font-medium text-void-fg-1">{display}</h3>
									<p className="text-sm text-void-fg-3">Choose the model that powers {display.toLowerCase()}</p>
								</div>

								<div className="flex-shrink-0 min-w-[240px]">
									<select
										className="w-full bg-void-bg-3 border border-void-border-2 text-void-fg-1 text-sm rounded px-3 py-2 outline-none focus:border-void-border-1"
										value={currentSelection ? `${currentSelection.providerName}:${currentSelection.modelName}` : ''}
										onChange={(e) => {
											const [p, m] = e.target.value.split(':');
											if (p && m) handleModelSelect(featureName, p as ProviderName, m);
										}}
									>
										<option value="" disabled>Select a model...</option>
										{allAvailableModels.map(({ providerName, modelName }) => (
											<option key={`${providerName}:${modelName}`} value={`${providerName}:${modelName}`}>
												{displayInfoOfProviderName(providerName).title}: {modelName}
											</option>
										))}
									</select>
								</div>
							</div>
						);
					})}
				</div>
			</FadeIn>

			{/* Navigation */}
			<FadeIn delayMs={400} className="mt-auto py-6">
				<div className="flex items-center justify-center gap-4">
					<PreviousButton onClick={() => setPageIndex(pageIndex - 1)} />
					<NextButton onClick={() => setPageIndex(pageIndex + 1)} />
				</div>
			</FadeIn>
		</div>
	);
};

// =============================================
// 	OnboardingPage
// 		title:
// 			div
// 				"Welcome to Void"
// 			image
// 		content:<></>
// 		title
// 		content
// 		prev/next

// 	OnboardingPage
// 		title:
// 			div
// 				"How would you like to use Void?"
// 		content:
// 			ModelQuestionContent
// 				|
// 					div
// 						"I want to:"
// 					div
// 						"Use the smartest models"
// 						"Keep my data fully private"
// 						"Save money"
// 						"I don't know"
// 				| div
// 					| div
// 						"We recommend using "
// 						"Set API"
// 					| div
// 						""
// 					| div
//
// 		title
// 		content
// 		prev/next
//
// 	OnboardingPage
// 		title
// 		content
// 		prev/next

// Provider Card Component with better structure
const ProviderCard = ({ providerName, settingsState }: { providerName: ProviderName; settingsState: VoidSettingsState }) => {
	const accessor = useAccessor();
	const voidSettingsService = accessor.get('IVoidSettingsService');
	const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

	const { title } = displayInfoOfProviderName(providerName);
	const settingNames = customSettingNamesOfProvider(providerName);
	const isConfigured = settingsState.settingsOfProvider[providerName]._didFillInProviderSettings;

	// Toggle key visibility for a specific setting
	const toggleKeyVisibility = (settingName: string) => {
		setShowKeys(prev => ({ ...prev, [settingName]: !prev[settingName] }));
	};

	// Get provider-specific info tooltip
	const getProviderInfo = (pn: ProviderName): string | null => {
		if (pn === 'gemini') return 'Gemini 2.5 Pro offers 25 free messages a day, and Gemini 2.5 Flash offers 500.';
		if (pn === 'openRouter') return 'OpenRouter offers 50 free messages a day, and 1000 if you deposit $10. Only applies to models labeled \':free\'.';
		return null;
	};

	const info = getProviderInfo(providerName);

	return (
		<div
			className="rounded-lg overflow-hidden transition-colors duration-200"
			style={{
				background: 'var(--void-bg-1)',
				border: `1px solid ${isConfigured ? 'color-mix(in srgb, var(--vscode-testing-iconPassed) 30%, transparent)' : 'var(--void-border-2)'}`,
			}}
		>
			{/* Card Header */}
			<div
				className="px-4 py-3 flex items-center justify-between"
				style={{
					background: 'var(--void-bg-1)',
					borderBottom: '1px solid var(--void-border-2)',
				}}
			>
				<div className="flex items-center gap-2">
					<span className="font-medium text-void-fg-1">{title}</span>
					{info && (
						<span
							data-tooltip-id="void-tooltip-provider-info"
							data-tooltip-content={info}
							data-tooltip-place="top"
							className="text-xs text-void-fg-3 cursor-help"
						>
							ⓘ
						</span>
					)}
				</div>
				{isConfigured && (
					<div className="flex items-center gap-1.5 text-[var(--vscode-testing-iconPassed)]">
						<Check className="w-3.5 h-3.5" />
						<span className="text-xs font-medium">Connected</span>
					</div>
				)}
			</div>

			{/* Card Body */}
			<div className="p-4 space-y-4">
				{settingNames.map((settingName, index) => {
					const { title: settingTitle, placeholder, isPasswordField } = displayInfoOfSettingName(providerName, settingName);
					const settingValue = settingsState.settingsOfProvider[providerName][settingName] as string;
					const isVisible = showKeys[settingName];

					return (
						<div key={settingName} className="space-y-1.5">
							<label className="text-xs text-void-fg-3 font-medium">{settingTitle}</label>
							<div className="relative">
								<input
									type={isPasswordField && !isVisible ? 'password' : 'text'}
									value={settingValue || ''}
									onChange={(e) => voidSettingsService.setSettingOfProvider(providerName, settingName, e.target.value)}
									placeholder={placeholder}
									className="w-full text-void-fg-1 text-sm rounded px-3 py-2 pr-10 transition-colors"
									style={{
										background: 'var(--void-bg-3)',
										border: '1px solid var(--void-border-2)',
									}}
									onFocus={(e) => {
										e.target.style.borderColor = 'var(--void-border-1)';
									}}
									onBlur={(e) => {
										e.target.style.borderColor = 'var(--void-border-2)';
									}}
								/>
								{isPasswordField && settingValue && (
									<button
										onClick={() => toggleKeyVisibility(settingName)}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-void-fg-3 hover:text-void-fg-2 transition-colors"
										type="button"
									>
										{isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
									</button>
								)}
							</div>
							{index === settingNames.length - 1 && (
								<div className="text-xs text-void-fg-3/80 pt-1">
									<ChatMarkdownRender string={subTextMdOfProviderName(providerName)} chatMessageLocation={undefined} />
								</div>
							)}
						</div>
					);
				})}

				{/* Model status indicator */}
				{isProviderNameDisabled(providerName, settingsState) === 'addModel' && (
					<div className="flex items-center gap-2 text-amber-400/90 text-xs pt-2">
						<AlertCircle className="w-3.5 h-3.5" />
						<span>Please add a model in the Models section</span>
					</div>
				)}
			</div>

			{providerName === 'ollama' && (
				<div className="px-4 pb-4">
					<OllamaSetupInstructions />
				</div>
			)}
		</div>
	);
};

const NextButton = ({ onClick, ...props }: { onClick: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
	const { disabled, ...buttonProps } = props;

	return (
		<button
			onClick={disabled ? undefined : onClick}
			onDoubleClick={onClick}
			disabled={disabled}
			className="px-5 py-2 rounded text-sm font-medium flex items-center gap-2"
			style={{
				background: disabled ? 'var(--void-fg-3)' : 'var(--void-fg-1)',
				color: disabled ? 'var(--void-bg-3)' : 'var(--void-bg-3)',
				opacity: disabled ? 0.3 : 1,
				cursor: disabled ? 'not-allowed' : 'pointer',
				border: 'none',
			}}
			{...disabled && {
				'data-tooltip-id': 'void-tooltip',
				'data-tooltip-content': 'Please set up at least one Chat model to continue',
				'data-tooltip-place': 'top',
			}}
			{...buttonProps}
		>
			Next
			<ChevronRight className="w-4 h-4" />
		</button>
	);
};

const PreviousButton = ({ onClick, ...props }: { onClick: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
	return (
		<button
			onClick={onClick}
			className="px-5 py-2 rounded text-sm"
			style={{
				color: 'var(--void-fg-3)',
				background: 'transparent',
				border: 'none',
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.color = 'var(--void-fg-2)';
				e.currentTarget.style.background = 'var(--void-bg-2)';
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.color = 'var(--void-fg-3)';
				e.currentTarget.style.background = 'transparent';
			}}
			{...props}
		>
			Back
		</button>
	);
};



const OnboardingPageShell = ({ top, bottom, content, hasMaxWidth = true, className = '', }: {
	top?: React.ReactNode,
	bottom?: React.ReactNode,
	content?: React.ReactNode,
	hasMaxWidth?: boolean,
	className?: string,
}) => {
	return (
		<div className={`h-[80vh] text-lg flex flex-col gap-4 w-full mx-auto ${hasMaxWidth ? 'max-w-[600px]' : ''} ${className}`}>
			{top && <FadeIn className='w-full mb-auto pt-16'>{top}</FadeIn>}
			{content && <FadeIn className='w-full my-auto'>{content}</FadeIn>}
			{bottom && <div className='w-full pb-8'>{bottom}</div>}
		</div>
	)
}

const OllamaDownloadOrRemoveModelButton = ({ modelName, isModelInstalled, sizeGb }: { modelName: string, isModelInstalled: boolean, sizeGb: number | false | 'not-known' }) => {
	// for now just link to the ollama download page
	return <a
		href={`https://ollama.com/library/${modelName}`}
		target="_blank"
		rel="noopener noreferrer"
		className="flex items-center justify-center text-void-fg-2 hover:text-void-fg-1"
	>
		<ExternalLink className="w-3.5 h-3.5" />
	</a>

}


const YesNoText = ({ val }: { val: boolean | null }) => {

	return <div
		className={
			val === true ? "text text-emerald-500"
				: val === false ? 'text-rose-600'
					: "text text-amber-300"
		}
	>
		{
			val === true ? "Yes"
				: val === false ? 'No'
					: "Yes*"
		}
	</div>

}



const abbreviateNumber = (num: number): string => {
	if (num >= 1000000) {
		// For millions
		return Math.floor(num / 1000000) + 'M';
	} else if (num >= 1000) {
		// For thousands
		return Math.floor(num / 1000) + 'K';
	} else {
		// For numbers less than 1000
		return num.toString();
	}
}





const PrimaryActionButton = ({ children, className, ringSize, ...props }: { children: React.ReactNode, ringSize?: undefined | 'xl' | 'screen' } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {


	return (
		<button
			type='button'
			className={`
				flex items-center justify-center

				text-white dark:text-black
				bg-black/90 dark:bg-white/90

				${ringSize === 'xl' ? `
					gap-2 px-16 py-8
					transition-all duration-300 ease-in-out
					`
					: ringSize === 'screen' ? `
					gap-2 px-16 py-8
					transition-all duration-1000 ease-in-out
					`: ringSize === undefined ? `
					gap-1 px-4 py-2
					transition-all duration-300 ease-in-out
				`: ''}

				rounded-lg
				group
				${className}
			`}
			{...props}
		>
			{children}
			<ChevronRight
				className={`
					transition-all duration-300 ease-in-out

					transform
					group-hover:translate-x-1
					group-active:translate-x-1
				`}
			/>
		</button>
	)
}


type WantToUseOption = 'smart' | 'private' | 'cheap' | 'all'

const VoidOnboardingContent = () => {


	const accessor = useAccessor()
	const voidSettingsService = accessor.get('IVoidSettingsService')
	const voidMetricsService = accessor.get('IMetricsService')

	const voidSettingsState = useSettingsState()

	const [pageIndex, setPageIndex] = useState(0)


	// page 1 state
	const [wantToUseOption, setWantToUseOption] = useState<WantToUseOption>('smart')

	// Replace the single selectedProviderName with four separate states
	// page 2 state - each tab gets its own state
	const [selectedIntelligentProvider, setSelectedIntelligentProvider] = useState<ProviderName>('anthropic');
	const [selectedPrivateProvider, setSelectedPrivateProvider] = useState<ProviderName>('ollama');
	const [selectedAffordableProvider, setSelectedAffordableProvider] = useState<ProviderName>('gemini');
	const [selectedAllProvider, setSelectedAllProvider] = useState<ProviderName>('anthropic');

	// Helper function to get the current selected provider based on active tab
	const getSelectedProvider = (): ProviderName => {
		switch (wantToUseOption) {
			case 'smart': return selectedIntelligentProvider;
			case 'private': return selectedPrivateProvider;
			case 'cheap': return selectedAffordableProvider;
			case 'all': return selectedAllProvider;
		}
	}

	// Helper function to set the selected provider for the current tab
	const setSelectedProvider = (provider: ProviderName) => {
		switch (wantToUseOption) {
			case 'smart': setSelectedIntelligentProvider(provider); break;
			case 'private': setSelectedPrivateProvider(provider); break;
			case 'cheap': setSelectedAffordableProvider(provider); break;
			case 'all': setSelectedAllProvider(provider); break;
		}
	}

	const providerNamesOfWantToUseOption: { [wantToUseOption in WantToUseOption]: ProviderName[] } = {
		smart: ['anthropic', 'openAI', 'gemini', 'openRouter'],
		private: ['ollama', 'vLLM', 'openAICompatible', 'lmStudio'],
		cheap: ['gemini', 'deepseek', 'openRouter', 'ollama', 'vLLM'],
		all: providerNames,
	}


	const selectedProviderName = getSelectedProvider();
	const didFillInProviderSettings = selectedProviderName && voidSettingsState.settingsOfProvider[selectedProviderName]._didFillInProviderSettings
	const isApiKeyLongEnoughIfApiKeyExists = selectedProviderName && voidSettingsState.settingsOfProvider[selectedProviderName].apiKey ? voidSettingsState.settingsOfProvider[selectedProviderName].apiKey.length > 15 : true
	const isAtLeastOneModel = selectedProviderName && voidSettingsState.settingsOfProvider[selectedProviderName].models.length >= 1

	const didFillInSelectedProviderSettings = !!(didFillInProviderSettings && isApiKeyLongEnoughIfApiKeyExists && isAtLeastOneModel)

	const prevAndNextButtons = <div className="max-w-[600px] w-full mx-auto flex flex-col items-end">
		<div className="flex items-center gap-2">
			<PreviousButton
				onClick={() => { setPageIndex(pageIndex - 1) }}
			/>
			<NextButton
				onClick={() => { setPageIndex(pageIndex + 1) }}
			/>
		</div>
	</div>


	const lastPagePrevAndNextButtons = <div className="max-w-[600px] w-full mx-auto flex flex-col items-end">
		<div className="flex items-center gap-2">
			<PreviousButton
				onClick={() => { setPageIndex(pageIndex - 1) }}
			/>
			<PrimaryActionButton
				onClick={() => {
					voidSettingsService.setGlobalSetting('isOnboardingComplete', true);
					voidMetricsService.capture('Completed Onboarding', { selectedProviderName, wantToUseOption })
				}}
				ringSize={voidSettingsState.globalSettings.isOnboardingComplete ? 'screen' : undefined}
			>Enter the Orbit</PrimaryActionButton>
		</div>
	</div>


	// cannot be md
	const basicDescOfWantToUseOption: { [wantToUseOption in WantToUseOption]: string } = {
		smart: "Models with the best performance on benchmarks.",
		private: "Host on your computer or local network for full data privacy.",
		cheap: "Free and affordable options.",
		all: "",
	}

	// can be md
	const detailedDescOfWantToUseOption: { [wantToUseOption in WantToUseOption]: string } = {
		smart: "Most intelligent and best for agent mode.",
		private: "Private-hosted so your data never leaves your computer or network. [Email us](mailto:founders@orbiteditor.com) for help setting up at your company.",
		cheap: "Use great deals like Gemini 2.5 Pro, or self-host a model with Ollama or vLLM for free.",
		all: "",
	}

	// Modified: initialize separate provider states on initial render instead of watching wantToUseOption changes
	useEffect(() => {
		if (selectedIntelligentProvider === undefined) {
			setSelectedIntelligentProvider(providerNamesOfWantToUseOption['smart'][0]);
		}
		if (selectedPrivateProvider === undefined) {
			setSelectedPrivateProvider(providerNamesOfWantToUseOption['private'][0]);
		}
		if (selectedAffordableProvider === undefined) {
			setSelectedAffordableProvider(providerNamesOfWantToUseOption['cheap'][0]);
		}
		if (selectedAllProvider === undefined) {
			setSelectedAllProvider(providerNamesOfWantToUseOption['all'][0]);
		}
	}, []);

	// reset the page to page 0 if the user redos onboarding
	useEffect(() => {
		if (!voidSettingsState.globalSettings.isOnboardingComplete) {
			setPageIndex(0)
		}
	}, [setPageIndex, voidSettingsState.globalSettings.isOnboardingComplete])


	const contentOfIdx: { [pageIndex: number]: React.ReactNode } = {
		0: <OnboardingPageShell
			content={
				<div className='flex flex-col items-center gap-8'>
					<div className="text-5xl font-light text-center">Welcome to Orbit</div>

					{/* Slice of Orbit image */}
					<div className='max-w-md w-full h-[30vh] mx-auto flex items-center justify-center'>
						{!isLinux && <VoidIcon />}
					</div>


					<FadeIn
						delayMs={1000}
					>
						<PrimaryActionButton
							onClick={() => { setPageIndex(1) }}
						>
							Get Started
						</PrimaryActionButton>
					</FadeIn>

				</div>
			}
		/>,

		1: <OnboardingPageShell
			content={
				<ThemeSelectionPage pageIndex={pageIndex} setPageIndex={setPageIndex} />
			}
		/>,

		2: <OnboardingPageShell hasMaxWidth={false}
			content={
				<AddProvidersPage pageIndex={pageIndex} setPageIndex={setPageIndex} />
			}
		/>,
		3: <OnboardingPageShell hasMaxWidth={false}
			content={
				<ModelSelectionPage pageIndex={pageIndex} setPageIndex={setPageIndex} />
			}
		/>,
		4: <OnboardingPageShell

			content={
				<div>
					<div className="text-5xl font-light text-center">Import Settings</div>

					<div className="mt-8 text-center flex flex-col items-center gap-4 w-full max-w-md mx-auto">
						<h4 className="text-void-fg-3 mb-4">Transfer your settings from an existing editor?</h4>
						<OneClickSwitchButton className='w-full px-4 py-2' fromEditor="VS Code" />
						<OneClickSwitchButton className='w-full px-4 py-2' fromEditor="Cursor" />
						<OneClickSwitchButton className='w-full px-4 py-2' fromEditor="Windsurf" />
					</div>
				</div>
			}
			bottom={lastPagePrevAndNextButtons}
		/>,
	}


	return <div key={pageIndex} className="w-full h-[80vh] text-left mx-auto flex flex-col items-center justify-center">
		<ErrorBoundary>
			{contentOfIdx[pageIndex]}
		</ErrorBoundary>
	</div>

}
