# Deploying Recipe App to Synology NAS DS218 (Node.js)

This guide explains how to deploy the Recipe Application directly using Node.js on your Synology NAS.

## Prerequisites

### 1. Install Node.js Package

1. Open **Package Center** on your Synology DSM
2. Search for **"Node.js"**
3. Install **Node.js v18** (or latest LTS version)

### 2. Install PostgreSQL (MariaDB alternative or external)

**Option A: Use MariaDB (built-in)**
- Install MariaDB 10 from Package Center
- Note: You'll need to modify the app to use MySQL/MariaDB instead of PostgreSQL

**Option B: Use external PostgreSQL**
- Run PostgreSQL on another machine (PC, Raspberry Pi, etc.)
- Or use a cloud PostgreSQL service

**Option C: Install PostgreSQL via ipkg/Entware** (Advanced)
```bash
# Requires Entware installed
opkg install postgresql
```

For this guide, we'll assume **Option B** - using your Windows PC as the database server temporarily, or you can adapt to MariaDB.

### 3. Enable SSH

1. Go to **Control Panel** > **Terminal & SNMP**
2. Enable **SSH service**
3. Set a port (default: 22)

---

## Deployment Steps

### Step 1: Create Application Directory

SSH into your NAS:
```bash
ssh admin@your-nas-ip -p 22
```

Create directory:
```bash
mkdir -p /volume1/homes/Martin/recept
cd /volume1/homes/Martin/recept
```

### Step 2: Copy Application Files

From your Windows PC, copy files to NAS:

**Option A: Using SCP**
```bash
# Run this from your Windows PC (PowerShell or Git Bash)
scp -r C:\mano\Climber\Privat\recept\* admin@nas-ip:/volume1/homes/Martin/recept/
```

**Option B: Using File Station**
1. Open File Station in DSM
2. Navigate to `/volume1/homes/Martin/recept`
3. Upload all project files

**Important files to copy:**
- `server.js`
- `config.js`
- `package.json`
- `package-lock.json`
- `routes/` folder
- `services/` folder
- `public/` folder
- `scripts/` folder

### Step 3: Install Dependencies

SSH into NAS and install npm packages:
```bash
cd /volume1/homes/Martin/recept
/var/packages/Node.js_v18/target/bin/npm install --production
```

Note: The exact path may vary based on your Node.js version. Find it with:
```bash
find /var/packages -name "npm" -type f 2>/dev/null
```

### Step 4: Configure Environment

Create `.env` file:
```bash
cat > /volume1/homes/Martin/recept/.env << 'EOF'
# Database Configuration
# If using external PostgreSQL on your Windows PC:
DB_HOST=192.168.x.x
DB_PORT=5432
DB_NAME=recepie_db
DB_USER=postgres
DB_PASSWORD=your_password

# Server Port
PORT=3000

# Home Assistant Integration
HA_BASE_URL=http://192.168.x.x:8123
HA_TOKEN=your_long_lived_access_token
EOF
```

Replace:
- `192.168.x.x` with your PostgreSQL server IP
- `your_password` with your database password
- Home Assistant details as needed

### Step 5: Initialize Database

If using PostgreSQL on Windows, make sure:
1. PostgreSQL is running
2. It accepts connections from your NAS IP
3. Run the init script:

```bash
# From your Windows PC where PostgreSQL is installed
psql -U postgres -d recepie_db -f C:\mano\Climber\Privat\recept\scripts\init-db.sql
```

Or from NAS (if psql client is available):
```bash
psql -h windows-ip -U postgres -d recepie_db -f /volume1/homes/Martin/recept/scripts/init-db.sql
```

### Step 6: Test the Application

Start the app manually first:
```bash
cd /volume1/homes/Martin/recept
/var/packages/Node.js_v18/target/bin/node server.js
```

You should see:
```
Server is running on port 3000
```

Test in browser: `http://nas-ip:3000`

Press `Ctrl+C` to stop.

---

## Running as a Service

### Option 1: Using Synology Task Scheduler (Easiest)

1. Open **Control Panel** > **Task Scheduler**
2. Create > **Triggered Task** > **User-defined script**
3. Configure:
   - Task: `Recipe App`
   - User: `root`
   - Event: Boot-up
   - Enabled: Yes
4. Task Settings > Run command:
```bash
cd /volume1/homes/Martin/recept && /var/packages/Node.js_v18/target/bin/node server.js >> /volume1/homes/Martin/recept/logs/app.log 2>&1
```

5. Create logs directory:
```bash
mkdir -p /volume1/homes/Martin/recept/logs
```

### Option 2: Using PM2 Process Manager (Recommended)

PM2 keeps your app running and restarts it if it crashes.

#### Install PM2
```bash
/var/packages/Node.js_v18/target/bin/npm install -g pm2
```

#### Create PM2 Startup Script

Create `/volume1/homes/Martin/recept/ecosystem.config.js`:
```bash
cat > /volume1/homes/Martin/recept/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'recept-app',
    script: 'server.js',
    cwd: '/volume1/homes/Martin/recept',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/volume1/homes/Martin/recept/logs/err.log',
    out_file: '/volume1/homes/Martin/recept/logs/out.log',
    log_file: '/volume1/homes/Martin/recept/logs/combined.log',
    time: true
  }]
};
EOF
```

#### Start with PM2
```bash
cd /volume1/homes/Martin/recept
/var/packages/Node.js_v18/target/bin/pm2 start ecosystem.config.js
```

#### Auto-start on Boot

Create startup script in Task Scheduler:
```bash
/var/packages/Node.js_v18/target/bin/pm2 resurrect
```

