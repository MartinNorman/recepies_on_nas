# How to Restart the Server

## Quick Start: Restart Server via SSH (Synology NAS)

**This is the recommended method if you're using the start.sh/stop.sh scripts on Synology NAS.**

### Step-by-Step Instructions

1. **SSH into your Synology NAS:**
   ```bash
   ssh your-username@your-synology-ip
   ```

2. **Navigate to the app directory:**
   ```bash
   cd /volume1/homes/Martin/recept
   ```

3. **Stop the server:**
   ```bash
   bash synology/stop.sh
   ```

4. **Start the server:**
   ```bash
   bash synology/start.sh
   ```

### One-Line Restart Command

You can also combine the stop and start commands:
```bash
cd /volume1/homes/Martin/recept && bash synology/stop.sh && sleep 2 && bash synology/start.sh
```

### Verify Server is Running

After restarting, check if the server started successfully:

```bash
# Check if process is running
ps aux | grep "[n]ode.*server.js"

# Check if port 3000 is in use
netstat -tlnp 2>/dev/null | grep :3000

# View the logs
tail -f logs/app.log
```

### View Logs

To see what's happening with the server:
```bash
# View recent log entries
tail -20 logs/app.log

# Follow logs in real-time
tail -f logs/app.log
```

---

## Alternative Methods (If Quick Start Doesn't Work)

If the method above doesn't work for your setup, check which method you're using:

Before restarting, determine how your server is currently running:

### Check if PM2 is Running

**On Synology NAS (via SSH):**

First, find where Node.js is installed:
```bash
# Find Node.js installation
find /var/packages -name "node" -type f 2>/dev/null

# Find npm (Node.js package manager)
find /var/packages -name "npm" -type f 2>/dev/null

# Check which node version you have
which node
node --version
```

Then check if PM2 is installed:
```bash
# Try the standard command
pm2 list
```

**If you get "command not found", try to find PM2:**
```bash
# Search for PM2 installation
find /var/packages -name "pm2" -type f 2>/dev/null

# Check common Node.js global package locations
find /usr -name "pm2" -type f 2>/dev/null
find ~ -name "pm2" -type f 2>/dev/null
```

**Check if PM2 process exists:**
```bash
ps aux | grep pm2
```

