# Debugging Server Startup Issues

If the server won't start, follow these steps to diagnose the problem:

## Step 1: Check Recent Logs

```bash
cd /volume1/homes/Martin/recept
tail -30 logs/app.log
```

Look for error messages at the end of the log file.

## Step 2: Find Node.js Installation

```bash
# Find where Node.js is installed
find /var/packages -name "node" -type f 2>/dev/null

# Check which node is in PATH
which node

# Check node version
node --version
```

## Step 3: Try Running Server Manually

This will show you the actual error:

```bash
cd /volume1/homes/Martin/recept

# Find node path
NODE_PATH=$(find /var/packages -name "node" -type f 2>/dev/null | head -1)

# Try running directly (this will show errors in terminal)
$NODE_PATH server.js
```

Press Ctrl+C to stop it, then note any error messages.

## Step 4: Check Database Connection

The server might be failing to connect to the database:

```bash
# Check if .env file exists and has correct settings
cat /volume1/homes/Martin/recept/.env

# Test database connection (if you have psql or mysql client)
# For PostgreSQL:
psql -h localhost -U your_user -d recepie_db -c "SELECT 1;"

# For MariaDB:
mysql -u your_user -p recepie_db -e "SELECT 1;"
```

## Step 5: Check Dependencies

Make sure all npm packages are installed:

```bash
cd /volume1/homes/Martin/recept

# Find npm
NPM_PATH=$(find /var/packages -name "npm" -type f 2>/dev/null | head -1)

# Check if node_modules exists
ls -la node_modules

# If missing, install dependencies
$NPM_PATH install
```

## Step 6: Check File Permissions

```bash
cd /volume1/homes/Martin/recept

# Check permissions
ls -la server.js
ls -la synology/start.sh

# Make sure start.sh is executable
chmod +x synology/start.sh
chmod +x synology/stop.sh
```

## Step 7: Check Port Availability

```bash
# Check if port 3000 is really free
netstat -tlnp 2>/dev/null | grep :3000

# Check all node processes
ps aux | grep node

# Kill any remaining node processes
ps aux | grep node | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
```

## Common Errors and Solutions

### Error: "Cannot find module"
**Solution:** Run `npm install` to install dependencies

### Error: "EADDRINUSE: address already in use"
**Solution:** Kill the process using port 3000 (see Step 7)

### Error: "ECONNREFUSED" or database connection error
**Solution:** 
- Check database is running
- Verify .env file has correct database credentials
- Test database connection manually

### Error: "Node.js not found"
**Solution:** 
- Find correct Node.js path with `find /var/packages -name "node"`
- Update start.sh with correct path

### Error: "Permission denied"
**Solution:**
- Check file permissions: `chmod +x synology/start.sh`
- Check directory permissions: `ls -la`

## Getting Help

If none of these work, collect this information:

```bash
# System info
uname -a
node --version 2>/dev/null || echo "Node not in PATH"
which node

# Recent logs
tail -50 /volume1/homes/Martin/recept/logs/app.log

# Process info
ps aux | grep node

# Port info
netstat -tlnp 2>/dev/null | grep :3000

# Node.js location
find /var/packages -name "node" -type f 2>/dev/null
```