Save PM2 process list:
```bash
/var/packages/Node.js_v18/target/bin/pm2 save
```

#### PM2 Commands
```bash
# Check status
pm2 status

# View logs
pm2 logs recept-app

# Restart
pm2 restart recept-app

# Stop
pm2 stop recept-app
```

### Option 3: Simple Startup Script

Create `/volume1/homes/Martin/recept/start.sh`:
```bash
cat > /volume1/homes/Martin/recept/start.sh << 'EOF'
#!/bin/bash
cd /volume1/homes/Martin/recept
export NODE_PATH=/var/packages/Node.js_v18/target/bin
export PATH=$NODE_PATH:$PATH

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Start the application
node server.js >> logs/app.log 2>&1 &
echo $! > app.pid
echo "Started Recipe App with PID $(cat app.pid)"
EOF

chmod +x /volume1/homes/Martin/recept/start.sh
```

Create stop script:
```bash
cat > /volume1/homes/Martin/recept/stop.sh << 'EOF'
#!/bin/bash
if [ -f /volume1/homes/Martin/recept/app.pid ]; then
  kill $(cat /volume1/homes/Martin/recept/app.pid)
  rm /volume1/homes/Martin/recept/app.pid
  echo "Stopped Recipe App"
else
  echo "PID file not found"
fi
EOF

chmod +x /volume1/homes/Martin/recept/stop.sh
```

Add to Task Scheduler boot script:
```bash
/volume1/homes/Martin/recept/start.sh
```

---

## Using MariaDB Instead of PostgreSQL

The application now supports MariaDB/MySQL natively! Here's how to set it up:

### 1. Install MariaDB 10 from Package Center

### 2. Create Database
```bash
mysql -u root -p
```

```sql
CREATE DATABASE recepie_db;
CREATE USER 'recept_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON recepie_db.* TO 'recept_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Initialize Database Schema
```bash
mysql -u recept_user -p recepie_db < /volume1/homes/Martin/recept/scripts/init-db-mariadb.sql
```

### 4. Configure Environment for MariaDB

Update your `.env` file:
```bash
cat > /volume1/homes/Martin/recept/.env << 'EOF'
# Database Configuration for MariaDB
DB_TYPE=mariadb
DB_HOST=localhost
DB_PORT=3306
DB_NAME=recepie_db
DB_USER=recept_user
DB_PASSWORD=your_password

# Server Port
PORT=3000

# Home Assistant Integration
HA_BASE_URL=http://192.168.x.x:8123
HA_TOKEN=your_long_lived_access_token
EOF
```

**Important**: Set `DB_TYPE=mariadb` to use MariaDB instead of PostgreSQL.

### 5. Install Dependencies

The mysql2 driver is already included in package.json:
```bash
cd /volume1/homes/Martin/recept
npm install --production
```

That's it! The application will automatically detect MariaDB and use the appropriate SQL syntax.

---

## Firewall Configuration

If you have Synology Firewall enabled:

1. Go to **Control Panel** > **Security** > **Firewall**
2. Create rule to allow port 3000 (or your chosen port)
3. Allow incoming connections from your local network

---

## Accessing the Application

- **Local network**: `http://nas-ip:3000`
- **Example**: `http://192.168.1.50:3000`

---

## Troubleshooting

### App won't start
```bash
# Check if port is in use
netstat -tlnp | grep 3000

# Check Node.js path
which node
# or
find /var/packages -name "node" -type f

# Run with verbose output
cd /volume1/homes/Martin/recept
node server.js
```

### Database connection issues
```bash
# Test PostgreSQL connection from NAS
# Install postgresql-client if available via opkg/ipkg
psql -h db-server-ip -U postgres -d recepie_db -c "SELECT 1"

# Check if database server allows remote connections
# Edit pg_hba.conf on your PostgreSQL server
```

### Permission issues
```bash
# Fix ownership
chown -R admin:users /volume1/homes/Martin/recept

# Fix execution permissions
chmod +x /volume1/homes/Martin/recept/*.sh
```

### View logs
```bash
tail -f /volume1/homes/Martin/recept/logs/app.log
# or with PM2
pm2 logs recept-app
```

### Memory issues on DS218
The DS218 has limited RAM. Monitor usage:
```bash
free -m
top
```

If memory is tight:
- Close unnecessary DSM packages
- Set `max_old_space_size` for Node.js:
```bash
node --max-old-space-size=256 server.js
```

---

## Updating the Application

1. Stop the app:
```bash
/volume1/homes/Martin/recept/stop.sh
# or
pm2 stop recept-app
```

2. Copy new files (backup old ones first)

3. Install any new dependencies:
```bash
cd /volume1/homes/Martin/recept
npm install --production
```

4. Restart:
```bash
/volume1/homes/Martin/recept/start.sh
# or
pm2 restart recept-app
```

---

## Backup

### Application files
```bash
tar -czf /volume1/backups/recept-app-$(date +%Y%m%d).tar.gz /volume1/homes/Martin/recept
```

### Database (if on NAS)
```bash
# For PostgreSQL
pg_dump -h localhost -U postgres recepie_db > /volume1/backups/recept-db-$(date +%Y%m%d).sql

# For MariaDB
mysqldump -u root -p recepie_db > /volume1/backups/recept-db-$(date +%Y%m%d).sql
```

---

## Next Steps

1. Set up the database (PostgreSQL external or MariaDB local)
2. Copy application files to NAS
3. Install dependencies with npm
4. Configure environment variables
5. Test manually
6. Set up automatic startup
7. Configure Home Assistant integration

If you need help adapting the code for MariaDB, or setting up PostgreSQL to accept remote connections, let me know!
