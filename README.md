# Assignmark: Schoology Checkoffs

Assignmark is a Manifest V3 browser extension for personal completion checkoffs in Schoology. Version 2.2 combines persistent calendar checkboxes with a compact v2.0-style action rail, an Apple-inspired extension settings popup, locally customizable accent colors, explicit reset scopes, one-level Undo, and cross-tab-safe local storage coordination at `https://fuhsd.schoology.com/*`.

## Features

- Injects one checkbox per FullCalendar assignment/event as Schoology renders it.
- Resolves canonical IDs from assignment/event links and `data-*` identifiers.
- Falls back to a content + DOM-path fingerprint while maintaining semantic aliases and a persistent ID map across rerenders.
- Keeps checked states through page reloads, calendar navigation, and DOM replacement.
- Keeps the in-calendar rail focused on three contextual actions: **Hide done**, **Fade done**, and **Reset view**. Reset view disables itself when there is nothing to reset and reports exactly what changed.
- Opens a settings popup from the extension toolbar for **All / To do / Done**, **Fade completed**, accent-color customization, explicit all-date **Reset all checkoffs**, and conflict-safe **Undo**.
- Bundles the MIT-licensed Coloris picker locally; no CDN, remote executable code, or runtime network request is used.
- Migrates the v1.2 userscript's existing `localStorage` states, settings, and ID map on first Schoology connection—even if the toolbar popup was opened first.
- Makes no network requests and contains no remote executable code.

## Why `chrome.storage.local`

The userscript used Schoology-origin `localStorage`. The extension uses `chrome.storage.local` because it is extension-owned and survives Schoology site-data cleanup. A minimal local MV3 service worker serializes mutations from every Schoology tab; content scripts communicate through a small storage client. `storage` is the extension's only named permission.

Existing v1.2 data is imported once when no extension data exists. It is not deleted from Schoology `localStorage`, so rollback to the userscript remains possible.

## Reliability fix

The original implementation had three state-loss risks:

1. Canonical lookup could climb into a shared calendar ancestor and accidentally borrow a sibling assignment's link, causing unrelated events to share an ID.
2. The fallback ID included sibling indexes, so an otherwise identical event could receive a different fingerprint after a Schoology rerender.
3. Repeated whole-object reads, migration writes, and alias deletion could interleave conceptually and overwrite valid data.

The extension bounds canonical lookup to the current event, maps both legacy path fingerprints and rerender-stable semantic aliases, distinguishes duplicate events by occurrence, merges checked timestamps atomically, and serializes all storage mutations. Regression tests cover shifted DOM paths and sibling-ID contamination.

## Project structure

```text
legacy/Schoology Calendar Assignment Checker-1.2.user.js
                              Unmodified original userscript (SHA-256 preserved)
manifest.json                 Chrome MV3 manifest
src/content.js                Calendar injection, controls, observers, error UI
src/content.css               Injected calendar and control-center styles
src/core.js                   ID resolution and serialized persistence
src/background.js             Cross-tab storage mutation coordinator
src/storage-client.js         Content-script storage protocol client
src/calendar-adapter.js       Calendar discovery and current-view registry
src/control-center.js         Filter/progress/action UI
src/popup.html                Extension-toolbar settings popup shell
src/popup.js                  Popup runtime and local Coloris initialization
src/popup-ui.js               Tested settings UI component
src/popup-controller.js       Serialized settings/reset coordination
THIRD_PARTY_NOTICES.md        Bundled open-source component notices
icons/                        16/32/48/128 px extension icons
scripts/build.mjs             Bundle, validate manifest, and create store ZIP
test/core.test.js             Node/jsdom unit and regression tests
test/fixture.html             Browser runtime fixture
docs/STORE_SUBMISSION.md      Chrome submission and privacy checklist
```

The background service worker performs local storage coordination only. It makes no network requests and adds no named permission.

## Development

Requirements: Node.js 20+ and npm.

```bash
npm install
npm test
npm run build
```

- **Ready-to-load Chrome folder:** `load-unpacked/` is committed to the repository so users can clone or download the source and load it immediately. Running `npm run build` refreshes this folder.
- **Store ZIP:** `assignmark-for-schoology-2.2.3.zip`.

`npm run build` creates:

- `load-unpacked/` — ready to select with Chrome's **Load unpacked** button
- `dist/release/` — identical packaged runtime directory used to create the store ZIP
- `assignmark-for-schoology-2.2.3.zip` — uploadable Chrome Web Store package

`npm run check` runs the complete test suite and production build.

## Load unpacked in Chrome

1. Clone this repository or download and extract its source archive. The committed `load-unpacked/` folder is ready to use; developers can refresh it with `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and choose the repository's `load-unpacked/` folder.
5. Open the FUHSD Schoology calendar and confirm each item receives one checkbox.
6. Check both canonical and linkless events, navigate calendar views, and reload to verify persistence.
7. Test the calendar rail's **Hide done**, **Fade done**, and **Reset view** controls. Confirm Reset view is disabled with zero completed items and becomes available after checking an item.
8. Click the Assignmark toolbar icon and test **All / To do / Done**, **Fade completed**, accent colors, **Reset all checkoffs**, and **Undo**. Reset view and Reset all each use count-specific scope wording.

The developer must use their own authorized Schoology session. No credentials belong in this repository or in reviewer notes unless the store explicitly provides a secure reviewer-credential field.

## Calendar rail and settings popup

Contextual actions remain beside the calendar: Hide done, Fade done, and Reset view. The settings popup also lets users choose which of those buttons are visible, set their size from 80% to 120% (100% default), enable temporary Move controls mode, and reset these preferences to defaults without deleting saved checkoffs. Global preferences and destructive all-date reset live in the extension-toolbar popup so the calendar stays uncluttered and the two reset scopes cannot be mistaken for each other.

## Browser portability

- **Chrome / Edge:** both are Chromium-based and can use this MV3 package and `chrome.*` promise APIs with minimal or no source changes. Validate the package separately in each store.
- **Firefox:** keep the core code unchanged, but add a small API adapter or `webextension-polyfill` if targeting `browser.*` promises. Add `browser_specific_settings.gecko.id` before locking the AMO identity, and run `web-ext lint`. Verify Firefox's current MV3 content-script host permission and data-collection declaration requirements at submission time.
- Do not add `host_permissions` unless a future feature needs host access outside the existing single-site content script match. Do not add remote code, analytics, or external requests without revisiting permissions, disclosures, and the privacy policy.

## Release checklist

- Bump `version` in both `package.json` and `manifest.json`.
- Run `npm ci && npm run check`.
- Load `load-unpacked/` in a clean Chrome profile and repeat the manual persistence checks.
- Inspect the ZIP: `manifest.json` must be at its root.
- Update screenshots and disclosures if behavior, permissions, or data handling changed.
- Follow [the store submission guide](docs/STORE_SUBMISSION.md).

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Daksh Agrawal.
