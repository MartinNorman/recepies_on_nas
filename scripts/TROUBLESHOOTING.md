# Troubleshooting Database Connection

## The Problem
Your Node.js script can't connect to MariaDB via TCP/IP, but phpMyAdmin works. This usually means MariaDB is configured to only accept socket connections.

## Solution Steps

### Step 1: Find the Correct Port from phpMyAdmin

1. Open phpMyAdmin in your browser
2. Look at the **URL** - it might show the port (e.g., `http://localhost:8080/phpmyadmin`)
3. Or check phpMyAdmin's **config.inc.php** file:
   - XAMPP: `C:\xampp\phpMyAdmin\config.inc.php`
   - WAMP: `C:\wamp\apps\phpmyadmin\config.inc.php`
   - Look for: `$cfg['Servers'][$i]['host']` and `$cfg['Servers'][$i]['port']`

### Step 2: Enable TCP/IP in MariaDB

MariaDB might be configured to only accept socket connections. To enable TCP/IP:

1. **Find MariaDB config file:**
   - XAMPP: `C:\xampp\mysql\bin\my.ini`
   - WAMP: `C:\wamp\bin\mysql\mysql[version]\my.ini`
   - Standalone: Check MariaDB installation directory

2. **Open `my.ini` and find `[mysqld]` section**

3. **Look for these settings:**
   ```ini
   [mysqld]
   port = 3306
   bind-address = 127.0.0.1
   ```

4. **If `bind-address` is missing or set incorrectly:**
   - Add or change: `bind-address = 127.0.0.1`
   - This allows TCP/IP connections on localhost

5. **If `port` is different:**
   - Note the port number
   - Update your `.env` file: `DB_PORT=<the_port_number>`

6. **Restart MariaDB service:**
   - XAMPP: Stop and start MySQL in XAMPP Control Panel
   - WAMP: Restart MySQL service
   - Windows Services: Restart "MariaDB" or "MySQL" service

### Step 3: Test the Connection

After making changes, test:
```bash
node scripts/simple-connection-test.js
```

### Step 4: Alternative - Use Socket Connection

If TCP/IP still doesn't work, we can modify the script to use socket connections. But TCP/IP is preferred for Node.js applications.

## Quick Check Commands

Check if MariaDB is listening on a port:
```powershell
netstat -an | findstr "330"
```

Check MariaDB service status:
```powershell
Get-Service | Where-Object {$_.Name -like "*mysql*" -or $_.Name -like "*mariadb*"}
```

## Common Ports
- Default MariaDB: 3306
- XAMPP sometimes uses: 3306 or 3307
- Your .env shows: 3307

Try changing `.env` to use port 3306 if 3307 doesn't work.

