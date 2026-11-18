# Production cutover — ausspend.com.au

Status as at 2026-11-18 (the database host, origin `localhost`, public `<public-origin-ip>`).

## TL;DR status

| Piece                                                    | State                                                                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| nginx on host `:80` / `:443`                             | **LIVE** — nginx 1.18.0, `deploy/nginx/ausspend.conf.template` installed and enabled                                                   |
| Static client (`/srv/ausspend/client`)                   | **LIVE** — `index.html` references `assets/index-BqHi0MAj.js`; republished 2026-11-18 with `npm run deploy:client`                     |
| API proxy `/api` → `127.0.0.1:3001`                      | **LIVE** — same-origin, GET/HEAD/OPTIONS only, rate-limited                                                                            |
| TLS                                                      | **LIVE** — Cloudflare Origin CA cert, Full (strict)-capable; served from `${AUSSPEND_TLS_DIR}/` (root-only, never in git)              |
| Cloudflare proxied DNS → origin                          | **LIVE and verified** — `curl --resolve …:<cloudflare-edge-ip>` returns 200 with `cf-ray`; CF edge IPs appear in the origin access log |
| `docker-compose.yml` loopback bindings + `CLIENT_ORIGIN` | **LIVE** — `ss` shows `ausspend-server-1` on `127.0.0.1:3001` and `ausspend-client-1` on `127.0.0.1:5173` (verified 2026-11-18)        |
| Live container bindings                                  | **LOOPBACK** — 3001/5173 are no longer published on 0.0.0.0                                                                            |

The public site is reachable through Cloudflare, and the live containers are
now bound to loopback (`127.0.0.1:3001` and `127.0.0.1:5173`; verified
2026-11-18). Remaining owner actions are Cloudflare/RouterOS confirmation and
optional origin hardening — see "Remaining owner actions".

## Architecture

```
Internet → Cloudflare (proxied, Full strict) → <public-origin-ip>:443 (RouterOS NAT)
        → localhost:443 nginx
            ├─ /, /legal, /soc, /benchmark, deep links → /srv/ausspend/client (SPA)
            └─ /api/* → 127.0.0.1:3001 (Express; GET/HEAD/OPTIONS only)
```

Port 80 is a 301 redirect to `https://ausspend.com.au`. Pi-hole keeps
`8053 → 80` and DNS/53; nginx owns host 80/443. Do **not** give Pi-hole host
port 80 again.

## Files

- `scripts/deploy-client.sh` — build + validate + publish `client/dist/` to
  `AUSSPEND_DEPLOY_ROOT` (default `/srv/ausspend/client`) without sudo.
- `deploy/verify-client.sh` — read-only live check of the deployed index, hashed
  asset, `/api/v1/health`, `/trade` and `/coverage-limitations`.
- `deploy/nginx/ausspend.conf.template` — the complete edge config (both server blocks,
  rate-limit zone, TLS, headers, SPA fallback, API proxy and blocks).
- `docker-compose.yml` — app ports pinned to `127.0.0.1`; production
  `CLIENT_ORIGIN=https://ausspend.com.au`.
- `server/src/api/source-documents.ts`, `server/src/api/ingestion-logs.ts` —
  `local_path` / `backup_path` omitted unless `EXPOSE_SOURCE_PATHS=true`
  (defence in depth; the edge also 404s both routes).

No certificate, key, token or `.env` is committed.

## Install / deploy

Prerequisites: Node >=24 / npm 11, `rsync`, and one `npm ci` in the checkout. The publish
script does **not** use sudo, secrets or container restarts when the deploy user owns the client
root.

### One-command client publish + verify

```bash
npm ci
npm run deploy:client    # build shared+client, validate, publish to /srv/ausspend/client
npm run deploy:verify    # read-only live check (public hostname)
```

`deploy:client` runs `scripts/deploy-client.sh`, which:

