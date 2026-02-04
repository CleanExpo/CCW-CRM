# CCW-Online ERP Documentation

Welcome to the CCW-Online ERP documentation. This directory contains all technical documentation, guides, and references for the system.

---

## 📚 Documentation Index

### Getting Started
- [**CLAUDE.md**](../CLAUDE.md) - Main project architecture guide (start here)
- [**.claude/STARTUP.md**](../.claude/STARTUP.md) - Development workflow guide
- [**.claude/CLAUDE.md**](../.claude/CLAUDE.md) - System instructions for AI development

### Database
- [**DATABASE_SCHEMA_CHANGES.md**](./DATABASE_SCHEMA_CHANGES.md) - Complete database schema documentation
- [**DATABASE_QUICK_REFERENCE.md**](./DATABASE_QUICK_REFERENCE.md) - Quick reference for common DB operations
- [**DATABASE_OPTIMIZATION.md**](./DATABASE_OPTIMIZATION.md) - Performance tuning and optimization

### API Development
- [**API_IMPLEMENTATION_GUIDE.md**](./API_IMPLEMENTATION_GUIDE.md) - Step-by-step API implementation guide
- [**api/**](./api/) - API specifications and schemas

### Infrastructure
- [**DEPLOYMENT_ROADMAP_SUMMARY.md**](./DEPLOYMENT_ROADMAP_SUMMARY.md) - Deployment roadmap and milestones
- [**SERVER_PROVISIONING.md**](./SERVER_PROVISIONING.md) - Server setup guide
- [**AUTO_SCALING.md**](./AUTO_SCALING.md) - Auto-scaling configuration
- [**LOAD_BALANCER.md**](./LOAD_BALANCER.md) - Load balancer setup
- [**SSL_SETUP.md**](./SSL_SETUP.md) - SSL certificate configuration

### Security & Compliance
- [**SECURITY_AUDIT_REPORT.md**](./SECURITY_AUDIT_REPORT.md) - Security audit findings
- [**SECURITY_HARDENING_COMPLETE.md**](./SECURITY_HARDENING_COMPLETE.md) - Security hardening checklist
- [**SECRETS_MANAGEMENT.md**](./SECRETS_MANAGEMENT.md) - Secrets management strategy
- [**DISASTER_RECOVERY.md**](./DISASTER_RECOVERY.md) - Disaster recovery plan
- [**BACKUP_STRATEGY.md**](./BACKUP_STRATEGY.md) - Backup and restore procedures

### Features
- [**I18N-DEMO-GUIDE.md**](./I18N-DEMO-GUIDE.md) - Internationalization (i18n) guide
- [**GOOGLE-API-INTEGRATION.md**](./GOOGLE-API-INTEGRATION.md) - Google API integration
- [**AGENT_PRD_SYSTEM.md**](./AGENT_PRD_SYSTEM.md) - AI agent system documentation
- [**AI_PROVIDERS.md**](./AI_PROVIDERS.md) - AI provider integrations

### Operations
- [**PRODUCTION_RUNBOOK.md**](./PRODUCTION_RUNBOOK.md) - Production operations guide
- [**CRON_JOBS.md**](./CRON_JOBS.md) - Scheduled tasks and maintenance
- [**REDIS_SETUP.md**](./REDIS_SETUP.md) - Redis configuration and clustering

---

## 🚀 Quick Start Paths

### For New Developers
1. Read [CLAUDE.md](../CLAUDE.md) - Understand the project structure
2. Read [.claude/STARTUP.md](../.claude/STARTUP.md) - Set up development environment
3. Read [DATABASE_QUICK_REFERENCE.md](./DATABASE_QUICK_REFERENCE.md) - Learn database basics

### For Backend Development
1. [DATABASE_SCHEMA_CHANGES.md](./DATABASE_SCHEMA_CHANGES.md) - Understand the schema
2. [API_IMPLEMENTATION_GUIDE.md](./API_IMPLEMENTATION_GUIDE.md) - Implement APIs
3. [DATABASE_OPTIMIZATION.md](./DATABASE_OPTIMIZATION.md) - Optimize queries

### For Frontend Development
1. [CLAUDE.md](../CLAUDE.md) - Component patterns and conventions
2. [API_IMPLEMENTATION_GUIDE.md](./API_IMPLEMENTATION_GUIDE.md) - API endpoints reference
3. [I18N-DEMO-GUIDE.md](./I18N-DEMO-GUIDE.md) - Multi-language support

### For DevOps
1. [DEPLOYMENT_ROADMAP_SUMMARY.md](./DEPLOYMENT_ROADMAP_SUMMARY.md) - Deployment strategy
2. [SERVER_PROVISIONING.md](./SERVER_PROVISIONING.md) - Server setup
3. [PRODUCTION_RUNBOOK.md](./PRODUCTION_RUNBOOK.md) - Operations guide

---

## 📊 Recent Updates

### 2026-02-02 - Database Schema Enhancements
**New Documentation:**
- [DATABASE_SCHEMA_CHANGES.md](./DATABASE_SCHEMA_CHANGES.md) - Comprehensive schema docs
- [DATABASE_QUICK_REFERENCE.md](./DATABASE_QUICK_REFERENCE.md) - Developer quick reference
- [API_IMPLEMENTATION_GUIDE.md](./API_IMPLEMENTATION_GUIDE.md) - API implementation guide

**Schema Changes:**
- **Migration 001**: Approval workflow system (approvals, approval_steps tables)
- **Migration 002**: Semantic search with pgvector (products.embedding column)

**Current Schema Version**: `002_add_semantic_search`

---

## 🔧 Development Workflow

### Running the Application
```bash
# Start all services
pnpm dev

# Backend only
cd apps/backend && uvicorn src.api.main:app --reload

# Frontend only
cd apps/web && pnpm dev

# Database
docker compose up -d
```

### Running Migrations
```bash
cd apps/backend
alembic upgrade head          # Apply all migrations
alembic current              # Check current version
alembic downgrade -1         # Rollback one migration
```

### Running Tests
```bash
# All tests
pnpm turbo run test

# Backend only
cd apps/backend && pytest

# Frontend only
cd apps/web && pnpm test
```

### Code Quality
```bash
# Type checking + linting
pnpm turbo run type-check lint

# Health check (comprehensive)
.\scripts\health-check.ps1
```

---

## 📖 Documentation Standards

### File Naming
- Use `SCREAMING_SNAKE_CASE.md` for guides and specs
- Use `kebab-case.md` for code-related docs
- Use `README.md` for directory indexes

### Document Structure
1. **Title** - Clear, descriptive title
2. **Overview** - What, why, and when to use this doc
3. **Table of Contents** - For docs > 200 lines
4. **Content** - Well-organized sections with examples
5. **References** - Links to related docs and external resources
6. **Last Updated** - Date and version info

### Code Examples
- Include complete, runnable examples
- Add comments explaining non-obvious parts
- Show both TypeScript (frontend) and Python (backend) versions
- Include error handling

---

## 🤝 Contributing to Documentation

### When to Update Docs
- After implementing new features
- When changing existing APIs or schemas
- After fixing bugs that affect documented behavior
- When adding new dependencies or tools

### How to Update
1. **Find the relevant doc** - Use this index to locate it
2. **Update content** - Keep formatting consistent
3. **Update "Last Updated"** - Add date and brief change description
4. **Update this README** - If adding new docs or major changes
5. **Test examples** - Ensure all code examples work

### Creating New Documentation
1. **Choose appropriate location** - Database docs in root, API docs in api/, etc.
2. **Follow naming conventions** - See "File Naming" above
3. **Use template structure** - See "Document Structure" above
4. **Add to this index** - Update the relevant section
5. **Link from related docs** - Create cross-references

---

## 🔍 Finding Information

### Database Questions
- Schema structure → [DATABASE_SCHEMA_CHANGES.md](./DATABASE_SCHEMA_CHANGES.md)
- Common queries → [DATABASE_QUICK_REFERENCE.md](./DATABASE_QUICK_REFERENCE.md)
- Performance → [DATABASE_OPTIMIZATION.md](./DATABASE_OPTIMIZATION.md)

### API Questions
- How to implement → [API_IMPLEMENTATION_GUIDE.md](./API_IMPLEMENTATION_GUIDE.md)
- Specifications → [api/](./api/)
- Authentication → [CLAUDE.md](../CLAUDE.md) (Auth section)

### Deployment Questions
- Overview → [DEPLOYMENT_ROADMAP_SUMMARY.md](./DEPLOYMENT_ROADMAP_SUMMARY.md)
- Server setup → [SERVER_PROVISIONING.md](./SERVER_PROVISIONING.md)
- Operations → [PRODUCTION_RUNBOOK.md](./PRODUCTION_RUNBOOK.md)

### Security Questions
- Audit results → [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)
- Hardening → [SECURITY_HARDENING_COMPLETE.md](./SECURITY_HARDENING_COMPLETE.md)
- Secrets → [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md)

---

## 📝 Documentation To-Do

### High Priority
- [ ] API endpoint specifications for all routes
- [ ] Frontend component library documentation
- [ ] Testing strategy guide
- [ ] CI/CD pipeline documentation

### Medium Priority
- [ ] Troubleshooting guide (common errors)
- [ ] Performance monitoring guide
- [ ] Analytics and reporting guide
- [ ] Third-party integrations guide

### Low Priority
- [ ] Architecture decision records (ADRs)
- [ ] Code style guide
- [ ] Git workflow guide
- [ ] Release process documentation

---

## 🆘 Getting Help

### Documentation Issues
- **Outdated info** → Create an issue on GitHub
- **Missing docs** → Request in team chat or create issue
- **Unclear instructions** → Ask in #development channel

### Technical Questions
- **Database** → Refer to [DATABASE_QUICK_REFERENCE.md](./DATABASE_QUICK_REFERENCE.md) first
- **API** → Check [API_IMPLEMENTATION_GUIDE.md](./API_IMPLEMENTATION_GUIDE.md)
- **Deployment** → See [PRODUCTION_RUNBOOK.md](./PRODUCTION_RUNBOOK.md)
- **Still stuck** → Ask in team chat with specific error details

---

## 📚 External Resources

### Technologies
- **Next.js**: https://nextjs.org/docs
- **FastAPI**: https://fastapi.tiangolo.com/
- **SQLAlchemy**: https://docs.sqlalchemy.org/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **pgvector**: https://github.com/pgvector/pgvector
- **Alembic**: https://alembic.sqlalchemy.org/

### Best Practices
- **API Design**: https://swagger.io/resources/articles/best-practices-in-api-design/
- **Database Design**: https://www.postgresql.org/docs/current/ddl.html
- **Security**: https://owasp.org/www-project-top-ten/
- **Testing**: https://pytest.org/en/latest/contents.html

---

**Maintained by**: CCW Development Team
**Last Updated**: 2026-02-02
**Version**: 1.0.0
