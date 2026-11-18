# Cloudflare origin allowlist

The public edge must reach nginx through Cloudflare; direct-to-origin requests
should fail. This directory holds the generator, verifier and systemd timer for
the allowlist on the ausspend host. It is host-local: it does not change the
router, Cloudflare DNS, or any other platform.

## Source of truth

Ranges come from Cloudflare's published origin API, not from resolving the
site's hostname:

- `https://api.cloudflare.com/client/v4/ips` (JSON, IPv4 + IPv6)
- `https://www.cloudflare.com/ips-v4` and `ips-v6` (plain text mirrors)

The API list changes over time. Do not hand-edit the snippet.

## Install on this host

```bash
sudo install -d -m 0755 /etc/nginx/snippets
sudo install -m 0755 deploy/cloudflare/update-allowlist.sh /usr/local/sbin/update-cloudflare-allowlist
sudo install -m 0755 deploy/cloudflare/check-allowlist.sh  /usr/local/sbin/check-cloudflare-allowlist
sudo install -m 0644 deploy/cloudflare/cloudflare-allowlist.service /etc/systemd/system/
sudo install -m 0644 deploy/cloudflare/cloudflare-allowlist.timer   /etc/systemd/system/
sudo /usr/local/sbin/update-cloudflare-allowlist
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflare-allowlist.timer
```

The nginx template includes `/etc/nginx/snippets/cloudflare-allow.conf` in both
the HTTP and HTTPS server blocks. After installing the snippet, render and
reload the live config (`deploy/render-nginx.sh` on a fresh deploy), then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Verify

```bash
# Public path still works
curl -I https://ausspend.com.au/

# Direct origin must fail (403/000). Pass the public origin IP explicitly so it
# stays out of this repository.
sudo ORIGIN_IP=<public-origin-ip> /usr/local/sbin/check-cloudflare-allowlist

# Timer
systemctl list-timers cloudflare-allowlist.timer
```

## Notes

- Loopback (`127.0.0.1`, `::1`) is allowed for local checks. Any LAN monitor or
  admin probe that needs the origin directly must be added deliberately.
- An IP allowlist stops direct-to-origin bypass. It is not authentication:
  pair it with Cloudflare Authenticated Origin Pulls or a Tunnel where possible.
- If the snippet is invalid, the updater restores the previous file and refuses
  to leave nginx broken. `nginx -t` is run before every reload.
- Other platforms need the same pattern separately; this directory does not
  touch them.