- builds `shared` and `client`;
- parses `client/dist/index.html` and requires every referenced `/assets/*` file to exist;
- copies with `rsync -a --delete` to `${AUSSPEND_DEPLOY_ROOT:-/srv/ausspend/client}`;
- `cmp`-verifies the copied `index.html` and every referenced asset;
- exits non-zero with the exact owner-only fallback if the build or root is not writable.

Useful variants:

```bash
# Path selection / no writes:
AUSSPEND_DEPLOY_ROOT=/srv/ausspend/client bash scripts/deploy-client.sh --dry-run

# Re-publish an existing client/dist without rebuilding:
bash scripts/deploy-client.sh --skip-build

# Custom root (the variable is the client static root, not its parent):
AUSSPEND_DEPLOY_ROOT=/path/to/client bash scripts/deploy-client.sh
```

`deploy:verify` runs `deploy/verify-client.sh` and is read-only. It checks the deployed index,
the hashed JS asset it references, `/api/v1/health`, `/trade` and `/coverage-limitations`; it also
fails if the live asset differs from a local `client/dist/index.html` build. It never restarts
nginx, Docker, the API or the database.

```bash
# Public hostname (normal TLS verification):
npm run deploy:verify

# Local origin, bypassing DNS but using the production Host/SNI:
AUSSPEND_VERIFY_BASE_URL=https://ausspend.com.au \
AUSSPEND_VERIFY_RESOLVE=ausspend.com.au:443:127.0.0.1 \
AUSSPEND_VERIFY_INSECURE=1 \
npm run deploy:verify
```

Verify environment: `AUSSPEND_VERIFY_BASE_URL` (default `https://ausspend.com.au`),
`AUSSPEND_VERIFY_RESOLVE` (optional curl `--resolve`), `AUSSPEND_VERIFY_INSECURE=1` (pass `-k`).

### First-time host install (nginx/TLS)

```bash
# On the host (sudo -n works):
sudo apt-get update -o Acquire::AllowReleaseInfoChange=true
sudo apt-get install -y nginx                       # nginx 1.18.0 on Ubuntu 22.04

# TLS: Cloudflare Origin CA cert/key, root-only, outside the repo.
sudo install -d -m 755 ${AUSSPEND_TLS_DIR}
sudo install -m 600 -o root -g root $HOME/.secrets/ausspend-origin.pem ${AUSSPEND_TLS_DIR}/ausspend-origin.pem
sudo install -m 600 -o root -g root $HOME/.secrets/ausspend-origin.key ${AUSSPEND_TLS_DIR}/ausspend-origin.key
```

Render the edge config. **Note the two path conventions:** `deploy/render-nginx.sh` expects the
**parent** root and appends `/client`; `scripts/deploy-client.sh` expects the **client** root
directly.

```bash
export AUSSPEND_DEPLOY_ROOT="/srv/ausspend"      # parent; render-nginx appends /client
export AUSSPEND_TLS_DIR="$HOME/.config/ausspend/tls"
sudo ./deploy/render-nginx.sh | sudo tee /etc/nginx/sites-available/ausspend.conf >/dev/null
sudo ln -sf /etc/nginx/sites-available/ausspend.conf /etc/nginx/sites-enabled/ausspend.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

If the rate-limit key changes, a `reload` is refused with
`limit_req … uses the "$…" key while previously it used …`; use
`sudo systemctl restart nginx` once, then reloads work normally.

### Manual fallback (kept)

Use this only when the script cannot run (for example a root-owned deploy root and no writable
parent):

```bash
npm ci
npm run build -w shared
npm run build -w client
sudo install -d -m 755 /srv/ausspend/client
sudo rsync -a --delete client/dist/ /srv/ausspend/client/
```

Then render/reload nginx as above and run the read-only `deploy:verify` checks.

## TLS / Cloudflare

- Certificate: `CN=CloudFlare Origin Certificate`, issuer `CloudFlare Origin SSL
Certificate Authority`, SAN `DNS:*.ausspend.com.au, DNS:ausspend.com.au`,
  valid 2026-11-17 → 2041-11-13, key matches. SHA-256 fingerprint
  `E3:41:CD:BE:CC:96:19:9B:79:3D:40:FA:6B:99:23:23:F9:9D:91:D2:E7:F3:80:D1:26:2F:B6:87:9B:88:CF:6E`.
- Cloudflare SSL/TLS mode must be **Full (strict)**. The origin cert is a
  Cloudflare Origin CA certificate, which is what Full (strict) trusts. The mode
  itself is a dashboard setting and cannot be read without Cloudflare
  credentials — confirm it in the dashboard after any DNS change.
- Cloudflare "Always Use HTTPS" is on (HTTP through the edge returns
  `301 https://ausspend.com.au/`). Edge cert is Let's Encrypt, auto-managed by
  Cloudflare.
