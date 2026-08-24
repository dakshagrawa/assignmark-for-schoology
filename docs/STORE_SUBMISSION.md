# Chrome Web Store submission guide

This guide is specific to **Assignmark: Schoology Checkoffs 2.1.1**. Recheck store policy pages before submission because dashboard fields and policies change.

## 1. Create the developer account

1. Choose a Google account that you can retain long-term. Google recommends a dedicated publishing account because important policy and takedown notices go to its developer email.[1]
2. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/), accept the developer agreement and policies, and pay the **one-time developer registration fee**.[1] Google's current public registration page does not state a fixed amount, so use the amount shown in the dashboard rather than relying on an old hard-coded figure (it has historically been USD $5).
3. Complete the account page: developer/publisher name, verified contact email, and any identity-verification prompts shown by Google.
4. Keep two-factor authentication enabled and retain recovery access to the publishing account.

## 2. Prepare and locally validate the package

```bash
npm ci
npm run check
```

Then load `load-unpacked/` from `chrome://extensions` in a clean profile and test on the real FUHSD Schoology calendar:

- canonical assignment link;
- event identified by a `data-*` attribute;
- linkless fallback event;
- check → calendar navigation → rerender → reload;
- uncheck;
- Dim; All/Pending/Done filters; scoped Clear view; global Clear all; and one-level Undo (including canceling each clear confirmation);
- browser console has no extension errors.

Upload `assignmark-for-schoology-2.1.1.zip`. `manifest.json` is at the ZIP root. The package contains one local MV3 service worker used only to serialize `chrome.storage.local` mutations across Schoology tabs; it contains no remote script, source map, secret, or test fixture.

## 3. Prepare listing assets separately

Prepare these yourself before opening the dashboard; do not reuse Schoology branding in a way that implies endorsement.

- concise extension name and summary;
- detailed description focused on the single purpose;
- screenshots from an authorized account with student names, course names, assignment details, avatars, notifications, and IDs redacted or replaced with safe demo data;
- the current logo/icon;
- any promotional tile images the dashboard requests;
- support email and, preferably, a public support/homepage URL;
- hosted privacy-policy URL;
- reviewer notes explaining where to find the Schoology calendar and that authentication is controlled by FUHSD/Schoology. If review requires access, use only the dashboard's approved secure mechanism and a non-sensitive test account authorized for that purpose.

A smooth review submission has an accurate single-purpose description, screenshots that demonstrate the actual current UI, no unverifiable claims, no keyword stuffing, no misleading affiliation, and disclosures that exactly match runtime behavior.

## 4. Privacy policy and dashboard disclosures

A privacy policy **is required here** because the extension handles user information derived from calendar content and stores completion state locally. Chrome requires disclosure even when data is processed or stored only on the device and never sent to a server.[4]

Do not paste a generic policy. Host a stable, publicly accessible policy URL and ensure it covers:

- **Data handled:** normalized calendar title/time/date/link or `data-*` identifiers used to derive hashed/mapped item IDs; completion timestamps; filter/Dim settings; legacy v1.2 values read once for migration.
- **Purpose:** only identifying calendar entries, retaining completion choices, and applying display preferences.
- **Storage/location:** `chrome.storage.local` in the user's browser profile; legacy Schoology `localStorage` is read for migration and is not deleted.
- **Transmission/sharing/sale:** no data is transmitted to the maintainer or third parties, sold, used for advertising, analytics, profiling, or unrelated purposes.
- **Retention/deletion:** data remains until the user presses Clear, removes the extension/its data, or clears extension storage; explain that Clear removes checkbox states but keeps display settings and the ID map.
- **Security:** no remote code or external API; least-privilege single-site operation.
- **User controls:** how to clear checkbox states, uninstall, and contact the maintainer about privacy questions.
- **Policy changes:** effective date and how material changes will be communicated.

Google says a policy generally needs to explain collection, use, disclosure, security, access/change/deletion, and retention; local-only products still need one.[4] Keep the policy, dashboard data-use checkboxes, permission justifications, listing, and actual behavior consistent.

