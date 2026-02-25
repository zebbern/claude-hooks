---
applyTo: "**/*.ts,**/*.tsx,**/*.js,**/*.jsx,**/*.py"
---
## OUTPUT_ENCODING

- [P0-MUST] Never interpolate user input directly into HTML, SQL, shell commands, or URLs. Use parameterized queries, template engines, or encoding functions.
- [P1-SHOULD] Use framework-provided sanitization (e.g., React's JSX escaping, Django's template auto-escaping) instead of manual escaping.
- [P1-SHOULD] When rendering user-generated HTML, use a sanitization library (DOMPurify, bleach) — never `dangerouslySetInnerHTML` or `| safe` with raw input.

## AUTHENTICATION

- [P0-MUST] Never store passwords in plain text. Use bcrypt, scrypt, or Argon2 with appropriate cost factors.
- [P0-MUST] Never expose authentication tokens in URLs, logs, or error messages.
- [P1-SHOULD] Use short-lived tokens (JWTs with `<= 15 min` expiry) paired with refresh tokens for session management.
- [P1-SHOULD] Implement rate limiting on authentication endpoints to prevent brute-force attacks.

## AUTHORIZATION

- [P0-MUST] Check authorization on every request — never rely on client-side checks or hidden UI elements for access control.
- [P0-MUST] Validate that the authenticated user owns or has access to the requested resource (prevent IDOR).
- [P1-SHOULD] Use role-based or attribute-based access control. Define roles in a central location.

## SECRETS

- [P0-MUST] Never hardcode secrets, API keys, or credentials in source code. Use environment variables or secret management services.
- [P0-MUST] Never log secrets, tokens, or passwords — even at debug level.
- [P1-SHOULD] Rotate secrets regularly. Design systems to support rotation without downtime.
- [P1-SHOULD] Use `.env.example` with placeholder values. Never commit `.env` files.

## HEADERS

- [P1-SHOULD] Set `Content-Security-Policy` headers to prevent XSS. Start with a strict policy and loosen as needed.
- [P1-SHOULD] Set `X-Content-Type-Options: nosniff` to prevent MIME-type sniffing.
- [P1-SHOULD] Set `Strict-Transport-Security` (HSTS) for production deployments.
- [P1-SHOULD] Configure CORS to allow only trusted origins. Never use `Access-Control-Allow-Origin: *` on authenticated endpoints.

## DATA_EXPOSURE

- [P0-MUST] Never return sensitive data (passwords, tokens, internal IDs) in API responses unless explicitly required.
- [P1-SHOULD] Use separate DTOs/response schemas — never return raw database models directly.
- [P1-SHOULD] Mask or redact PII in logs (email, phone, IP addresses).
- [P2-MAY] Implement field-level access control for APIs that serve different user roles.