- Do **not** enable "Flexible": it would talk to origin port 80, which only
  redirects. Never switch to Let's Encrypt on the origin while proxied without
  DNS-01; use the Origin CA cert.
- Rotate the Origin CA cert before 2041-11-13; reinstall both files and reload
  nginx. Keep them out of the repo.
- `server_tokens off` removes the nginx version; through Cloudflare the only
  `Server` header is `cloudflare`.

## API surface and hardening

- Public `/api` is **GET/HEAD/OPTIONS only**; anything else is `405`.
- `/api/source-documents` and `/api/ingestion-logs` (and `/api/v1/...` variants)
  return **404** at the edge. Both leak filesystem paths when called directly;
  the handlers additionally omit `local_path`/`backup_path` unless
  `EXPOSE_SOURCE_PATHS=true`. The block is case-insensitive because Express
  route matching is case-insensitive (a mixed-case path would otherwise reach
  the handler).
- `limit_req`: 10 r/s per visitor with `burst=20`, keyed on
  `CF-Connecting-IP` behind Cloudflare (falls back to the socket address for
  direct/loopback traffic); excess gets `429`.
- Body limit 1 MB, proxy/read/send timeouts, gzip on, hashed `/assets/*` cached
  one year immutable, `index.html` `no-cache`, no directory listing, dotfiles
  denied.
- Security headers: CSP (self only; inline styles allowed for MUI/emotion), HSTS,
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  COOP.
- If Cloudflare injects JS (Rocket Loader / "Email Address Obfuscation"), the CSP
  will block it. Keep Rocket Loader off; the current page is served unmodified.

## Pi-hole

- Pi-hole stays on host `8053 → 80`; DNS/53 untouched.
- The pihole container also exposes internal `443/tcp` but does not publish host 443. nginx owns host 80 and 443. Do not re-add a host `80` mapping for Pi-hole.

## RouterOS (owner side; not changed here)

Documented, not applied (no router access):

```
/ip firewall nat
add chain=dstnat in-interface-list=WAN protocol=tcp dst-port=80  action=dst-nat to-addresses=localhost to-ports=80  comment="ausspend http"
add chain=dstnat in-interface-list=WAN protocol=tcp dst-port=443 action=dst-nat to-addresses=localhost to-ports=443 comment="ausspend https"
/ip firewall filter
# accept established/related first, then the two dst-nat accept rules BEFORE any drop.
add chain=forward action=accept connection-nat-state=dstnat in-interface-list=WAN protocol=tcp dst-port=80,443 comment="ausspend edge"
```

Cloudflare already reached the origin over TLS during verification, so a path
exists, but confirm the WAN 80/443 dst-nat and the forward-accept-before-drop
ordering are present and persistent.

## Public verification (run from any host)

```bash
# Origin, bypassing DNS (SNI + Host = ausspend.com.au):
curl -sk --resolve ausspend.com.au:443:127.0.0.1 https://ausspend.com.au/
curl -sk --resolve ausspend.com.au:443:127.0.0.1 https://ausspend.com.au/legal
curl -sk --resolve ausspend.com.au:443:127.0.0.1 'https://ausspend.com.au/api/spending?limit=1'
curl -sk --resolve ausspend.com.au:443:127.0.0.1 -o /dev/null -w '%{http_code}\n' https://ausspend.com.au/api/source-documents   # 404

# Through Cloudflare (refresh DNS if a stale A record is cached):
npm run deploy:verify
curl -sS https://ausspend.com.au/
curl -sS https://ausspend.com.au/api/v1/health

# Host checks:
sudo nginx -t
sudo ss -ltnp | grep -E ':(80|443)\b'
```

