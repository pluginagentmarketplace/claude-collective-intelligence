# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **Do NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to the maintainers privately
3. Include detailed information about the vulnerability
4. Allow reasonable time for a response and fix

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested fix (if any)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Target**: Within 30 days for critical issues

## Security Best Practices

### For Contributors

- Never commit secrets, API keys, or credentials
- Use environment variables for sensitive configuration
- Follow secure coding guidelines
- Keep dependencies updated

### For Users

- Use strong authentication for RabbitMQ and PostgreSQL
- Enable TLS/SSL for all connections in production
- Follow the principle of least privilege
- Regularly update to the latest version

## Dependency Security

We use automated tools to monitor dependencies:

```bash
# Check for vulnerabilities
npm audit

# Fix automatically where possible
npm audit fix
```

## Environment Security

### Required Environment Variables

Ensure these are set securely and never committed to version control:

- `RABBITMQ_URL` - Message broker connection
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Cache connection
- `JWT_SECRET` - Authentication secret

### Development vs Production Credentials

**Development (included in docker-compose.yml):**
```
RabbitMQ: admin / rabbitmq123
PostgreSQL: admin / postgres123
Redis: No authentication
```

**Production Requirements:**
- Change ALL default passwords immediately
- Use secrets management (HashiCorp Vault, AWS Secrets Manager, etc.)
- Enable TLS/SSL for all connections
- Use network segmentation

### Docker Compose Security

The included `docker-compose.yml` is configured for **development only**:

```yaml
# DO NOT USE IN PRODUCTION without changes:
- Default passwords in environment variables
- All ports exposed to localhost
- No TLS/SSL configuration
- No resource limits
```

**Production Hardening Checklist:**
- [ ] Replace all default passwords
- [ ] Configure TLS certificates
- [ ] Limit exposed ports (use internal networks)
- [ ] Add resource limits (memory, CPU)
- [ ] Enable RabbitMQ authentication plugins
- [ ] Configure PostgreSQL SSL mode

### MCP Server Security

The MCP Server (`scripts/mcp-server.js`) connects Claude Code to RabbitMQ:

**Configuration Security:**
- `.mcp.json` contains connection URLs - do not commit with production credentials
- Use environment variable substitution for sensitive values
- Limit MCP server access to trusted Claude Code instances

**Agent Security:**
- Agents are identified by unique IDs
- No built-in authentication between agents (trust-based)
- For production, implement agent verification/signing

### File Security

Files that should **never** be committed with real credentials:
- `.env` - Environment variables
- `.mcp.json` - MCP server configuration
- `docker-compose.override.yml` - Local overrides

These are included in `.gitignore` by default.

## Network Security

### Exposed Ports (Development)

| Port | Service | Purpose |
|------|---------|---------|
| 5672 | RabbitMQ | AMQP protocol |
| 15672 | RabbitMQ | Management UI |
| 5432 | PostgreSQL | Database |
| 6379 | Redis | Cache |
| 3000 | Grafana | Monitoring |
| 9090 | Prometheus | Metrics |

### Production Recommendations

1. **Internal Network:** Use Docker networks, expose only necessary ports
2. **Firewall:** Restrict access to management ports (15672, 3000, 9090)
3. **TLS:** Enable SSL for RabbitMQ and PostgreSQL connections
4. **Authentication:** Enable RabbitMQ user management, PostgreSQL roles

## Additional Resources

- [MASTER-GUIDE.md](docs/MASTER-GUIDE.md) - Complete system documentation
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [RabbitMQ Security](https://www.rabbitmq.com/security.html)

## Acknowledgments

We appreciate security researchers who help keep this project secure through responsible disclosure.
