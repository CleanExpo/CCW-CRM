#!/bin/bash
# Configure PostgreSQL authentication for asyncpg compatibility

# Update pg_hba.conf to use md5 authentication for all TCP connections
echo "host all all all md5" >> /var/lib/postgresql/data/pg_hba.conf

# Reload PostgreSQL configuration
pg_ctl reload -D /var/lib/postgresql/data
