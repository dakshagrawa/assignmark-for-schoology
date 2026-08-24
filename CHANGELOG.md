## 2.2.2 — 2026-08-24

### Fixed

- Move controls mode now disables and guards all normal rail actions, including keyboard/programmatic activation, until the position is locked.
- Updated store/privacy disclosure guidance to include persisted control scale, visibility, move-mode state, and rail position.

## 2.2.1 — 2026-08-24

### Changed

- Increased the three integrated calendar primary controls to `60×60px` touch targets at the user's request while preserving the compact right-side rail.
- Added a 80%–120% button-size slider (100% default), per-button visibility checkboxes, temporary pointer-capture move mode with a persisted lockable position, browser-theme-aware settings, and a settings-only reset-to-defaults action that preserves saved checkoffs.


### Added

- Extension-toolbar settings popup with Apple-inspired light/dark surfaces, All / To do / Done filtering, a clearly explained Fade completed switch, and local accent-color customization.
- Locally bundled, MIT-licensed Coloris color picker with six curated presets and validated six-digit hex input.
- Count-specific success feedback for current-view reset and all-date reset, with conflict-safe one-level Undo.

### Changed

- Restored the focused v2.0-style three-action calendar rail: Hide done, Fade done, and Reset view.
- Moved global Reset all checkoffs into the settings popup, where its all-date scope and affected count are explicit.
- Replaced the ambiguous Dim wording with Fade done / Fade completed and an explanation that fading never hides, deletes, or unchecks an item.
- Added adaptive dark/light calendar surfaces, consistent icons, compact labels, keyboard focus, and a user-selected accent color.

### Fixed

- Reset view now disables itself when there are no completed items in the current rendered calendar scope instead of appearing to do nothing.
- Reset view now reports the number of checkoffs actually changed and makes Undo visible after a successful operation.
- Popup-first startup no longer blocks the later one-time import of legacy userscript checkoffs and settings.
- Current-view and all-date resets ignore rapid repeat activation, keep a valid Undo snapshot, and report zero/conflict outcomes honestly.
- Extreme custom accents now derive a contrasting foreground while keyboard focus uses an accent-independent two-tone ring.
- The short-viewport rail scrolls internally rather than clipping controls.

### Security and privacy

- Named permissions remain exactly `storage`; no `tabs`, `activeTab`, or additional host permissions were added.
- Content-script scope remains exactly `https://fuhsd.schoology.com/*`.
- Coloris ships inside the extension package; no remote code, CDN, analytics, or external request was added.

## 2.1.1 — 2026-08-23

### Fixed

- Replaced the wide bottom-right control panel, which could cover calendar cells, with a narrow previous-style vertical rail at the far right.
- Reduced visible progress to a compact `completed/total` count while preserving the full current-view description for assistive technology and tooltips.
- Retained All/Pending/Done filters, Dim, scoped/global clearing, Undo, collapse behavior, and keyboard-visible focus in the compact layout.

## 2.1.0 — 2026-08-23

### Added

- Compact, accessible calendar control center with current-view progress.
- All, Pending, and Done filters plus an independent Dim toggle.
- Explicit current-view and global clear actions with count-specific confirmation.
- One-level Undo with conflict-safe state versions that follow fallback-to-canonical ID migration.
- Calendar adapter and rendered-item registry seams for safer future Schoology-surface expansion.
- Local Manifest V3 service worker that serializes storage mutations across Schoology tabs.

### Changed

- Batched ID reconciliation writes at most once per changed scan and performs no write for an unchanged scan.
- Filter is now the sole visibility authority; legacy Hide data remains migration-compatible but does not independently hide items.
- Progress wording explicitly refers to current-view items.
- The control center is recreated after calendar DOM replacement and removed when the calendar leaves the page.

### Fixed

- Prevented stale cross-tab mutations and ID reconciliation from overwriting newer checkoffs.
- Restricted canonical-ID lookup to the current calendar event.
- Preserved state through fallback-to-canonical reconciliation and harmless DOM rerenders.
- Prevented Clear All from deleting states added or changed after its confirmation snapshot.
- Prevented Undo from resurrecting states superseded by a newer check or uncheck.

### Security and privacy

- Named permissions remain limited to `storage`.
- Content-script scope remains limited to `https://fuhsd.schoology.com/*`.
- No remote code, analytics, external application requests, credentials, or cross-device synchronization were added.

## 2.0.0 — 2026-08-23

### Added

- Initial Manifest V3 extension baseline migrated from the preserved v1.2 userscript.
- Persistent personal Schoology calendar checkoffs backed by `chrome.storage.local`.
- One-time import of v1.2 page-storage data without deleting the legacy source.
- Canonical and compatibility fallback IDs with regression-tested reconciliation.
- Reproducible build, unpacked output, store ZIP, CI workflow, and store-submission guidance.
