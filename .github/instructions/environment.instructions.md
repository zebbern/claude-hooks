---
applyTo: "**/.env*,**/config.*,**/*.config.*"
---
## ENVIRONMENT_VARIABLES

- [P0-MUST] Never hardcode secrets, API keys, tokens, or credentials in source code. Use environment variables.
- [P0-MUST] Never commit `.env` files. Add `.env*` (except `.env.example`) to `.gitignore`.
- [P1-SHOULD] Provide a `.env.example` file with placeholder values and comments describing each variable.
- [P1-SHOULD] Use descriptive names with consistent prefixes: `DATABASE_URL`, `NEXT_PUBLIC_API_URL`, `DISCORD_TOKEN`.
- [P1-SHOULD] Validate required environment variables at application startup — fail fast with clear error messages.

## CONFIG_FILES

- [P1-SHOULD] Separate configuration by environment: development, staging, production.
- [P1-SHOULD] Use typed configuration schemas (e.g., Zod, pydantic) to validate config values at load time.
- [P2-MAY] Use `dotenv` or framework-specific loading (Next.js built-in `.env` support) rather than manual parsing.

## SECRETS_MANAGEMENT

- [P0-MUST] Never log environment variables containing secrets — even at debug level.
- [P1-SHOULD] Use secret management services (AWS Secrets Manager, Vault, Doppler) for production deployments.
- [P1-SHOULD] Support secret rotation without application restarts when possible.
