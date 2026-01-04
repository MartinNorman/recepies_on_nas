# Security Migration Guide

## What Was Changed

All hardcoded passwords have been removed from the codebase and replaced with environment variables. This ensures your passwords are never committed to Git.

### Files Modified

1. **`config.js`**
   - ❌ Removed: Hardcoded default password `'MNOmno001'`
   - ✅ Now: Requires `DB_PASSWORD` environment variable (no default)
   - Impact: Application will fail to start if `DB_PASSWORD` is not set

2. **`docker-compose.yml`**
   - ❌ Removed: Default password fallback `MNOmno001`
   - ✅ Now: Requires `DB_PASSWORD` environment variable (will error if not set)
   - Impact: Docker Compose will fail if `DB_PASSWORD` is not set

3. **`restart-server.ps1`**
   - ❌ Removed: Hardcoded NAS credentials
   - ✅ Now: Uses environment variables (`NAS_IP`, `NAS_USERNAME`, `NAS_PASSWORD`, `NAS_APP_DIR`)
   - Impact: Script will prompt for missing environment variables

### Files Created

1. **`.env.example`**
   - Template file showing all required environment variables
   - Safe to commit to Git (contains no real passwords)
   - Copy to `.env` and fill in your actual values

2. **`SECURITY.md`**
   - Security guidelines and best practices
   - Instructions for handling environment variables
   - What to do if you accidentally commit a password

### Files Updated

1. **`.gitignore`**
   - Already excluded `.env` files
   - Added exclusions for local override files

## What You Need to Do

### Step 1: Create Your `.env` File

```bash
# Copy the example file
cp .env.example .env

# Or on Windows PowerShell:
Copy-Item .env.example .env
```

### Step 2: Edit `.env` and Add Your Passwords

Open `.env` in a text editor and replace the placeholder values:

```env
# Required - Database password
DB_PASSWORD=your_actual_database_password

# Optional - Only if you use restart-server.ps1
NAS_PASSWORD=your_nas_ssh_password
NAS_IP=192.168.50.60
NAS_USERNAME=admin
NAS_APP_DIR=/volume1/homes/Martin/recept
```

### Step 3: Verify `.env` is Not in Git

Check that `.env` is not tracked by Git:

```bash
git status
```

You should NOT see `.env` in the list of files. If you do, it means it was previously committed. See "If .env Was Already Committed" below.

### Step 4: Test the Application

Start your application to verify it works:

```bash
# For Node.js
npm start

# For Docker
docker-compose up -d
```

The application should connect to the database using the password from your `.env` file.

## If `.env` Was Already Committed

If you previously committed a `.env` file with passwords:

1. **Immediately change your passwords** in the database/system
2. **Remove the file from Git:**
   ```bash
   git rm --cached .env
   git commit -m "Remove .env file from Git"
   ```
3. **Verify it's in `.gitignore`:**
   ```bash
   cat .gitignore | grep .env
   ```
4. **If you pushed to GitHub, consider:**
   - Changing the passwords (already done in step 1)
   - Using GitHub's secret scanning to check for exposed secrets
   - If it was a public repo, assume the passwords are compromised

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_PASSWORD` | Database password | `mySecurePassword123` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DB_TYPE` | Database type | `postgres` | `postgres`, `mariadb`, `mysql` |
| `DB_HOST` | Database host | `localhost` | `localhost`, `192.168.1.100` |
| `DB_PORT` | Database port | `5432` (PostgreSQL) or `3306` (MariaDB) | `5432` |
| `DB_NAME` | Database name | `recepie_db` | `recepie_db` |
| `DB_USER` | Database user | `postgres` or `root` | `postgres` |
| `PORT` | Server port | `3000` | `3000` |
| `NAS_IP` | NAS IP address (for restart script) | - | `192.168.50.60` |
| `NAS_USERNAME` | NAS SSH username (for restart script) | - | `admin` |
| `NAS_PASSWORD` | NAS SSH password (for restart script) | - | `your_password` |
| `NAS_APP_DIR` | App directory on NAS (for restart script) | - | `/volume1/homes/Martin/recept` |

## Docker Compose

When using Docker Compose, make sure to set `DB_PASSWORD`:

```bash
# Option 1: Use .env file (recommended)
echo "DB_PASSWORD=your_password" >> .env
docker-compose up -d

# Option 2: Set as environment variable
export DB_PASSWORD=your_password
docker-compose up -d
```

## Verification Checklist

- [ ] Created `.env` file from `.env.example`
- [ ] Added `DB_PASSWORD` to `.env`
- [ ] Verified `.env` is NOT in `git status`
- [ ] Application starts successfully
- [ ] Database connection works
- [ ] If using restart script, added NAS credentials to `.env`

## Security Best Practices

1. ✅ **Never commit `.env` files** - Already in `.gitignore`
2. ✅ **Use strong passwords** - At least 16 characters, mix of letters, numbers, symbols
3. ✅ **Use different passwords** for development and production
4. ✅ **Rotate passwords regularly** - Especially if they were ever in Git
5. ✅ **Review commits before pushing** - Use `git diff` to check what you're committing
6. ✅ **Use environment-specific files** - `.env.development`, `.env.production` (all in `.gitignore`)

## Troubleshooting

### Application won't start - "DB_PASSWORD is required"

**Solution:** Make sure you created `.env` file and added `DB_PASSWORD=your_password`

### Docker Compose fails - "DB_PASSWORD environment variable is required"

**Solution:** Set `DB_PASSWORD` in your `.env` file or as an environment variable before running `docker-compose up`

### Restart script fails - "NAS_PASSWORD environment variable is required"

**Solution:** Add NAS credentials to your `.env` file:
```env
NAS_IP=192.168.50.60
NAS_USERNAME=admin
NAS_PASSWORD=your_password
NAS_APP_DIR=/volume1/homes/Martin/recept
```

## Need Help?

- See `SECURITY.md` for detailed security guidelines
- Check `.env.example` for all available environment variables
- Review `.gitignore` to ensure sensitive files are excluded

