# Everyday — personal expense tracker

A complete React + TypeScript expense tracker for GitHub Pages, with Supabase email/password authentication and private online PostgreSQL storage. Use the same account from your phone or laptop on **any internet connection**. You do not need a home server or the same Wi-Fi network.

This project tracks **expenses only**. No investment advice, tasks, habits, or study goals.

## What is included

- Fast expense entry in rupees, date, category, description, payment method, merchant and notes.
- Editable expenses, confirmed deletion, archived/renamed categories.
- Dashboard, daily/monthly/yearly reporting, category percentages, charts and drill-down.
- Current-month comparison of equivalent elapsed periods, including correct February handling.
- Independent monthly overall/category budgets and over-budget indicators.
- Search, date/category/payment/amount filters, safe CSV export.
- Full JSON backup and validated, additive, atomic JSON import with preview and duplicate prevention.
- Registration, login, logout, email confirmation, password reset and cross-device refresh.
- Light/dark themes, responsive navigation, native keyboard-accessible dialogs.
- A separate, clearly labeled **in-memory demo**. No demo expense is sent to Supabase.
- PostgreSQL migration, tests, environment template and GitHub Actions deployment.

## 1. Create your Supabase project

1. Sign in at https://supabase.com/dashboard and create a project. Choose a nearby region. Keep the database password private: the frontend does **not** need it.
2. Wait for the database to initialize.
3. Open **SQL Editor → New query**.
4. Open `supabase/migrations/001_expenses.sql` from this project, copy the entire file into the editor, and run it **once**. It creates all tables, indexes, constraints, RLS policies and RPC functions. It also adds tables to `supabase_realtime` when that publication exists.
5. Open **Authentication → Sign In / Providers → Email** (the label may be “Providers”). Enable Email and password sign-in and allow new signups. Keep email confirmation enabled. Set a minimum password length of at least 8.
6. Open the project **Connect** dialog or **Settings → API Keys**. Copy:
   - Project URL, for example `https://abcdefgh.supabase.co`.
   - **Publishable key**, starting `sb_publishable_...`. A legacy `anon` key also works.
7. Never copy a `service_role`, `sb_secret_...` key, database connection string or database password into this application, GitHub variables, or browser code. Publishable/anon keys are intentionally public; the database RLS policies protect your data.

## 2. Run on your laptop first

Install Node.js 24 LTS and Git, then extract this project and open a terminal inside its folder:

```bash
npm ci
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

Edit `.env`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_ACTUAL_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ACTUAL_PUBLISHABLE_KEY
VITE_BASE_PATH=/
```

Then:

```bash
npm run dev
```

Open `http://localhost:5173/`. Without configuration, the app shows setup guidance and offers a separate demo; real login is disabled.

### Configure authentication redirects

In **Supabase → Authentication → URL Configuration**:

- During initial local setup, set **Site URL** to `http://localhost:5173/`.
- Add `http://localhost:5173/` to **Redirect URLs**.
- If you use `127.0.0.1`, also add `http://127.0.0.1:5173/`.
- Once deployed, change **Site URL** to your exact production URL including the repository path and trailing slash, e.g. `https://YOUR_USERNAME.github.io/expense-tracker/`.
- Add that same exact production URL to **Redirect URLs**. Keep localhost for development.
- For a custom domain, use its exact HTTPS URL instead, normally `https://expenses.example.com/`.

The app derives its email confirmation and password-reset redirect from the deployed Vite base path. It uses query-based navigation such as `?view=Reports`, so refreshing a page stays on the same GitHub Pages entry point. Supabase's hash-based auth callback can be processed without a hash-router conflict.

Create your account, confirm the email, and sign in. First sign-in creates only the default **categories**, never sample expenses. If you plan regular production use, configure your own SMTP provider in Supabase Authentication and test email delivery; the built-in email service has delivery restrictions and rate limits.

## 3. Put the code on GitHub

