# Feature Options Settings Redesign

**Date:** 2026-01-11
**Type:** UI/UX Redesign
**Status:** Completed

## Overview

Complete redesign of the Feature Options settings page from a basic flat list to a professional, section-based card layout inspired by Cursor's settings interface.

## Design Goals

1. **Professional Appearance** - Create a clean, modern settings interface
2. **Organized Grouping** - Group related settings into logical sections
3. **Consistent Layout** - Maintain consistent spacing, alignment, and visual hierarchy
4. **No Animations** - Keep the design simple without unnecessary animations
5. **Human-Crafted Feel** - Avoid generic AI-generated patterns

## Implementation

### 1. New CSS Classes

**File:** `src/styles.css`

Added section-based card styling system:

```css
/* Section Container (Card) */
.void-settings-section {
  background-color: var(--void-bg-1);
  border: 1px solid var(--void-border-2);
  border-radius: 8px;
  margin-bottom: 1.5rem;
  overflow: hidden;
}

/* Section Header */
.void-settings-section-header {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--void-border-2);
}

.void-settings-section-title {
  color: var(--void-fg-1);
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Settings Cell (Individual Row) */
.void-settings-cell {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1rem 1rem;
  position: relative;
}

.void-settings-cell:hover {
  background-color: rgba(255, 255, 255, 0.015);
}

/* Cell Divider */
.void-settings-cell-divider {
  position: absolute;
  top: 0;
  left: 1rem;
  right: 1rem;
  height: 1px;
  background-color: var(--void-border-3);
}

/* Cell Content */
.void-settings-cell-leading {
  flex: 1;
  min-width: 0;
  padding-right: 1.5rem;
}

.void-settings-cell-label {
  color: var(--void-fg-1);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.4;
  margin: 0 0 0.25rem 0;
}

.void-settings-cell-description {
  color: var(--void-fg-3);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.void-settings-cell-trailing {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.125rem;
}

/* Nested Settings */
.void-settings-nested {
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  background-color: rgba(0, 0, 0, 0.1);
  border-top: 1px solid var(--void-border-3);
}
```

### 2. New React Components

**File:** `src/void-settings-tsx/Settings.tsx`

#### SettingsSection Component

Wraps groups of related settings with an optional header:

```typescript
interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
}

const SettingsSection = ({ title, children }: SettingsSectionProps) => {
  return (
    <div className="settings-section">
      {title && (
        <div className="settings-section-header">
          <h3 className="settings-section-title">{title}</h3>
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};
```

#### SettingsCell Component

Individual setting row with label, description, and control:

```typescript
interface SettingsCellProps {
  label: string;
  description: string | React.ReactNode;
  badge?: string;
  showDivider?: boolean;
  children: React.ReactNode;
}

const SettingsCell = ({
  label,
  description,
  badge,
  showDivider = false,
  children
}: SettingsCellProps) => {
  return (
    <div className="settings-cell">
      {showDivider && <div className="settings-cell-divider" />}
      <div className="settings-cell-leading">
        <p className="settings-cell-label">
          {badge && <span className="settings-badge">{badge}</span>}
          {label}
        </p>
        <div className="settings-cell-description">{description}</div>
      </div>
      <div className="settings-cell-trailing">
        {children}
      </div>
    </div>
  );
};
```

### 3. Settings Organization

Settings are now organized into **5 logical sections**:

#### AI Features
- Autocomplete (with Experimental badge)
  - Model selection (nested, shown when enabled)
- Apply to Chat sync
  - Model selection (nested, shown when not synced)
- Fast Apply Method

#### Tools
- Auto-approve Code Edits
- Auto-approve Terminal Commands
- Auto-approve Browser Automation
- Auto-approve MCP Tools
- Fix Lint Errors
- Auto-accept LLM Changes

#### Editor
- Show Inline Suggestions

#### Notifications
- Agent Completion Sound
- Agent Completion Notification

#### Version Control
- SCM sync to Chat
  - Model selection (nested, shown when not synced)

### 4. Key Design Decisions

#### Dividers
- **First row in section:** No divider
- **Subsequent rows:** Divider at the top
- Implementation: `showDivider={index > 0}`

