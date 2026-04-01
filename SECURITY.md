# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 1.x   | Yes |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email **security@ziphire.hr** with details
3. Include steps to reproduce, impact assessment, and any suggested fixes
4. We will acknowledge receipt within 48 hours
5. We aim to provide a fix within 7 days for critical issues

## Security Best Practices

When deploying AgentOS:

- Generate strong, unique values for `SESSION_SECRET` and `AGENT_KEY_SECRET`
- Use TLS/HTTPS in production
- Keep PostgreSQL credentials secure and rotated
- Enable database connection encryption
- Run behind a reverse proxy (nginx, Caddy, etc.)
- Keep dependencies up to date

## Scope

This policy applies to the AgentOS codebase and official Docker images. Third-party integrations and provider APIs are outside our scope.
