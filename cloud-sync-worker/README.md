# XIXI CARE Cloud Archive Worker

This Cloudflare Worker stores encrypted app archives in the private Gitee
repository configured by `wrangler.jsonc`. Encryption and decryption happen in
the app; the Worker and Gitee only receive the encrypted envelope.

## Deploy

```bash
npx wrangler secret put GITEE_ACCESS_TOKEN --config cloud-sync-worker/wrangler.jsonc
npx wrangler deploy --config cloud-sync-worker/wrangler.jsonc
```

Never commit the Gitee token. The public app endpoint is configured in
`.env.production`.
