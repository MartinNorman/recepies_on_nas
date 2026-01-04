# Security Guidelines

## Environment Variables

This project uses environment variables to store sensitive information like database passwords. **Never commit passwords or secrets to the repository.**

### Setup

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and fill in your actual values:**
   ```bash
   # Required
   DB_PASSWORD=your_actual_database_password
   
   # Optional (for restart-server.ps1)
   NAS_PASSWORD=your_nas_ssh_password
   ```

3. **Verify `.env` is in `.gitignore`:**
   The `.env` file is already excluded from Git. Never commit it!

### Required Environment Variables

#### Database Configuration
- `DB_TYPE` - Database type: 'postgres', 'mariadb', or 'mysql' (default: 'postgres')
- `DB_HOST` - Database host (default: 'localhost')
- `DB_PORT` - Database port (default: 5432 for PostgreSQL, 3306 for MariaDB/MySQL)
- `DB_NAME` - Database name (default: 'recepie_db')
- `DB_USER` - Database user (default: 'postgres' or 'root')
- `DB_PASSWORD` - **REQUIRED** - Database password (no default, must be set)

#### Server Configuration
- `PORT` - Server port (default: 3000)

#### Optional: Home Assistant Integration
- `HA_BASE_URL` - Home Assistant base URL
- `HA_TOKEN` - Home Assistant API token

#### Optional: NAS SSH (for restart-server.ps1)
- `NAS_IP` - NAS IP address
- `NAS_USERNAME` - SSH username
- `NAS_PASSWORD` - SSH password
- `NAS_APP_DIR` - Application directory on NAS

## Files That Should Never Be Committed

The following files are excluded in `.gitignore`:

- `.env` - Contains all sensitive environment variables
- `.env.local` - Local environment overrides
- `config.local.js` - Local configuration overrides (if created)
- `restart-server.local.ps1` - Local restart script with credentials (if created)

## Docker Compose

When using Docker Compose, make sure to set `DB_PASSWORD` as an environment variable:

```bash
# Set environment variable
export DB_PASSWORD=your_secure_password

# Or create .env file
echo "DB_PASSWORD=your_secure_password" > .env

# Then run docker-compose
docker-compose up -d
```

## Best Practices

1. **Never hardcode passwords** in source code
2. **Use strong, unique passwords** for production
3. **Rotate passwords regularly**
4. **Use different passwords** for development and production
5. **Review `.gitignore`** before committing to ensure sensitive files are excluded
6. **Use environment-specific `.env` files** (e.g., `.env.development`, `.env.production`)

## If You Accidentally Committed a Password

If you accidentally committed a password to Git:

1. **Immediately change the password** in your database/system
2. **Remove the password from Git history:**
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/file" \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. **Force push** (if already pushed to remote):
   ```bash
   git push origin --force --all
   ```
4. **Notify team members** to pull the updated repository

## Security Checklist

Before committing code:

- [ ] No hardcoded passwords in source files
- [ ] `.env` file is in `.gitignore`
- [ ] All sensitive data uses environment variables
- [ ] Documentation uses placeholder values (e.g., 'your_password')
- [ ] No API keys or tokens in code
- [ ] Database credentials are environment variables only