#### Nested Settings
- Model dropdowns appear indented below their parent setting
- Darker background color for visual hierarchy
- Left border for clear nesting indication
- Only shown conditionally (e.g., when a toggle is enabled)

#### Alignment
- **Left side:** Label (bold) + Description (muted)
- **Right side:** Control (switch, dropdown, button)
- Consistent padding and spacing across all rows

#### Typography
- **Section titles:** 13px, uppercase, bold, letter-spacing
- **Cell labels:** 14px, medium weight, bright foreground
- **Cell descriptions:** 13px, regular weight, muted foreground

#### Colors
- Uses existing CSS variables (`--void-bg-*`, `--void-fg-*`, `--void-border-*`)
- Maintains consistency with the rest of the application
- Subtle hover state (1.5% white overlay)

### 5. Tools Section Fix

**Problem:** Tool approval switches were left-aligned with text on the right, breaking consistency.

**Solution:** Wrapped each tool approval in a `SettingsCell` with:
- Proper label (e.g., "Auto-approve Code Edits")
- Clear description (e.g., "Allow the AI to make code changes without confirmation")
- Right-aligned switch
- Proper dividers between rows

Before:
```tsx
<ToolApprovalTypeSwitch
  approvalType={approvalType}
  desc={`Auto-approve ${approvalType}`}
/>
```

After:
```tsx
<SettingsCell
  label="Auto-approve Code Edits"
  description="Allow the AI to make code changes without confirmation"
  showDivider={index > 0}
>
  <VoidSwitch
    size='xs'
    value={settingsState.globalSettings.autoApprove[approvalType] ?? false}
    onChange={(newVal) => { /* ... */ }}
  />
</SettingsCell>
```

## Visual Comparison

### Before
- Flat list of settings
- No grouping or organization
- Inconsistent alignment
- Basic divs with minimal styling
- No visual hierarchy

### After
- Section-based card layout
- Logical grouping by feature area
- Consistent left/right alignment
- Professional card styling with borders and headers
- Clear visual hierarchy with sections, rows, and nested items

## Technical Details

### Build Process Note

The application uses `scope-tailwind` which adds a `void-` prefix to class names in JSX. CSS class names needed to match this:

- JSX: `className="settings-section"` → Becomes: `className="void-settings-section"`
- CSS: Must use `.void-settings-section` (with prefix)

### Files Modified

1. **src/styles.css** - Added new section-based styling (~90 lines)
2. **src/void-settings-tsx/Settings.tsx** - Added components and restructured layout (~200 lines changed)

### Dependencies
- No new dependencies added
- Uses existing components (`VoidSwitch`, `ModelDropdown`, etc.)
- Maintains all existing functionality

## Benefits

1. **Better Organization** - Settings grouped by logical categories
2. **Improved Scannability** - Clear sections make it easy to find settings
3. **Professional Appearance** - Matches modern app design patterns
4. **Consistent Layout** - All settings follow the same structure
5. **Better Descriptions** - More detailed explanations for each setting
6. **Visual Hierarchy** - Sections > Rows > Nested items clearly indicated

## Future Considerations

### Potential Enhancements
- Add search/filter functionality across settings
- Collapsible sections for advanced users
- Settings presets (e.g., "Safe Mode", "Power User")
- Import/export settings configuration

### Accessibility
- All interactive elements remain keyboard accessible
- Maintains existing aria labels and roles
- Color contrast ratios meet WCAG guidelines
- Screen reader compatible structure

## Testing Checklist

- [x] All switches work correctly
- [x] Nested dropdowns show/hide properly
- [x] Dividers appear correctly (not on first row)
- [x] Hover states work smoothly
- [x] Works in both light and dark mode
- [x] Consistent spacing throughout
- [x] ErrorBoundaries preserved
- [x] Tab navigation works properly

## Migration Notes

No migration needed - this is a pure UI change. All settings keys, storage, and functionality remain identical.

## References

Design inspired by:
- Cursor Settings UI
- VS Code Settings
- Modern app settings patterns

---

**Last Updated:** 2026-01-11
**Author:** Claude Code Assistant
