# Deploy fchecks to the UTVT Cloudflare account

The Worker is named fchecks in wrangler.jsonc. Its expected workers.dev address is https://fchecks.utvt.workers.dev/ if the selected account owns the utvt subdomain.

## One-time setup

1. Clone this repository and install dependencies:

   ~~~sh
   npm ci
   npx wrangler login
   npx wrangler whoami
   ~~~

   Confirm the account is the intended UTVT account. If you have multiple accounts, set account_id in wrangler.jsonc to that account's ID.

2. Create the database:

   ~~~sh
   npx wrangler d1 create fchecks-schools
   ~~~

   If that database already exists, reuse its ID from the Cloudflare D1 dashboard instead of creating another.

3. Add the returned database ID to the existing DB entry in wrangler.jsonc:

   ~~~json
   "d1_databases": [
     {
       "binding": "DB",
       "database_name": "fchecks-schools",
       "database_id": "YOUR_ACTUAL_DATABASE_ID",
       "migrations_dir": "migrations"
     }
   ]
   ~~~

   A database ID is configuration, not a password. Commit this config change before connecting Cloudflare Git builds. Do not commit API tokens.

4. Initialize the database, then deploy:

   ~~~sh
   npm run db:remote
   npm run deploy
   ~~~

5. Open the deployed site. Create a test school, fill a field, and click Save now. Confirm **Saved to cloud**. Copy its recovery code and restore it in a separate browser profile. Visit /api/health: it should return {"ready":true}.

Until the DB binding and migration exist, the UI explains that drafts are saved only on the current device.

## GitHub-connected deployment

After the one-time database setup, connect this GitHub repository to the fchecks Worker in Workers & Pages. Use:

- Build command: npm run build
- Deploy command: npx wrangler deploy
- Root directory: repository root
- Node.js: 22 or later

For future schema changes, apply the committed D1 migrations with npm run db:remote before deploying code that needs them. Cloudflare authentication for Git builds is configured in Cloudflare, not inside the application.

## Updating an existing fchecks Worker

Review its current bindings, routes and settings first. Deployment replaces the Worker's code and managed configuration. The provided configuration assumes this Worker is dedicated to this school form.

## Official references

- [Worker static assets](https://developers.cloudflare.com/workers/static-assets/binding/)
- [D1 commands and migrations](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