A stale A record for `ausspend.com.au` → `<parking-ip>` (VentraIP parking) was
still cached by some public resolvers during the cutover. Cloudflare
authoritative DNS (`1.1.1.1`) returns only Cloudflare anycast addresses; the
stale entry clears with its TTL. If it persists, re-check the Cloudflare DNS
record.

## Remaining owner actions

1. **Loopback bindings — done 2026-11-18.** `ss` shows `ausspend-server-1` on
   `127.0.0.1:3001` and `ausspend-client-1` on `127.0.0.1:5173`. Re-check after
   any container recreation.
2. **Confirm Cloudflare SSL/TLS mode = Full (strict)** in the dashboard.
3. **Confirm the RouterOS WAN 80/443 forward** and forward-accept ordering
   (traffic currently reaches the origin, so verify rather than assume).
4. Optional hardening: firewall origin 80/443 to Cloudflare IP ranges, and
   rebind the unrelated `newpool-mongo-1` host port `27018` (currently
   `0.0.0.0:27018`) to loopback. `27017` is the host Mongo bound to
   `localhost` only; the app needs it and it is not on `0.0.0.0`.
5. After every client publish, run `npm run deploy:verify`; deploy is not
   complete until the index, asset, health and representative SPA routes pass.

## Rollback

```bash
sudo rm -f /etc/nginx/sites-enabled/ausspend.conf
sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default   # if present
sudo nginx -t && sudo systemctl reload nginx
# Cloudflare: set the proxied A record back to the previous target if needed.
```

The running app containers are untouched by this change; only the edge is new.

## Verified on 2026-11-18 (current)

- `npm run deploy:client` built shared+client, published to `/srv/ausspend/client`,
  and cmp-verified `index.html` plus the single referenced asset
  `/assets/index-BqHi0MAj.js`.
- `npm run deploy:verify` passed through the public hostname: index **200**,
  asset **200**, `/api/v1/health` `ok=true`, `/trade` **200**,
  `/coverage-limitations` **200**.
- The same verify passed against the local origin with
  `AUSSPEND_VERIFY_RESOLVE=ausspend.com.au:443:127.0.0.1` and
  `AUSSPEND_VERIFY_INSECURE=1`; the live asset matched the local build.
- `ss -ltnp` shows `127.0.0.1:3001` (server) and `127.0.0.1:5173` (client), and
  nginx owns `0.0.0.0:80/443`.

## Verified on 2026-11-17 (historical, commands abbreviated)

- `nginx -t` — syntax ok, test successful (nginx/1.18.0).
- Local SNI (`--resolve …:127.0.0.1`): `/` `/legal` `/soc` `/benchmark` deep
  link and `/api/health`, `/api/spending?limit=1` → **200**;
  `/api/{v1/}source-documents`, `/api/{v1/}ingestion-logs` → **404**;
  `/assets/` → **404** (no listing); POST `/api/health` → **405**; burst →
  **429** after burst.
- Through Cloudflare (`--resolve …:<cloudflare-edge-ip>`): same matrix, all **200/404**
  as above, response carries `cf-ray` and our CSP/HSTS headers.
- Public edge TLS verifies (`ssl_verify_result=0`, Let's Encrypt edge cert);
  origin presents the Cloudflare Origin CA cert for `ausspend.com.au`.
- Origin access log shows Cloudflare edge IPs (`104.22.x`, `108.162.x`,
  `162.158.x`, `172.68.x`) completing HTTP/2 requests — CF → origin TLS works.
- DB untouched (baseline 515,413 records).
