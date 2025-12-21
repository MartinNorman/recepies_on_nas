# Connecting to MariaDB on Synology NAS

Since your database is on a Synology NAS, you need to connect to the NAS IP address, not localhost.

## Finding Your NAS IP Address

1. **From phpMyAdmin:**
   - Check the phpMyAdmin URL - it might show the NAS IP
   - Or check phpMyAdmin config on the NAS

2. **From Synology DSM:**
   - Log into your Synology NAS web interface
   - Go to Control Panel > Network
   - Check the IP address (usually something like 192.168.x.x)

3. **From your router:**
   - Check connected devices
   - Look for your Synology device

## MariaDB Configuration on Synology

The `my.ini` or `my.cnf` file on Synology is typically located at:
- `/usr/local/mariadb10/var/my.cnf` (for MariaDB 10)
- Or check: `/volume1/@database/mariadb/` directory

But you usually configure MariaDB through Synology's Package Center interface, not by editing files directly.

## Important Settings

1. **Enable Remote Access:**
   - In Synology DSM, go to MariaDB package settings
   - Enable "Allow remote connections" or similar option
   - Make sure the port is open (default 3306)

2. **Check Firewall:**
   - Synology Firewall might be blocking connections
   - Allow port 3306 (or your custom port) for your local network

3. **Update .env file:**
   - Change `DB_HOST` from `127.0.0.1` to your NAS IP address
   - Example: `DB_HOST=192.168.1.100`
   - Keep the port (usually 3306, but check your MariaDB settings)

## Testing Connection

Once you have the NAS IP, update your `.env` file and test:
```bash
node scripts/simple-connection-test.js
```

