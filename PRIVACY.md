# Privacy statement for Assignmark: Schoology Checkoffs

**Effective date:** September 6, 2026  
**Project status:** Independent, unofficial student project. Assignmark is not affiliated with, endorsed by, or operated for Fremont Union High School District, PowerSchool, or Schoology.

## Summary

Assignmark is a local-only Chrome extension that lets a user mark visible Schoology calendar items as personally completed. It does not transmit personal information, analytics, calendar contents, credentials, or usage data to the maintainer or any third party.

## Information handled locally

To provide its single purpose, the extension may process and store the following in the user's browser profile:

- normalized identifiers derived from the Schoology calendar item currently rendered in the user's browser, such as a calendar link, an item identifier exposed by the page, title/date/time context, or a fallback identifier;
- the user's personal completion choices and timestamps for those locally identified items;
- display preferences, including filters, fade preference, accent color, control size, visible controls, and calendar-control position;
- predecessor userscript values read once for migration when Assignmark storage is empty.

This information remains in `chrome.storage.local` in the user's local browser profile. The older userscript's `localStorage` is read only for migration and is not deleted automatically.

## Information not collected or transmitted

Assignmark does not:

- collect or transmit Schoology usernames, passwords, cookies, access tokens, or OAuth credentials;
- call the Schoology API, scrape grade pages, retrieve grades, submit work, or modify Schoology records;
- send calendar information, completion state, diagnostics, analytics, telemetry, advertising identifiers, or usage data to a server;
- sell, share, rent, or use information for advertising, profiling, or any unrelated purpose;
- include remote executable code or make runtime network requests.

## Permissions and site access

The extension requests only Chrome's `storage` permission. Its content script is limited to `https://fuhsd.schoology.com/*`, where it can add the local completion controls after the user has already signed in through the normal Schoology experience.

## Retention and deletion

Local completion state remains until the user:

- uses **Reset view** or **Reset all checkoffs** in Assignmark;
- clears the extension's local data through Chrome; or
- removes the extension.

Resetting checkoffs does not necessarily reset display preferences or internal identifier mappings. Removing the extension or clearing its extension storage removes those local values.

## Security limits

Assignmark's privacy model depends on the user's device and browser profile remaining protected. It is not a replacement for Schoology, district, or browser security controls. The extension intentionally contains no server-side service or API credential.

## Changes and contact

Material changes to this statement will be reflected in this file and the repository history. For project questions, open a GitHub Issue in the repository. Do not include student records, passwords, cookies, API tokens, or identifiable Schoology screenshots in an issue.
