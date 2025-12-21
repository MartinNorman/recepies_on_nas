# Finding Database Connection from phpMyAdmin

Since you can connect via phpMyAdmin, we need to find the connection details from phpMyAdmin's configuration.

## Method 1: Check phpMyAdmin Config File

1. Find your phpMyAdmin installation directory (usually in XAMPP, WAMP, or similar)
2. Look for `config.inc.php` file
3. Open it and look for these lines:
   ```php
   $cfg['Servers'][$i]['host'] = '...';  // This is the host
   $cfg['Servers'][$i]['port'] = '...';  // This is the port
   ```
4. Note down the host and port values

## Method 2: Check from phpMyAdmin Interface

1. Open phpMyAdmin in your browser
2. Look at the URL - it might show the port
3. Or check the server information in phpMyAdmin (usually in the bottom or in a "Server" tab)

## Method 3: Check MariaDB Configuration

The database might be configured to only accept socket connections. To enable TCP/IP:

1. Find MariaDB configuration file:
   - XAMPP: `C:\xampp\mysql\bin\my.ini`
   - WAMP: `C:\wamp\bin\mysql\mysql[version]\my.ini`
   - Standalone: Usually in MariaDB installation directory

2. Open `my.ini` and look for `[mysqld]` section

3. Ensure these settings exist:
   ```ini
   [mysqld]
   port = 3306
   bind-address = 127.0.0.1
   ```

4. If `bind-address` is set to `127.0.0.1` or commented out, TCP/IP should work
   If it's set to something else or socket-only, that's the issue

5. After changing, restart MariaDB service

## Common Issues

- **Socket-only connection**: MariaDB might be configured to only accept socket connections (common in XAMPP/WAMP)
- **Wrong port**: The port in .env might not match what phpMyAdmin uses
- **bind-address**: MariaDB might only be listening on a specific interface

## Quick Test

Once you find the correct port from phpMyAdmin config, update your `.env` file and test:
```bash
node scripts/simple-connection-test.js
```

