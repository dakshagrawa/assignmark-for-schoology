# Changelog

All notable changes to Assignmark are documented here.

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
