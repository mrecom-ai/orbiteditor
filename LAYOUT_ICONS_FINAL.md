# Layout Icons - Final Production Specification

## Overview
All layout toggle icons are now pixel-perfect, theme-aware, and production-ready.

## Icon Specifications

### 1. Sidebar Icons (Vertical Panel)
**Files:** `sidebarpart.css`, `auxiliaryBarPart.css`

**Icon Classes:**
- `panel-left` / `panel-left-off` - Primary sidebar
- `auxiliarybar-left-layout-icon` / `auxiliarybar-left-off-layout-icon` - Auxiliary bar left
- `panel-right` / `panel-right-off` - Mirrored
- `auxiliarybar-right-layout-icon` / `auxiliarybar-right-off-layout-icon` - Mirrored

**SVG Design:**
```svg
<!-- Outer frame -->
<rect x="1" y="2" width="14" height="12" rx="2" 
      stroke="white" stroke-width="1.5" fill="none"/>

<!-- Inner panel (vertical) -->
<rect x="3" y="4" width="4" height="8" rx="1" fill="white"/>
<!-- CLOSED: add opacity="0.4" -->
```

**Visual:**
```
┌──────────────────────┐
│  ┌────┐              │
│  │████│              │  ← 4px × 8px vertical panel
│  │████│              │
│  │████│              │
│  └────┘              │
└──────────────────────┘
```

### 2. Panel Icon (Horizontal - Bottom)
**Files:** `panelpart.css`

**Icon Classes:**
- `panel-layout-icon` / `panel-layout-icon-off`

**SVG Design:**
```svg
<!-- Outer frame -->
<rect x="1" y="2" width="14" height="12" rx="2" 
      stroke="white" stroke-width="1.5" fill="none"/>

<!-- Inner panel (horizontal) - MINOR size -->
<rect x="2" y="10" width="12" height="3" rx="1" fill="white"/>
<!-- CLOSED: add opacity="0.4" -->
```

**Visual:**
```
┌──────────────────────┐
│                      │
│                      │
│                      │  ← More empty space
│                      │
│                      │
│██████████████████████│  ← 12px × 3px horizontal panel (minor)
└──────────────────────┘
```

## Common Specifications

| Property | Value |
|----------|-------|
| Canvas size | 16×16px |
| Outer frame | x=1, y=2, w=14, h=12, rx=2 |
| Stroke width | 1.5px |
| Corner radius | 2px (outer), 1px (inner) |

## Inner Element Sizes

| Icon Type | Inner Size | Position |
|-----------|-----------|----------|
| **Sidebar** (vertical) | 4px × 8px | x=3, y=4 |
| **Panel** (horizontal) | 12px × 3px | x=2, y=10 |

## State Variants

| State | Inner Opacity | Icon Opacity | Visual |
|-------|--------------|--------------|--------|
| **OPEN** | 100% (solid) | 100% | Bold, filled |
| **CLOSED** | 40% (faded) | 70% | Subtle, dimmed |
| **Hover (CLOSED)** | 40% | 90% | Slightly brighter |

## Theme Support

All icons use `mask-image` + `background-color` approach:

```css
/* Mask defines the shape */
-webkit-mask-image: url("data:image/svg+xml,...");
mask-image: url("data:image/svg+xml,...");

/* Color comes from theme variable */
background-color: var(--vscode-icon-foreground) !important;
```

**Automatic theme adaptation:**
- Dark theme: `--vscode-icon-foreground` = white
- Light theme: `--vscode-icon-foreground` = dark

**No filter inversion needed!**

## Right-Side Mirroring

```css
.codicon-panel-right,
.codicon-panel-right-off,
.codicon-auxiliarybar-right-layout-icon,
.codicon-auxiliarybar-right-off-layout-icon {
  transform: scaleX(-1) !important;
}
```

## Files Modified

1. `auxiliaryBarPart.css` - Auxiliary bar icons
2. `sidebarpart.css` - Primary sidebar icons
3. `panelpart.css` - Bottom panel icons
4. `titlebarpart.css` - All icons in titlebar context

## Responsive Behavior

- Icons scale with zoom (Ctrl/Cmd + +/-)
- Mask-size stays at 16px for crisp rendering
- Colors adapt to any theme automatically
- High contrast mode: Full opacity for visibility

## Final Visual Comparison

```
SIDEBAR (Vertical)        PANEL (Horizontal)
┌──────────────────┐      ┌──────────────────┐
│  ┌────┐          │      │                  │
│  │████│          │      │                  │
│  │████│          │      │                  │
│  │████│          │      │                  │
│  └────┘          │      │██████████████    │  ← Minor 3px bar
└──────────────────┘      └──────────────────┘
   4px × 8px                    12px × 3px
```

All icons are now **minor, premium, and perfectly balanced**! ✨
