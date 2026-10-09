# Deployment

CommitCity is one Next.js app with no database. It runs on [Vercel's free Hobby plan](https://vercel.com/pricing); any host that runs Next.js 16 works, but the steps below are for Vercel.

## What the app needs

| Setting | Value |
|---|---|
| Node.js | 22 or newer (`.nvmrc`) |
| Install | `pnpm install` (pnpm version pinned in `package.json`) |
| Build | `pnpm build` (runs `pnpm pack-assets` first, which writes the atlas into `public/generated/`) |
| `GITHUB_TOKEN` | A GitHub token that can read public repositories. A [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with **no extra permissions** is enough. Server side only. |
| `GITHUB_GRAPHQL_URL` | Leave unset (only for GitHub Enterprise or a local mock server). |

## First deployment on Vercel

1. Create a GitHub token as above. Give it a long expiry and a name like `commitcity-production`.
2. On Vercel, choose **Add New → Project** and import `commitcity/commitcity`. Vercel detects Next.js and pnpm; keep the default build settings.
3. Under **Environment Variables**, add `GITHUB_TOKEN` for the Production and Preview environments.
4. Deploy. Open `/u/<your-login>` on the new URL to check that a real city loads.

Every push to `main` then deploys to production, and every pull request gets a preview URL.

## Caching and limits

- A city is read from GitHub once and cached for a day in the platform cache (`use cache: remote`, see `ARCHITECTURE.md` §10). Later visits within that day make no GitHub call; after a day the next visit gets the cached city while it refreshes in the background.
- One lookup costs one GraphQL request per 100 repositories (at most 10). GitHub allows a token 5,000 points per hour, which is enough for thousands of new cities per hour.
- When GitHub's limit is reached, pages say when to come back, and that answer is cached for seconds only.
- The atlas, the catalog and the JavaScript are static files served from the CDN. The city is generated and drawn in the visitor's browser, so the server only reads GitHub and renders a small page.

To stay within the Hobby plan, keep an eye on **Usage** in the Vercel dashboard (function invocations, data transfer and cache usage). If a link goes viral, the cache absorbs repeat visits to the same city; many different cities in a short time are bounded by the GitHub rate limit, not by Vercel.

## Rotating the token

Create a new token, replace `GITHUB_TOKEN` in the Vercel project settings, and redeploy. If the token expires, city pages say that the server cannot reach GitHub.
