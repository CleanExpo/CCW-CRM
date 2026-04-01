# Docker Operations Skill

**Name:** docker-ops
**Triggers:** `/docker`
**Version:** 1.0.0

---

## Purpose

Manages Docker containers for local development.

---

## Commands

### `/docker status`
Shows status of all containers

```bash
cd C:\CCW-Online ERP && docker-compose ps
```

### `/docker up`
Starts all services

```bash
cd C:\CCW-Online ERP && docker-compose up -d
```

### `/docker down`
Stops all services

```bash
cd C:\CCW-Online ERP && docker-compose down
```

### `/docker logs [service]`
Shows logs for a service

```bash
cd C:\CCW-Online ERP && docker-compose logs -f [service]
```

### `/docker reset`
Resets database (⚠️ destructive)

```bash
cd C:\CCW-Online ERP && docker-compose down -v && docker-compose up -d
```

---

## Services

- **db**: PostgreSQL 15 (port 5432)
- **redis**: Redis 7 (port 6379)
- **db-test**: Test database (port 5433)

---

## Troubleshooting

**Container won't start:**
```bash
docker-compose down
docker system prune -f
docker-compose up -d
```

**Port conflict:**
```bash
# Check what's using the port
netstat -ano | findstr :5432
# Kill the process or change port in docker-compose.yml
```

---

## Usage

```
# Start dev environment
/docker up

# Check status
/docker status

# View database logs
/docker logs db
```