1. At https://github.com/new create a repository named **expense-tracker**. A public repository is the simplest GitHub Pages option. Source code is public; your expense rows remain in your private Supabase account. Do not upload `.env` or backups of your personal expenses.
2. Do not initialize the repository with another README if using these commands.
3. In the extracted project folder:

```bash
git init
git add .
git commit -m "Build personal expense tracker"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/expense-tracker.git
```

4. In your GitHub repository open **Settings → Secrets and variables → Actions → Variables → New repository variable**. Add these two repository variables:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Your project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your publishable key (or legacy anon key) |

Use **Variables**, not Secrets, for this supplied workflow. These values will be included in the public JavaScript bundle. Never use secret or service-role keys here.

5. Open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
6. Push the code:

```bash
git push -u origin main
```

7. Open **Actions → Test and deploy to GitHub Pages**. It runs unit/database tests, Chromium UI tests, a production build, and deployment. When green, the `deploy` job shows your website URL. You can rerun it with **Run workflow** after fixing configuration.
8. Add the URL to Supabase authentication redirects as described above.
9. Open `https://YOUR_USERNAME.github.io/expense-tracker/` on your phone, sign in, and add an expense. Open the same URL and account on a laptop. Changes should appear promptly, or within 20 seconds while the tab is visible.

The workflow gets the correct repository/custom-domain base path from `actions/configure-pages`; do not hardcode it in the app. A local manual production build for a project Pages URL can use `VITE_BASE_PATH=/expense-tracker/ npm run build` on Linux/macOS. On PowerShell: `$env:VITE_BASE_PATH='/expense-tracker/'; npm run build`.

## 4. Everyday use

- **Dashboard**: today's, month's and year's spending, remaining monthly budget, monthly categories, recent expenses.
- **Expenses**: search description, merchant or notes; combine category, method, date and amount filters. CSV contains exactly the filtered results.
- **Reports**: daily list and categories; month totals/categories/daily chart/comparison; yearly totals, month chart and category breakdown. Select a chart bar to drill down.
- **Budgets**: choose the month first. Set an overall budget or category budgets independently. Overall and category budgets are not added together. Leave a budget amount blank and save to remove it.
- **Settings**: rename/archive/restore categories, switch theme, sign out, export/import backup.
- Expenses are purchases. Select “Credit card” on a purchase; do **not** record its bill repayment again. Transfers between your own accounts are not expenses. The app cannot infer a bank transaction's meaning from a free-text description; correct categorization is your responsibility.
- You can enter past expenses. Calendar date is a plain PostgreSQL `date` (`YYYY-MM-DD`), not a timestamp. Default “today” is calculated in Asia/Kolkata.
- Future-dated records are allowed, count in their selected month/year totals, and are excluded from current-year average when their month has not arrived. A current-month comparison uses only records through today's date.
- Current-year average uses January through the current month, including zero-spend months and the partial current month; past years use all 12 months. Future years show zero elapsed months.

## Backup/import behavior

A version 1 JSON export includes expenses, categories (including archived ones), and budgets, with integer `amount_paise`. It excludes authentication tokens, passwords and user IDs. Backups contain your private financial data: store them securely.

Imports are limited to 20 MB, 50,000 expenses, 500 categories and 10,000 budgets per file. The preview validates dates, IDs, money, payment methods, text lengths and category references. Nothing is written until you confirm. Categories match by case-insensitive trimmed name; existing names and archived states are not overwritten. New categories are created with fresh IDs and references remapped. Existing month/category budgets are kept.

Expenses are skipped if their ID already exists or their date, amount, category, description, payment method, merchant and notes match (text comparisons ignore case/outer whitespace). Identical purchases are deliberately considered duplicates during import; manual entry can record legitimate identical separate purchases. Deleted expense tombstones also prevent backup retries from resurrecting records. Import is one database transaction, so a bad row rolls back the whole import. Repeating an import is safe. A UUID collision belonging to another account fails the transaction rather than updating that account.

## Synchronization and failure behavior

The online database is the source of truth. Saved records are not stored in browser-only storage. Supabase persists its authenticated session locally; theme preference is also local. Demo data is memory-only and disappears on exit/reload.