**What to look for:**
- If `pm2 list` shows a table with "recept-app" or your app name listed → **You're using PM2** (use Option 1)
- If you find PM2 with `find` command → **PM2 is installed but not in PATH** (use Option 1 with full path)
- If PM2 is not found anywhere → **PM2 is not installed** (you're **NOT using PM2**, skip to Option 2 or 3)

### Check if Node.js Process is Running Directly

**On Synology NAS:**
```bash
# Check for node processes
ps aux | grep node
```

**What to look for:**
- If you see `node server.js` or `node.exe` running → **You're using direct Node.js** (use Option 2 or 3)
- If you see `nodemon` → **You're using npm run dev** (use Option 3)

### Check for PID File

**On Synology NAS:**
```bash
# Check if app.pid file exists
ls -la app.pid
cat app.pid
```

**What to look for:**
- If `app.pid` exists with a process ID → **You might be using a start script** (use Option 2)

### Quick Decision Tree

1. **Run `find /var/packages -name "pm2"`** → If PM2 is found AND `pm2 list` shows your app → **Use Option 1 (PM2)**
2. **If PM2 is not found anywhere** → **You're NOT using PM2** → **Skip Option 1, go to Option 2 or 3**
3. **Check process list** (`ps aux | grep node`) → If you see `node server.js` → **Use Option 2 or 3**
4. **Check for start.sh script** (`ls -la synology/start.sh`) → If it exists → **Use Option 2**
5. **Check terminal** → If you see "nodemon" → **Use Option 3 (npm run dev)**
6. **Not sure?** → Try Option 3 first (simplest method, doesn't require PM2)

---

## Option 1: If using PM2 (Recommended for Synology NAS)

If your server is running with PM2, use these commands:

### Check if PM2 is Installed

First, find where Node.js and npm are installed:

```bash
# Find Node.js
find /var/packages -name "node" -type f 2>/dev/null

# Find npm
find /var/packages -name "npm" -type f 2>/dev/null

# Or check which node/npm you have
which node
which npm
```

Then check if PM2 exists:

```bash
# Search for PM2
find /var/packages -name "pm2" -type f 2>/dev/null
find /usr -name "pm2" -type f 2>/dev/null

# Check if PM2 is in PATH
which pm2
```

### Install PM2 (if not installed)

**If PM2 is not installed**, you have two options:

**Option A: Install PM2 (if you want to use it)**
```bash
# First, find your npm path
NPM_PATH=$(find /var/packages -name "npm" -type f 2>/dev/null | head -1)

# If npm is in PATH, use:
npm install -g pm2

# Otherwise, use the full path:
$NPM_PATH install -g pm2

# Or manually specify the path (replace with your actual path):
/var/packages/Node.js_v18/target/bin/npm install -g pm2
```

**Option B: Don't use PM2 (simpler)**
If PM2 is not installed, you're likely not using it. Skip to **Option 2** or **Option 3** below - they don't require PM2.

### Restart the Server with PM2

**Only use this if PM2 is actually installed and your app is running under PM2.**

**Via SSH on Synology NAS:**
```bash
# SSH into your NAS first
ssh admin@your-nas-ip

# Navigate to the app directory
cd /volume1/homes/Martin/recept

# First, find where PM2 is installed (if it exists)
PM2_PATH=$(find /var/packages -name "pm2" -type f 2>/dev/null | head -1)

# If PM2 is in PATH:
pm2 restart recept-app

# Otherwise, use the full path you found:
$PM2_PATH restart recept-app

# IMPORTANT: If PM2 is not found, you're NOT using PM2 - skip to Option 2 or 3
```

### Check PM2 status:
```bash
# If PM2 is in PATH:
pm2 status
pm2 logs recept-app

# Otherwise, use the full path (replace with path found above):
$PM2_PATH status
$PM2_PATH logs recept-app
```

**Important:** If `find /var/packages -name "pm2"` returns nothing, PM2 is **NOT installed** and you're **NOT using PM2**. Skip to Option 2 or 3 below.

---

## Option 2: If using a simple Node.js process (Alternative to Quick Start)

**Note:** This is essentially the same as the Quick Start method above, but with additional troubleshooting steps.

### On Synology NAS (if using start.sh script):

**IMPORTANT: If you get "port already in use" error, first kill any process using port 3000:**

```bash
# Find and kill processes using port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Or if lsof is not available, use netstat:
netstat -tlnp 2>/dev/null | grep :3000 | awk '{print $7}' | cut -d'/' -f1 | xargs kill -9 2>/dev/null

# Or find node processes and kill them:
ps aux | grep "[n]ode.*server.js" | awk '{print $2}' | xargs kill -9 2>/dev/null
```

Then restart:

```bash
# Navigate to the app directory
cd /volume1/homes/Martin/recept

# Stop the server
bash synology/stop.sh

# Wait a moment for port to be released
sleep 2

# Start it again
bash synology/start.sh
```

**Check if it started successfully:**
```bash
# Check the logs
tail -f logs/app.log

# Check if process is running
ps aux | grep "[n]ode.*server.js"

# Check if port 3000 is in use
netstat -tlnp 2>/dev/null | grep :3000
```

---

## Option 3: If running with npm directly

### On Synology NAS:
1. SSH into your NAS and navigate to the app directory
2. If the server is running in the foreground, press `Ctrl+C` to stop it
3. Then restart:
```bash
cd /volume1/homes/Martin/recept
npm start
```

### For development (with auto-reload):
```bash
cd /volume1/homes/Martin/recept
npm run dev
```

---

## Troubleshooting: Port Already in Use

If you get "EADDRINUSE: address already in use" error, port 3000 is still occupied:

### Find and Kill Process Using Port 3000

```bash
# Method 1: Using lsof (if available)
lsof -ti:3000 | xargs kill -9

# Method 2: Using netstat (more common on Synology)
netstat -tlnp 2>/dev/null | grep :3000

# Then kill the PID shown (replace PID with actual number):
kill -9 <PID>

# Method 3: Find all node processes
ps aux | grep node

# Kill specific node process (replace PID):
kill -9 <PID>

# Method 4: Kill all node processes (be careful!)
pkill -9 node
```

### Verify Port is Free

```bash
# Check if port 3000 is free
netstat -tlnp 2>/dev/null | grep :3000

# Should return nothing if port is free
```

Then try starting the server again.

---

## Quick Check: Which method are you using?

1. **Check if PM2 is installed and running:**
   ```bash
   # First, find if PM2 exists
   find /var/packages -name "pm2" -type f 2>/dev/null
   
   # If found, try to list processes
   pm2 list
   # Or with full path (replace with actual path found above)
   ```
   If PM2 is not found → **You're NOT using PM2** → Skip to Option 2 or 3.
   If PM2 is found and shows "recept-app" → Use PM2 commands (Option 1).

2. **Check if there's a PID file:**
   - If `app.pid` exists in the project root, you might be using a start script
   - Check the PID: `cat app.pid`
   - Check for start/stop scripts: `ls -la synology/start.sh synology/stop.sh`

3. **Check running processes:**
   ```bash
   ps aux | grep node
   ```

---

## After Restarting

After restarting, verify the server is working:

1. **Check the logs** to ensure there are no errors
2. **Test the web interface** - try accessing the recipe app in your browser
3. **Check the process** is running: `ps aux | grep "[n]ode.*server.js"`

If you encounter any issues, see the Troubleshooting section below.
