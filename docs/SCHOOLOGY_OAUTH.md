# Schoology OAuth integration boundary

This document records the guidance from the Schoology OAuth documentation and how it applies to Assignmark.

## What Schoology documents

Schoology's API documentation describes OAuth 1.0 authentication. The documented three-legged flow is:

1. Identify the user through the application's normal login/session flow.
2. Look up previously stored access tokens and validate them with an API request.
3. If no valid access token exists, request a temporary request token.
4. Send the user to Schoology's authorization endpoint with the request token and a callback URL.
5. Validate the returned request token, exchange it for an access token, and persist the resulting token pair securely.
6. Sign API requests with the consumer key/secret, token key/secret, a fresh nonce, a current timestamp, and the required OAuth 1.0 parameters.

The documentation also warns that redirected requests must be re-signed with a new nonce and timestamp. Two-legged OAuth is intended for an application acting only on behalf of the same administrator who owns the consumer key.

Source: <https://developers.schoology.com/api-documentation/authentication/>

## Why Assignmark does not perform OAuth

Assignmark currently has a narrower, intentional contract:

- It runs as a local-only browser extension after the user has already opened Schoology normally.
- It makes no external network requests.
- It stores completion state and preferences in `chrome.storage.local`.
- Its only named permission is `storage`, and its only content-script match is `https://fuhsd.schoology.com/*`.
- It must never contain a Schoology consumer secret, access token, or user password.

A consumer secret cannot be protected inside a distributed browser extension. Implementing the OAuth flow in the extension would require changing the privacy model, adding network/API behavior, revisiting permissions and disclosures, and introducing a trusted server or another approved secret-management boundary. Those changes are outside Assignmark's current purpose and would not be a safe interpretation of the documentation link.

The extension therefore does **not** bypass Schoology login, collect Schoology credentials, request API tokens, or claim Schoology API access.

## Requirements for a future API-backed product

If a future product needs Schoology API data, implement it as a separately reviewed service rather than placing secrets in this extension. At minimum, that service must:

- register an approved Schoology application and keep the consumer secret outside client code;
- use HTTPS and a strict, registered callback URL;
- generate a unique nonce and current timestamp for every signed request;
- validate the callback token against the stored request-token record before exchanging it;
- store access-token pairs in protected server-side storage associated with the authenticated user;
- discard and re-authorize revoked tokens after a confirmed 401 response;
- regenerate OAuth parameters and signatures after redirects;
- define the minimum API scope and data-retention policy before changing any client permissions or disclosures.

Until those prerequisites are approved and implemented, Assignmark remains a local completion-checkoff extension and continues to use the user's existing Schoology session without API authentication.