After every successful write, the app reloads a consistent database snapshot. Realtime subscriptions request refreshes on changes. A 20-second visible-tab timer plus focus, visibility and network reconnect refreshes provide a fallback, including deletions. The snapshot RPC avoids the REST API's usual per-query row limit. This design targets a personal ledger loaded in memory; very large multi-year datasets may eventually need server aggregation/pagination.

A failed write leaves the expense form and stable UUID in memory and offers Retry. Double-submit protection and database idempotency prevent repeated taps/retries from duplicating a new expense. Closing the browser or reloading discards unsaved input; this is not an offline-first app. Edits carry a version and reject stale concurrent changes rather than silently overwriting them. If a save succeeded but the refresh failed, the page tells you data is stale and offers refresh. Do not re-enter a purchase as a new expense to work around a connection failure; retry the existing form or refresh first.

Deletion uses a database tombstone so a delayed retry cannot recreate the same expense. Tombstones are hidden from reports and exports. RLS restricts them to their owner just like active expenses. Category deletion is intentionally replaced by archive to preserve historical labels and references.

## Security implementation

All three tables enable RLS and explicitly check `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE. UPDATE policies check both the old row and new owner. Composite foreign keys `(user_id, category_id)` prevent cross-account category links for expenses and budgets. RPCs are `SECURITY INVOKER`, have an empty search path and honor the caller's RLS. Anonymous roles cannot access tables/RPCs. Table defaults use `auth.uid()`; RPCs do not accept a trusted user ID from the client.

Money is a checked `bigint` in paise, capped per entry at ₹1,00,00,00,000 and parsed without binary floating-point conversion. Integers remain exact within JavaScript's safe range for normal personal-ledger sizes. The UI escapes text through React; CSV cells are quoted and formula-like strings neutralized.

## Tests and build

```bash
npm ci
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

On a fresh Linux CI runner, use `npx playwright install --with-deps chromium`.

- `tests/domain.test.ts`: paise, leap days, Kolkata rollover, elapsed-month comparisons, averages, filters, backup validation, duplicate detection, CSV escaping.
- `tests/database.test.ts`: executes the actual migration in PGlite (PostgreSQL WASM), uses separate authenticated roles/claims, checks RLS, owner changes, foreign keys, save/edit/delete retries, stale versions, constraints, month-budget preservation and atomic imports.
- `tests/browser/`: Chromium desktop/mobile workflows, create/edit/delete, form validation, filters, report drill-down, budgets, theme, category editing, JSON validation, refresh-safe navigation and layout.

PGlite is a real embedded PostgreSQL engine, but these tests do not validate the hosted Supabase Auth/email, WebSocket service or a real GitHub Pages deployment. After setup, run this acceptance checklist:

1. Register two test users A/B and confirm both emails. A creates expenses/categories/budgets; B must see none of A's records.
2. Sign into A on two devices. Add/edit/delete in one; verify the other within 20 seconds or after focus/refresh.
3. Try an expense save with the network offline. Check input stays intact, restore the network and Retry, then confirm exactly one saved record.
4. Edit the same record on both devices; save one then the stale one. The stale edit should show a conflict and preserve its form input.
5. Export JSON and import it twice. Confirm no extra rows. Import a malformed backup and confirm no writes.
6. Test password reset email and email confirmation at your production URL. Refresh every navigation view.
7. Check daily/month/year boundary values using a few real test entries; delete those entries after testing.

## Official documentation checked

Dependency releases were resolved from npm and pinned exactly in `package.json` and `package-lock.json`. The implementation checked the current official documentation on 2026-10-05:

- React versions: https://react.dev/versions
- Vite setup: https://vite.dev/guide/
- Vite GitHub Pages deployment and base path: https://vite.dev/guide/static-deploy
- Tailwind Vite plugin: https://tailwindcss.com/docs/installation/using-vite
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase redirects: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase password reset: https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail

See `VERIFICATION.md` for the actual checks performed during delivery.
