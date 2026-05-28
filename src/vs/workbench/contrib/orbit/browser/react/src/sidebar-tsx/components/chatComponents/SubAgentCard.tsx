/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------*/

import React, { KeyboardEvent, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Circle, FileText, Loader2, Lock, ShieldAlert, Wrench, XCircle } from 'lucide-react'
import { SubAgentChildViewModel } from '../../../../../../common/subAgentTypes.js'
import { useAccessor } from '../../../util/services.js'

const suppressedLines = new Set([
	'queued', 'thinking', 'tool', 'planning approach', 'finalizing', 'initializing...',
	'summarizing findings', 'completed', 'failed', 'killed', 'canceled', 'timed out',
])

const isTerminalState = (s: SubAgentChildViewModel['state']) =>
	['completed', 'failed', 'timed_out', 'canceled', 'killed'].includes(s)

const isRunningState = (s: SubAgentChildViewModel['state']) =>
	['running_llm', 'running_tool', 'summarizing'].includes(s)

/** Extract basename from a file path */
const basename = (p: string) => {
	const segs = p.replace(/[?#].*$/, '').replace(/\\/g, '/').replace(/\/+$/, '').split('/').filter(Boolean)
	return segs[segs.length - 1] ?? p
}

/** Compact a single token: if it looks like a path, show only the basename */
const compactToken = (token: string): string => {
	const m = token.match(/^(['"]?)(.*?)(['"]?)$/)
	if (!m) return token
	const [, lead, core, trail] = m
	const cleaned = core.replace(/[),.;:]+$/g, '')
	const suffix = core.slice(cleaned.length)
	if (!cleaned.includes('/') && !cleaned.includes('\\')) return token
	const base = basename(cleaned)
	return `${lead}${base.length > 48 ? `…${base.slice(-40)}` : base}${suffix}${trail}`
}

/** Format a line: compact paths, collapse whitespace */
const fmtLine = (line: string) =>
	line.replace(/\s+/g, ' ').trim()
		.split(/(\s+)/)
		.map(p => /\s+/.test(p) ? p : compactToken(p))
		.join('')

/** Strip inline markdown formatting for plain-text display */
const stripMd = (text: string) =>
	text
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\*([^*]+)\*/g, '$1')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/~~([^~]+)~~/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/\s+/g, ' ')
		.trim()

const dur = (ms: number) => {
	if (!Number.isFinite(ms) || ms <= 0) return ''
	if (ms < 1000) return '<1s'
	if (ms < 60000) return `${Math.round(ms / 1000)}s`
	const m = Math.floor(ms / 60000), s = Math.round((ms % 60000) / 1000)
	return s > 0 ? `${m}m ${s}s` : `${m}m`
}

const StateIcon = ({ state }: { state: SubAgentChildViewModel['state'] }) => {
	if (isRunningState(state)) return <Loader2 size={13} className='sa-icon sa-icon--spin' />
	if (state === 'completed') return <CheckCircle2 size={13} className='sa-icon sa-icon--done' />
	if (state === 'failed' || state === 'timed_out') return <XCircle size={13} className='sa-icon sa-icon--error' />
	return <Circle size={13} className='sa-icon sa-icon--muted' />
}

export const SubAgentCard = React.memo(({ child }: { child: SubAgentChildViewModel; flat?: boolean }) => {
	const accessor = useAccessor()
	const orchestrator = accessor.get('ISubAgentOrchestratorService')
	const toggledRef = useRef(false)
	const [expanded, setExpanded] = useState(false)

	const isRunning = isRunningState(child.state)
	const isTerminal = isTerminalState(child.state)

	// Bullets (findings): strip markdown, dedupe
	const bullets = (child.summaryBullets ?? [])
		.map(b => stripMd(b))
		.filter((b, i, arr) => b && arr.indexOf(b) === i)

	const oneLine = (child.oneLineSummary && stripMd(child.oneLineSummary)) || ''
	const filesInspected = (child.filesInspected ?? []).filter(Boolean).slice(0, 8)
	const risks = (child.risks ?? []).map(stripMd).filter(Boolean).slice(0, 4)
	const recommendations = (child.recommendations ?? []).map(stripMd).filter(Boolean).slice(0, 4)

	const hasStructuredDetails = bullets.length > 0
		|| filesInspected.length > 0
		|| risks.length > 0
		|| recommendations.length > 0
		|| !!oneLine
	const hasDetails = hasStructuredDetails || !!child.error

	const canStop = !isTerminal && !!child.taskId

	// Subtitle: while running show last activity; when terminal show oneLineSummary or first finding.
	const lastActivity = (() => {
		const log = child.activityLog ?? []
		for (let i = log.length - 1; i >= 0; i--) {
			const f = fmtLine(log[i])
			if (f && !suppressedLines.has(f.toLowerCase())) return f
		}
		const a = fmtLine(child.activityText || '')
		return suppressedLines.has(a.toLowerCase()) ? '' : a
	})()

	const subtitle = isRunning
		? lastActivity
		: (child.state === 'completed' ? (oneLine || bullets[0]) : undefined)

	const elapsed = child.startedAt ? dur(Math.max(0, (child.updatedAt ?? Date.now()) - child.startedAt)) : ''
	const toolCount = (child.progress?.toolUseCount ?? 0) > 0
		? `${child.progress!.toolUseCount} tool${child.progress!.toolUseCount === 1 ? '' : 's'}`
		: ''
	const meta = [toolCount, elapsed].filter(Boolean).join(' · ')

	const title = (child.title?.trim() || 'Sub-agent task')
		.replace(/\s+\(@[^)]+?\s+subagent\)$/i, '').trim()

	const showPartialBadge = child.state === 'completed' && (child.statusKind === 'partial' || child.wasRepaired)
	const showBlockedBadge = (child.blockedActionsCount ?? 0) > 0
	const confidenceBand = child.confidenceBand

	// Only reset expansion on terminal transition, not on every update
	const prevStateRef = useRef(child.state)
	useEffect(() => {
		if (prevStateRef.current !== child.state) {
			prevStateRef.current = child.state
			if (!toggledRef.current) setExpanded(false)
		}
	}, [child.state])

	const toggle = () => {
		if (!hasDetails) return
		toggledRef.current = true
		setExpanded(e => !e)
	}

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		if (!hasDetails || (e.key !== 'Enter' && e.key !== ' ')) return
		e.preventDefault()
		toggle()
	}

	const onStop = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		if (child.taskId && !isTerminal) orchestrator.killTask(child.taskId)
	}

	return (
		<div className={`sa-card${isRunning ? ' sa-card--running' : ''}${isTerminal ? ' sa-card--terminal' : ''}`}>
			<div
				className='sa-row'
				role={hasDetails ? 'button' : undefined}
				tabIndex={hasDetails ? 0 : undefined}
				onClick={toggle}
				onKeyDown={onKeyDown}
				aria-expanded={hasDetails ? expanded : undefined}
			>
				<StateIcon state={child.state} />

				<div className='sa-text'>
					<span className='sa-title'>{title}</span>
					{subtitle && <span className='sa-sub'>{subtitle}</span>}
				</div>

				<div className='sa-end'>
					{showPartialBadge && (
						<span className='sa-meta sa-badge sa-badge--partial' title='The sub-agent output was rewritten by the validator.'>
							<AlertTriangle size={10} /> partial
						</span>
					)}
					{showBlockedBadge && (
						<span className='sa-meta sa-badge sa-badge--blocked' title={`${child.blockedActionsCount} tool call(s) were blocked by the policy guard.`}>
							<Lock size={10} /> blocked
						</span>
					)}
					{confidenceBand && child.state === 'completed' && (
						<span className={`sa-meta sa-confidence sa-confidence--${confidenceBand}`} title={`Confidence: ${confidenceBand}`}>
							{confidenceBand}
						</span>
					)}
					{meta && <span className='sa-meta'>{meta}</span>}
					{canStop && (
						<button className='sa-stop' onClick={onStop} title='Stop' aria-label={`Stop ${title}`}>
							<span className='sa-stop-sq' />
						</button>
					)}
					{hasDetails && (
						<ChevronDown size={11} className={`sa-chevron${expanded ? ' sa-chevron--open' : ''}`} />
					)}
				</div>
			</div>

			{hasDetails && expanded && (
				<div className='sa-body'>
					{child.error && (
						<div className='sa-err'>
							<AlertTriangle size={11} />
							<span>{fmtLine(child.error)}</span>
						</div>
					)}

					{oneLine && (
						<div className='sa-section'>
							<div className='sa-section-head'>Summary</div>
							<div className='sa-summary'>{oneLine}</div>
						</div>
					)}

					{bullets.length > 0 && (
						<div className='sa-section'>
							<div className='sa-section-head'>Findings</div>
							<ul className='sa-bullets'>
								{bullets.map((b, i) => (
									<li key={i} className='sa-bullet'>{b}</li>
								))}
							</ul>
						</div>
					)}

					{filesInspected.length > 0 && (
						<div className='sa-section'>
							<div className='sa-section-head'>
								<FileText size={11} /> Files inspected
							</div>
							<div className='sa-chips'>
								{filesInspected.map((f, i) => (
									<span key={i} className='sa-chip' title={f}>{basename(f)}</span>
								))}
							</div>
						</div>
					)}

					{risks.length > 0 && (
						<div className='sa-section'>
							<div className='sa-section-head'>
								<ShieldAlert size={11} /> Risks
							</div>
							<ul className='sa-bullets'>
								{risks.map((r, i) => (
									<li key={i} className='sa-bullet'>{r}</li>
								))}
							</ul>
						</div>
					)}

					{recommendations.length > 0 && (
						<div className='sa-section'>
							<div className='sa-section-head'>
								<Wrench size={11} /> Recommendations
							</div>
							<ul className='sa-bullets'>
								{recommendations.map((r, i) => (
									<li key={i} className='sa-bullet'>{r}</li>
								))}
							</ul>
						</div>
					)}
				</div>
			)}
		</div>
	)
})
