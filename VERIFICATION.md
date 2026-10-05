# Delivery verification — 2026-10-05

## Passed

- TypeScript strict type checking and Vite production build.
- Production build with `VITE_BASE_PATH=/expense-tracker/`; generated HTML references `/expense-tracker/assets/...` correctly.
- **17 Vitest tests**: 9 domain tests and 8 database tests.
- Actual migration executed in PGlite, an embedded PostgreSQL engine. Tested authenticated A/B roles, RLS read/write behavior, ownership reassignment rejection, foreign-category rejection, anonymous denial, database constraints, save/edit/delete idempotency, stale-edit conflict, historical budgets and transactional import rollback.
- **6 Playwright tests** across desktop (1440 × 1000) and mobile (390 × 844) projects.
- Browser workflows: add, invalid amount with retained input, edit, delete cancellation and confirmation, search, annual→monthly→daily drill-down, over-budget state, themes, category creation/rename and malformed JSON rejection.
- Mocked Supabase HTTP tests: email/password login UI, failed online save retaining input, double-click retry resulting in one expense, second browser context refresh, session/navigation preserved across page reload. These deliberately use API stubs and do not establish that hosted Supabase works.
- Desktop/mobile dashboard and mobile expense-dialog screenshots visually inspected; light/dark themes checked. Horizontal document overflow checked in mobile/desktop workflows.

## Environment detail

Playwright's browser CDN download returned invalid/truncated archives in the execution environment. UI tests were successfully run with the Chromium binary distributed by `@sparticuz/chromium` instead. The optional Linux fallback is reproducible with:

```bash
node scripts/local-browser-tests.mjs
```

The GitHub Actions workflow uses Playwright's normal Chromium installer on GitHub's runner. The fallback changes only the test browser, not production code.

## Not verified live

No Supabase project configuration or destination GitHub repository was supplied. Consequently, no real account data was created and the application has **not been deployed to GitHub Pages**.

These checks remain after account setup:

- Actual Supabase email delivery, registration confirmation and password-reset callback.
- Hosted Supabase Auth/JWT integration with the migrated RLS policies.
- Real Realtime WebSocket updates and automatic cross-device refresh over separate internet connections.
- The GitHub Actions run and public production URL on the user's repository.
- Real devices/Safari/Firefox, browser zoom and assistive-technology audit (Chromium viewport tests are not a complete accessibility audit).

Follow README.md for exact setup and a two-user/two-device acceptance checklist. No production secrets or user financial records are included.
