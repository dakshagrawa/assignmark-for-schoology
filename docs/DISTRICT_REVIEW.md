# Assignmark district review brief

**Project:** Assignmark: Schoology Checkoffs  
**Maintainer:** Daksh Agrawal, Monta Vista High School student developer  
**Status:** Unofficial, local-only Chrome extension prototype. It is not affiliated with, endorsed by, or operated for Fremont Union High School District, PowerSchool, or Schoology.

## Purpose

Assignmark adds personal completion checkboxes and display controls to the existing FUHSD Schoology calendar. It helps a student organize their own visible assignments after they have signed in to Schoology normally.

It is deliberately not a gradebook, student-information-system integration, or data-export tool.

## What the extension does

- Adds one local checkbox beside a rendered Schoology calendar item.
- Persists the user's completion choices and display preferences in the browser's `chrome.storage.local`.
- Provides local controls to hide or fade completed items, reset current-view checkoffs, and undo one reset.
- Imports the predecessor userscript's local checkoff state once, when extension storage is empty.

## What it does **not** do

- Does not request, store, transmit, or proxy Schoology passwords.
- Does not read or copy browser cookies.
- Does not call the Schoology API, perform OAuth, or contain a Schoology consumer key or secret.
- Does not retrieve grades, submit assignments, alter Schoology records, or access another user's data.
- Does not send analytics, telemetry, advertising identifiers, or calendar data to a server.
- Does not make runtime network requests.

## Technical boundary

| Area | Current implementation |
| --- | --- |
| Browser platform | Chrome Manifest V3 extension |
| Site scope | `https://fuhsd.schoology.com/*` only |
| Named permission | `storage` only |
| Background component | Local `chrome.storage.local` mutation coordinator; no network behavior |
| Data location | The student's local browser profile |
| Remote code | None; executable code ships in the extension package |
| Authentication | The student signs in to Schoology through the normal Schoology/FUHSD experience before the extension runs |

The [manifest](../manifest.json) and [privacy statement](../PRIVACY.md) are the source of truth for these limits. The [OAuth boundary document](SCHOOLOGY_OAUTH.md) explains why a consumer secret or OAuth implementation does not belong in a distributed extension.

## Verification performed for version 2.2.4

- `npm run check` — **108 passing automated tests** and a successful production build.
- `npm audit --audit-level=high` — **0 vulnerabilities reported**.
- Production ZIP inspected: contains packaged runtime assets, manifest, icons, license, and third-party notices; no source maps, test fixtures, credentials, or configuration secrets.
- Manifest checked: one named permission (`storage`) and one Schoology content-script match.

Automated tests cover identity resolution, storage persistence, cross-tab mutation coordination, reset/undo behavior, settings controls, and extension-context invalidation. A real authorized Schoology session is still required for any institution-specific acceptance testing.

## Review requests

This repository is shared for technical and privacy feedback. It does **not** request district deployment, API credentials, student records, or access to a production test account.

Questions or issues can be opened through this repository's GitHub Issues. Please do not include student data, credentials, cookies, or screenshots containing identifiable Schoology information.
