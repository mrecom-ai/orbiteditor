---
title: Tool Styling Improvements
created: 2026-01-09T10:25:17.115Z
updated: 2026-01-09T10:53:23.303Z
status: in-progress
model: claude-sonnet-4-0
---

# Tool Styling Improvements Plan

## Current State Analysis

From reviewing the SidebarChat.tsx code, the current tool styling system has several components:

- **ToolHeaderWrapper**: The main wrapper for tool displays with expansion/collapse functionality
- **EditToolCardWrapper**: Card-based design for edit/rewrite tools with special animations
- **BrowserToolBar**: Horizontal layout for browser automation tools
- **StreamingTool**: Loading states and shimmer effects for tools being generated
- **ParallelToolGroup**: Collapsible grouping for related tools

## Key Styling Issues Identified

### 1. **Visual Hierarchy Problems**
- Inconsistent spacing between different tool types
- Unclear distinction between tool states (pending, running, success, error)
- Mixed design patterns (cards vs. headers vs. bars)

### 2. **Color System Inconsistencies**
- Hardcoded color values scattered throughout components
- Inconsistent use of void-specific color tokens
- Missing semantic color meanings for different tool states

### 3. **Interactive Feedback Gaps**
- Hover states vary between tool types
- Loading/streaming animations are inconsistent
- Poor visual feedback for expandable content

### 4. **Layout and Spacing Issues**
- Inconsistent padding and margins
- Cramped layouts in collapsed states
- Poor alignment between icons, text, and controls

## Design System Foundation

### Color Palette Consolidation
```typescript
// Semantic tool colors
const toolColors = {
  // State colors
  idle: 'var(--vscode-void-fg-3)',
  running: 'var(--vscode-void-border-1)', 
  success: 'var(--vscode-void-success)',
  error: 'var(--vscode-void-warning)',
  rejected: 'var(--vscode-void-fg-4)',
  
  // Background layers
  toolBg: 'var(--vscode-void-bg-2)',
  toolBgHover: 'var(--vscode-void-bg-1)',
  cardBg: 'var(--vscode-void-bg-2)',
  
  // Interactive elements
  actionHover: 'var(--vscode-void-border-1)',
  focusRing: 'var(--vscode-void-accent)',
}
```

### Typography Scale
```css
.tool-title { font-size: 12.5px; font-weight: 500; }
.tool-description { font-size: 11.5px; font-weight: 400; }
.tool-metadata { font-size: 10.5px; font-weight: 400; }
.tool-count { font-size: 10px; font-weight: 500; }
```

### Spacing System
```css
--tool-padding-sm: 8px;
--tool-padding-md: 12px;
--tool-padding-lg: 16px;
--tool-gap-xs: 4px;
--tool-gap-sm: 8px;
--tool-gap-md: 12px;
```

## Component Redesign Specifications

### 1. **Unified Tool Header**
- Consistent height (32px base, 36px for cards)
- Left-aligned: chevron + icon + title + description
- Right-aligned: metadata + status indicator + actions
- Hover states with smooth transitions
- Clear visual separation between clickable and non-clickable areas

### 2. **Tool Status System**
Create visual status indicators:
- **Pending**: Pulsing blue dot + "Awaiting approval" text
- **Running**: Spinner animation + shimmer text effect
- **Success**: Subtle green accent + completion metadata
- **Error**: Orange warning triangle + error description
- **Rejected**: Gray strikethrough styling

### 3. **Card vs. Header Layout**
**Headers** (most tools): 
- Compact single-line display
- Expandable content area when needed
- Minimal visual weight

**Cards** (edit tools, complex operations):
- Elevated appearance with subtle shadows
- Animated borders for running states
- More prominent visual treatment

### 4. **Content Expansion System**
- Consistent animation timing (200ms ease-in-out)
- Max-height approach for smooth transitions
- Lazy rendering of expensive content
- "Show more/less" controls for truncated content

### 5. **Tool Grouping Visual Design**
- Subtle group containers with rounded corners
- Smart auto-collapse with override controls
- Group headers with tool count and status summary
- Consistent spacing between groups

## Implementation Strategy

### Phase 1: Foundation
- Extract hardcoded colors to centralized theme system
- Create shared styling utilities and CSS variables
- Implement consistent spacing scale

### Phase 2: Component Standardization  
- Redesign ToolHeaderWrapper with new specifications
- Update all tool-specific components to use unified patterns
- Implement consistent hover and focus states

### Phase 3: Enhanced Interactions
- Add smooth micro-animations for state changes
- Implement loading shimmer system for all tool types
- Enhance expansion/collapse animations

### Phase 4: Visual Refinements
- Polish color relationships and contrast
- Add subtle shadows and depth cues
- Implement responsive typography scaling

### Phase 5: Accessibility & Polish
- Ensure keyboard navigation works smoothly
- Add proper ARIA labels and screen reader support
- Optimize animations for reduced motion preferences

## Expected Outcomes

1. **Visual Coherence**: All tools follow consistent design language
2. **Improved Usability**: Clear hierarchy and interactive feedback
3. **Better Performance**: Optimized animations and rendering
4. **Enhanced Accessibility**: Better support for assistive technologies
5. **Maintainable Code**: Centralized styling system reduces technical debt

## Implementation Checklist
1. [✓] Audit existing tool styling patterns and create comprehensive inventory <!-- id:audit-styling -->
2. [IN_PROGRESS] Create centralized color token system for tool states and themes <!-- id:color-tokens -->
3. [PENDING] Build foundational components with new styling standards <!-- id:foundational-components -->
4. [PENDING] Rebuild ToolHeaderWrapper with unified layout and interactions <!-- id:rebuild-header-wrapper -->
5. [PENDING] Enhance EditToolCardWrapper with improved visual hierarchy <!-- id:enhance-edit-wrapper -->
6. [PENDING] Update BrowserToolBar component to match new design system <!-- id:update-browser-toolbar -->
7. [PENDING] Enhance ParallelToolGroup visual design and interactions <!-- id:enhance-parallel-group -->
8. [PENDING] Create consistent loading animations and shimmer effects <!-- id:loading-animations -->
9. [PENDING] Implement smooth transitions for tool state changes <!-- id:smooth-transitions -->
10. [PENDING] Improve expand/collapse animations and lazy loading <!-- id:expand-animations -->
11. [PENDING] Add keyboard navigation and screen reader support <!-- id:accessibility -->
12. [PENDING] Document the new styling system for future development <!-- id:documentation -->

