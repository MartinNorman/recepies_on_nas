# Deploying Recipe App to Synology NAS DS218

This guide explains how to deploy the Recipe Application with Home Assistant integration to your Synology NAS.

## Prerequisites

1. **Docker package installed** on your Synology NAS
   - Open Package Center
   - Search for "Docker"
   - Install it

2. **SSH access enabled** (recommended)
   - Control Panel > Terminal & SNMP > Enable SSH service

3. **Shared folder** for the application (e.g., `/volume1/docker/recept`)

## Deployment Options

### Option 1: Using Docker Compose (Recommended)

#### Step 1: Copy files to NAS

Copy the entire project folder to your NAS:
```bash
# From your computer, use SCP or File Station
scp -r /path/to/recept user@nas-ip:/volume1/docker/
```

Or use File Station to upload the folder.

#### Step 2: Create environment file

SSH into your NAS or create the file via File Station:

```bash
ssh user@nas-ip
cd /volume1/docker/recept
```

Create `.env` file:
```bash
cat > .env << 'EOF'
# Database
DB_PASSWORD=your_secure_password_here

# Home Assistant Integration
HA_BASE_URL=http://your-home-assistant-ip:8123
HA_TOKEN=your_long_lived_access_token
EOF
```

**Important**: Replace:
- `your_secure_password_here` with a strong password
- `your-home-assistant-ip` with your HA server's IP
- `your_long_lived_access_token` with your HA token

#### Step 3: Build and start containers

```bash
cd /volume1/docker/recept
sudo docker-compose up -d --build
```

#### Step 4: Verify deployment

```bash
# Check if containers are running
sudo docker-compose ps

# View logs
sudo docker-compose logs -f app
```

The app should be available at: `http://nas-ip:3000`

---

### Option 2: Using Synology Docker UI

#### Step 1: Build image manually

SSH into NAS:
```bash
ssh user@nas-ip
cd /volume1/docker/recept
sudo docker build -t recept-app:latest .
```

#### Step 2: Set up PostgreSQL via Docker UI

1. Open Docker in DSM
2. Go to Registry, search for `postgres`
3. Download `postgres:15-alpine`
4. Go to Image > Launch
5. Configure:
   - Container Name: `recept-db`
   - Enable auto-restart
   - Port: 5432 (local) -> 5432 (container)
   - Environment variables:
     - `POSTGRES_DB=recepie_db`
     - `POSTGRES_USER=postgres`
     - `POSTGRES_PASSWORD=your_password`
   - Volume: `/volume1/docker/recept-data` -> `/var/lib/postgresql/data`

#### Step 3: Initialize database

Connect to the database and run the init script:
```bash
sudo docker exec -i recept-db psql -U postgres -d recepie_db < /volume1/docker/recept/scripts/init-db.sql
```

#### Step 4: Launch app container via Docker UI

1. Go to Image
2. Select `recept-app:latest`
3. Launch with:
   - Container Name: `recept-app`
   - Enable auto-restart
   - Port: 3000 (local) -> 3000 (container)
   - Environment variables:
     - `DB_HOST=recept-db` (or use NAS IP)
     - `DB_PORT=5432`
     - `DB_NAME=recepie_db`
     - `DB_USER=postgres`
     - `DB_PASSWORD=your_password`
     - `HA_BASE_URL=http://home-assistant-ip:8123`
     - `HA_TOKEN=your_token`
   - Link: Link to `recept-db` container

---

## Managing the Application

### Start/Stop
```bash
cd /volume1/docker/recept
sudo docker-compose start
sudo docker-compose stop
```

### View logs
```bash
sudo docker-compose logs -f app
sudo docker-compose logs -f db
```

### Update application
```bash
cd /volume1/docker/recept
git pull  # or copy new files
sudo docker-compose down
sudo docker-compose up -d --build
```

### Backup database
```bash
sudo docker exec recept-db pg_dump -U postgres recepie_db > backup.sql
```

### Restore database
```bash
sudo docker exec -i recept-db psql -U postgres -d recepie_db < backup.sql
```

---

## Networking Considerations

### Home Assistant Connection

Since both your NAS and Home Assistant are on your local network:

1. Use the **internal IP address** of your Home Assistant (e.g., `192.168.1.100`)
2. Make sure the NAS can reach Home Assistant on port 8123
3. Create a Long-Lived Access Token in Home Assistant:
   - Profile (bottom left) > Long-Lived Access Tokens > Create Token

### Accessing from outside your network

If you want to access the recipe app externally:

1. **Synology QuickConnect** - Easiest but may have limitations
2. **Reverse Proxy** - Set up in Control Panel > Application Portal
3. **Port Forwarding** - Forward port 3000 in your router (less secure)

---

## Troubleshooting

### Container won't start
```bash
# Check logs
sudo docker-compose logs app

# Common issues:
# - Database not ready: Wait for db health check
# - Port already in use: Change port in docker-compose.yml
```

### Can't connect to Home Assistant
```bash
# Test from NAS
curl -H "Authorization: Bearer YOUR_TOKEN" http://ha-ip:8123/api/

# Check firewall settings on both NAS and HA
```

### Database connection issues
```bash
# Verify db is running
sudo docker-compose ps

# Check db logs
sudo docker-compose logs db

# Test connection
sudo docker exec -it recept-db psql -U postgres -d recepie_db
```

### Permission issues
```bash
# Fix permissions on volumes
sudo chown -R 1000:1000 /volume1/docker/recept
```

---

## Resource Usage

The DS218 has limited resources (1GB RAM, dual-core ARM). Expected usage:

- **PostgreSQL**: ~100-200MB RAM
- **Node.js App**: ~50-100MB RAM
- **Total**: ~200-400MB RAM

This should run fine on your DS218, but avoid running too many other Docker containers simultaneously.

---

## Security Recommendations

1. **Change default database password** in `.env`
2. **Don't expose ports externally** unless necessary
3. **Keep Docker images updated**:
   ```bash
   sudo docker-compose pull
   sudo docker-compose up -d --build
   ```
4. **Use HTTPS** if accessing externally (via reverse proxy)
5. **Backup regularly** - especially the database
