# Security Hardening Checklist

## 1. Transport security (HTTPS only)
- Set `NODE_ENV=production`.
- Set `ENFORCE_HTTPS=true` on backend.
- Terminate TLS at a trusted reverse proxy/load balancer and forward `X-Forwarded-Proto`.
- Ensure HSTS headers are enabled (via `helmet` in backend).

## 2. Secrets management
- Never commit `.env` or `.env.local` files.
- Use `.env.example` only for non-secret templates.
- Store production secrets in a managed secret store (platform env vars, Vault, AWS/GCP/Azure secret managers).
- Rotate any key that was ever stored in plaintext in git history or shared channels.

## 3. Database exposure controls
- Prefer private networking (VPC/private service connect) between app and database.
- Set `ENFORCE_PRIVATE_DATABASE=true` in production.
- Restrict DB ingress with IP allowlists/security groups; do not expose DB directly to the public internet.
- Keep TLS enabled for DB connections (`PG_SSL_REJECT_UNAUTHORIZED=true` unless a controlled exception exists).

## 4. Access control and IDOR prevention
- All user-data API requests require auth and ownership checks.
- Avoid generic destructive routes; use explicit route shapes.
- Validate all ids and reject malformed path/query parameters.

## 5. Abuse protection
- Global API rate limiting enabled.
- Stricter write/action rate limits enabled.
- Monitor unusual request bursts (IP/method spikes) and alert.

## 6. Logging and detection
- Log authentication success/failure attempts.
- Log API errors (`4xx/5xx`) with route + IP.
- Forward logs to a centralized sink/SIEM and set alerts for:
  - Repeated auth failures
  - Rate-limit bursts
  - High-frequency error spikes

## 7. Ongoing verification
- Run secret scanning in CI (`npm run security:scan-secrets` in backend).
- Add SAST/DAST/dependency scanning to CI.
- Run regular pen tests and rotate credentials after incidents.
