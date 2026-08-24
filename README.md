# Assignmark: Schoology Checkoffs

Assignmark is a Manifest V3 browser extension for personal completion checkoffs in Schoology. Version 2.1 adds persistent calendar checkboxes plus a current-view control center with progress, All/Pending/Done filters, scoped and global clearing, one-level Undo, and cross-tab-safe local storage coordination at `https://fuhsd.schoology.com/*`; later versions will carefully extend the same canonical state across other Schoology assignment listings.

## Features

- Injects one checkbox per FullCalendar assignment/event as Schoology renders it.
- Resolves canonical IDs from assignment/event links and `data-*` identifiers.
- Falls back to a content + DOM-path fingerprint while maintaining semantic aliases and a persistent ID map across rerenders.
- Keeps checked states through page reloads, calendar navigation, and DOM replacement.
- Provides the original in-calendar **Hide**, **Dim**, and **Clear** controls.
- Migrates the v1.2 userscript's existing `localStorage` states, settings, and ID map on first extension run.
- Makes no network requests and contains no remote executable code.

## Why `chrome.storage.local`

The userscript used Schoology-origin `localStorage`. The extension uses `chrome.storage.local` because it is extension-owned, survives Schoology site-data cleanup, and provides a portable WebExtension storage API. The content script loads one in-memory snapshot and serializes every mutation before writing it, preventing stale read-modify-write operations from overwriting newer state. `storage` is the extension's only named permission.

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
src/content.css               Injected calendar and toolbar styles
src/core.js                   ID resolution and serialized persistence
icons/                        16/32/48/128 px extension icons
scripts/build.mjs             Bundle, validate manifest, and create store ZIP
test/core.test.js             Node/jsdom unit and regression tests
test/fixture.html             Browser runtime fixture
docs/STORE_SUBMISSION.md      Chrome submission and privacy checklist
```

A background service worker is intentionally absent: all behavior is page-local and the content script can use extension storage directly.

## Development

Requirements: Node.js 20+ and npm.

```bash
npm install
npm test
npm run build
```

- **Load-unpacked directory:** choose `load-unpacked/` after running `npm run build`.
- **Store ZIP:** `assignmark-for-schoology-2.1.0.zip`.

`npm run build` creates:

- `load-unpacked/` — ready to select with Chrome's **Load unpacked** button
- `dist/release/` — identical packaged runtime directory used to create the store ZIP
- `assignmark-for-schoology-2.1.0.zip` — uploadable Chrome Web Store package

`npm run check` runs the complete test suite and production build.

## Load unpacked in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and choose `/home/daksh/assignmark-for-schoology/load-unpacked/` (or the `load-unpacked/` folder in your checkout).
5. Open the FUHSD Schoology calendar and confirm each item receives one checkbox.
6. Check both canonical and linkless events, navigate calendar views, and reload to verify persistence.
7. Test **Dim**, **Hide**, and **Clear**. Clear requires confirmation.

The developer must use their own authorized Schoology session. No credentials belong in this repository or in reviewer notes unless the store explicitly provides a secure reviewer-credential field.

## Toolbar vs. options page

The controls remain in the in-page toolbar. They are three calendar-specific actions whose effect is easiest to understand beside the calendar. A separate options page would add navigation and maintenance surface without improving the workflow. Do not build both unless future settings become complex or need configuration away from Schoology.

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

No open-source license has been selected yet. Add one before inviting external reuse or contributions.
