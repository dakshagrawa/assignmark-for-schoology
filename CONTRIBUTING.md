# Contributing

This project currently has one maintainer. Before opening a pull request:

1. Open an issue for behavior changes or new permissions.
2. Keep the extension single-purpose and avoid remote code or new host access.
3. Add or update a regression test before changing ID or persistence behavior.
4. Run `npm ci && npm run check`.
5. Describe manual Chrome testing, including a reload/persistence check.
6. Never commit Schoology credentials, cookies, student data, screenshots with private information, or `.env` files.

Use readable ES modules in `src/`; the generated bundle in `dist/` is not committed.
