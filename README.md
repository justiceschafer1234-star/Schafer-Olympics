# Schafer Olympics Scoreboard

A Cloudflare Pages scoreboard that reads live results from a Notion data source without exposing the Notion API token to the browser.

## Architecture

- `index.html` — scoreboard page
- `styles.css` — responsive scoreboard styling
- `app.js` — loads and ranks team scores
- `functions/api/scores.js` — server-side Cloudflare Pages Function that securely queries Notion

## 1. Rotate the Notion token

If a Notion token has ever been pasted into chat, source code, an issue, or another non-secret location, revoke it and create a replacement before deployment.

Never add the token to this repository.

## 2. Get the Notion data source ID

Open the table in Notion, open its data source settings/menu, and copy the data source ID. Current Notion API versions query a data source rather than the legacy database-query endpoint.

## 3. Create the Cloudflare Pages project

In Cloudflare:

1. Go to **Workers & Pages**.
2. Create a Pages project by importing the GitHub repository `justiceschafer1234-star/Schafer-Olympics`.
3. Select the `main` branch.
4. This is a plain HTML project, so no framework build is required. Use the repository root as the static site output.
5. Deploy the project.

The `/functions` directory is automatically used by Cloudflare Pages Functions and creates the `/api/scores` route.

## 4. Add Cloudflare variables and secrets

In the Pages project, open **Settings → Variables and Secrets**.

Add:

- `NOTION_API_TOKEN` — paste the newly generated Notion token and mark/encrypt it as a **Secret**.
- `NOTION_DATA_SOURCE_ID` — paste the data source ID. This can be a regular environment variable.

Redeploy after adding them if Cloudflare requests it.

## 5. Expected Notion columns

The front end automatically looks for common names.

For the team name, it prefers:

- `Team`
- `Team Name`
- `Name`

For the score, it prefers:

- `Points`
- `Total Points`
- `Score`
- `Total`

If your Notion table uses different column names, edit `app.js` or update the table property names.

## Security

The browser calls `/api/scores`. Only the Cloudflare Function talks to Notion. The Notion API token is read from `context.env.NOTION_API_TOKEN`, so it never needs to appear in HTML or browser JavaScript.

Local secret files such as `.dev.vars` and `.env` are intentionally ignored by Git.