Recommended dashboard answers for the current build:

- **Single purpose:** persistent completion controls for the FUHSD Schoology calendar.
- **`storage` justification:** retain checkbox states, ID reconciliation mappings, filter/Dim preferences, and conflict-safe mutations across Schoology tabs; migrate prior userscript values once.
- **Site access justification:** inject only on `https://fuhsd.schoology.com/*` so controls can be attached to that calendar. No broader host scope is requested.
- **Remote code:** No. All executable JavaScript ships in the ZIP. MV3 disallows remotely hosted executable code, and undeclared remote code is a rejection risk.[3]
- **Data handling:** disclose locally processed calendar-derived identifiers and preferences; indicate no external transmission. Chrome's privacy tab asks for purpose, permission justifications, remote-code declaration, data-use disclosures, certifications, and a privacy-policy link.[3]

## 5. Submit in the Developer Dashboard

1. Click **New item** and upload the production ZIP. Google creates the item in the dashboard after upload.[2]
2. Complete **Store listing**: descriptions, category/language, icon, screenshots, and promotional assets.
3. Complete **Privacy practices** with the single purpose, `storage` justification, site-access explanation, no-remote-code declaration, data-use answers/certifications, and privacy-policy URL.[3]
4. Complete **Distribution**: visibility and regions. Start with public only when the listing and support path are ready.
5. Add reviewer instructions only if needed. Do not include personal credentials.
6. Resolve every dashboard warning, then click **Submit for review**.[2]
7. Choose automatic publishing or deferred publishing. With deferred publishing, Google states that an approved staged submission must be published within 30 days or it returns to draft.[2]
8. Monitor the developer email and dashboard. If rejected, address the cited policy/technical issue precisely, upload a bumped version if the package changed, and resubmit. Do not attempt to evade review.

## 6. Review concerns specific to this extension

- **Single-site scope:** the content script match is limited to FUHSD Schoology. Avoid `<all_urls>` and unrelated host permissions.
- **`storage` permission:** necessary and explainable; the local service worker adds no named permission, and there are no tabs, activeTab, identity, cookies, webRequest, scripting, or downloads permissions.
- **Student/calendar data:** even local-only derivation must be disclosed. Screenshots must not expose student records.
- **No remote code:** icons, CSS, and the bundled script are all packaged locally.
- **No affiliation claim:** describe compatibility with FUHSD Schoology without claiming that FUHSD or PowerSchool/Schoology created or endorsed it.
- **Authentication:** the extension does not bypass login or collect credentials; it runs after the user accesses Schoology normally.

## 7. Edge Add-ons and Firefox AMO later

### Microsoft Edge Add-ons

Register for the Microsoft Edge program through Partner Center using a Microsoft account and select an **Individual** account if publishing personally. Microsoft currently states there is no Edge extension registration fee.[5] Reuse the Chromium MV3 package after Edge validation, then complete Partner Center listing, privacy, markets, and certification fields. Expect Microsoft-specific account verification and policy checks even if Chrome already approved the extension.

### Firefox AMO

Create/sign in to an AMO developer account, upload the ZIP/XPI, pass automated validation, select platforms, provide listing metadata and reviewer notes, and submit for signing/review.[6] Add a stable `browser_specific_settings.gecko.id` before a long-lived Firefox release (AMO can generate one if omitted, but an explicit ID makes local packaging and identity management predictable).[7] Run `web-ext lint`, verify MV3 and CSS/DOM behavior in Firefox, and adapt the storage namespace with a compatibility layer/polyfill. AMO's privacy-policy trigger and data declarations are not identical to Chrome's; answer the current AMO form based on actual local-only behavior rather than copying Chrome answers.

## Sources

[1] https://developer.chrome.com/docs/webstore/register
[2] https://developer.chrome.com/docs/webstore/publish
[3] https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
[4] https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
[5] https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account
[6] https://extensionworkshop.com/documentation/publish/submitting-an-add-on
[7] https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id
