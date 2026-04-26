# Deploying to Railway

Both marketing sites — **faregate.org** (corporate) and **agents402.org**
(protocol docs) — are static-prerendered Next.js apps. No database, no
runtime env vars, no secrets. They cost almost nothing to host.

The publisher (`apps/publisher`) and verifier (`apps/verifier`) are runtime
services with NWC wallets and SQLite — those are deployed separately when
you're ready to take real Lightning payments. This guide is just the two
public sites.

## One-time setup

1. Sign in to **railway.com** with your GitHub account.
2. **New Project** → **Deploy from GitHub repo** → select `gereonelvers/tollgate`.
3. Railway will offer to deploy the root — **cancel that**, since this is a
   monorepo. Instead, you'll add two services manually.

## Service 1: faregate.org (corporate-site)

In the project, click **+ New** → **GitHub Repo** → pick `gereonelvers/tollgate` again.

**Settings → Source**
- Root Directory: `apps/corporate-site`
- Watch Paths: `apps/corporate-site/**`

**Settings → Build**
- Builder: Nixpacks (default — no change needed)
- Build Command: leave empty (Railway runs `npm run build` automatically)

**Settings → Deploy**
- Start Command: leave empty (Railway runs `npm start`, which honors `$PORT`)
- Healthcheck Path: `/`

**Settings → Networking**
- Click **Generate Domain** to get a `*.up.railway.app` URL — verify the
  site loads there before adding a custom domain.

**Custom domain (faregate.org):**
1. Networking → **Custom Domain** → enter `faregate.org`.
2. Railway shows you the DNS records to add at your registrar.
3. For an apex domain (`faregate.org`), you typically add either:
   - An **ALIAS** or **ANAME** record (if your registrar supports it), or
   - The A records Railway provides.
4. For the `www` subdomain (`www.faregate.org`), add a CNAME pointing to
   the Railway domain.
5. Wait a few minutes for DNS propagation. Railway will auto-issue an
   HTTPS certificate.

## Service 2: agents402.org (protocol-site)

Repeat the process with these settings:

**Settings → Source**
- Root Directory: `apps/protocol-site`
- Watch Paths: `apps/protocol-site/**`

**Custom domain (agents402.org):**
- Same DNS pattern as above.

## Service 3: wallet onboarding (apps/web)

Same process again with:

**Settings → Source**
- Root Directory: `apps/web`
- Watch Paths: `apps/web/**`

**Settings → Variables**
- `SPONSOR_NWC_URL=nostr+walletconnect://...` — the wallet that pays
  out faucet grants. Without this, the faucet self-disables with a
  helpful 503 error and the UI tells the user. Nothing breaks.
- Optional: `SPONSOR_MAX_GRANT_MSATS` (default 50000 = 50 sats).
- Optional: `SPONSOR_COOLDOWN_MS` (default 24 h per IP / wallet identifier).

**Custom domain** — `wallet.faregate.org` is the natural choice; or
point `faregate.org` itself here if you want the wallet UX as the
front door.

## Service 4: demo publisher (apps/publisher)

A real agents402-enabled site so anyone with `@agents402/mcp` can `discover`
+ `pay_and_invoke` against a live Lightning paywall. Two paid actions
(`ask.site_agent`, 3 sats; `extract.structured`, 1 sat), a `/.well-known/agents402.json`
manifest, and a public dashboard that shows sats arriving in real time —
useful to leave open during a demo.

**Settings → Source**
- Root Directory: `apps/publisher`
- Watch Paths: `apps/publisher/**`

**Settings → Variables**
- `PUBLISHER_BASE_URL=https://demo.faregate.org` — used in the manifest
  so action endpoints resolve to absolute URLs the agent can hit.
- `PUBLISHER_NWC_URL=nostr+walletconnect://...` — receiving wallet that
  issues invoices. Use a wallet *different* from the sponsor (so the
  demo flow looks like a real cross-wallet payment). The
  `fancycobra21@primal.net` Primal wallet works well here.
- `PUBLISHER_LIGHTNING_ADDRESS=fancycobra21@primal.net` — surfaced in
  the manifest's `service.lightning_address`. Optional but nice.
- `L402_SECRET=<long random>` — HMAC key for L402 tokens. Generate with
  `openssl rand -hex 32`. **Do not** leave at the dev default in prod.
- `ANTHROPIC_API_KEY=sk-ant-...` — powers the `ask.site_agent` action.
  Without it, that action returns a stub answer (still demonstrable but
  less impressive).
- Optional: `FAREGATE_MOCK_LIGHTNING=1` — bypasses real Lightning and
  auto-settles invoices in-memory. Useful for a smoke test before you
  hand over real sats. Leave **unset** for the real demo.

**Custom domain** — `demo.faregate.org` is the natural choice. Add CNAME
`demo` → `<railway-target>.up.railway.app`. Wait for cert provisioning.

**Sanity check after deploy**
```sh
curl -s https://demo.faregate.org/.well-known/agents402.json | jq '.actions[].id'
# → "ask.site_agent"  "extract.structured"
```

## What Railway will do on every push

For each service:
1. Detect the push to `main` (filtered by Watch Paths so only the relevant
   service rebuilds).
2. Run `npm install` in the configured root directory.
3. Run `npm run build` (Next.js production build).
4. Run `npm start` — which is `next start -p $PORT` thanks to the script
   change in this commit.
5. Route incoming requests at the configured domain to the service.

Build time per site: ~30 s. Cold-start time after deploy: ~1 s.

## Costs

Static-prerendered Next.js on Railway's Hobby plan: typically **<$1/month
per service** for low-traffic marketing sites. Both sites combined should
fit comfortably inside Railway's $5 free tier credit.

## Troubleshooting

- **"Application failed to respond"** on first deploy — almost always means
  the start script isn't binding to `$PORT`. Verify `package.json` has
  `"start": "next start -p ${PORT:-3020}"` (or 3030 for the protocol site).
- **Domain shows "no service" on Railway page after DNS update** — check
  the DNS propagation with `dig faregate.org +short` and give it 10
  minutes. Railway re-checks every minute.
- **Build fails with "module not found"** — make sure the package-lock.json
  is committed (check `git ls-tree HEAD apps/corporate-site/package-lock.json`).

## Optional: alternative — host as static export

These sites have zero runtime requirements. You can export to plain HTML and
host on any static CDN (Cloudflare Pages, Vercel, Netlify) instead of
running a Node server. Add to `next.config.ts`:

```ts
export default { output: "export" } satisfies NextConfig;
```

Then `npm run build` writes static HTML to `out/`. Upload that to any host.

Railway is a fine default — keeps everything in one place and matches
where the publisher will live too — but it's a choice, not a requirement.
