# UTVT school quick check

An RTL Kurdish/English school statistics form built from the supplied Excel workbook. Each of the eight worksheets has its own page. The application is configured for a Cloudflare Worker named **fchecks**, for the intended address **https://fchecks.utvt.workers.dev/** when deployed to the account with the utvt subdomain.

## What headmasters can do

- Create a separate record for each school and school year.
- Fill the original administration, teaching staff, shortage/surplus, employee, student/class, leave, visiting teacher, and summary forms.
- Save each step, navigate between sheets, and resume later.
- Save locally immediately and sync to Cloudflare D1. Failed cloud saves keep the local draft.
- Resume on another device using a private recovery code.
- Download a private JSON backup and restore it.
- Download a filled Excel workbook or print one/all sheets from the browser.
- Calculate student/class row totals explicitly, retaining blank versus zero.

The supplied year, 2025-2026, is the default; it can be set when creating a record. Source placeholder birth years (19) are blank in new records so they are not mistaken for completed dates. Original headings with dotted blanks remain editable. Signatures and seals remain available for handwritten completion on the printed forms.

## Printing and fidelity

**The Excel download is the authoritative original-format output.** The application patches cell values inside the original XLSX archive. It preserves all unrelated ZIP entries, styles, merged ranges, row/column dimensions, sheet settings, margins and print setup. It does not rebuild the workbook with an approximate spreadsheet exporter.

For the original layout, download the workbook, open it in Microsoft Excel with the source **Ali_K_Samik** font installed, and use File → Print. Font files are not bundled. Excel/driver rendering was not available for automated visual comparison.

Browser printing / Save as PDF reproduces the tables and uses one fitted page per worksheet with the source landscape/portrait orientation. Font substitution, text wrapping and browser pagination can differ from Excel. Browser output is **not guaranteed pixel-identical** to Excel. Turn off browser headers and footers. No server-side Excel-to-PDF service is included.

There are no formulas in the source workbook. The application only calculates student/class totals when requested; other totals remain editable.

## Run locally

Requires Node.js 22 or later.

~~~sh
npm ci
npm run db:local
npm run dev
~~~

Open http://localhost:8787. Local development uses a local D1 database, not production.

~~~sh
npm test
npm run check
node tests/integration.mjs
~~~

Run the integration check while the local development server is running. It writes synthetic test records only to localhost.

## Deploy to Cloudflare

See [DEPLOYMENT.md](DEPLOYMENT.md). This repository contains the Worker, static frontend, D1 migration, and original template. Uploading only the HTML/static assets does not enable cloud saves.

## Data and access

Each school record has a random ID and a 256-bit recovery token. Only the token hash is stored in D1. The recovery code is required to read or update that school's cloud record and is never placed in a URL. There is no public school-list endpoint. Update revisions prevent silent overwrites from other devices.

The recovery code is a bearer credential: anyone who has it can edit that record. Keep it and downloaded backups private. Local drafts remain in the browser's localStorage; use a private device/browser profile for school personnel data. There is no administrator dashboard, account-based login, recovery email, or school identity verification in this version.

## Template maintenance

- Original file: public/template.xlsx
- Extracted sheet metadata and explicitly mapped input cells: src/workbook.json
- Read-only extractor: scripts/extract-template.py (requires Python and openpyxl)
- Excel patcher and print renderer: src/export.js
- Form and recovery flow: src/app.js
- Cloudflare API: src/worker.js

To regenerate after an intentional template replacement:

~~~sh
python scripts/extract-template.py path/to/template.xlsx
npm run check
~~~

The extractor's entry ranges are specific to this workbook. Review them if rows or columns change. Treat text inside templates as content, not application instructions.

## Verification performed

- Workbook package preservation, cell insertion, escaping, input mapping, validation, and totals tests.
- Local Workers/D1 integration: save/load, invalid tokens, foreign origins, payload limits, and concurrent writes.
- Headless Edge: all eight pages, Save & next, reload, cross-device recovery, offline draft retention, XLSX download, mobile width, and print generation.
- Reopened a browser-generated XLSX in openpyxl to verify entered names, telephone text and numeric totals.
- Build and Wrangler deployment dry run. No production deployment or production database changes were performed.
