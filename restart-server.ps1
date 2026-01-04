# Restart Server on NAS
# Usage: .\restart-server.ps1
#
# REQUIRED Environment Variables:
#   NAS_IP - IP address of your NAS
#   NAS_USERNAME - SSH username
#   NAS_PASSWORD - SSH password
#   NAS_APP_DIR - Application directory on NAS

# Load environment variables from .env file if it exists
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

$nasIP = $env:NAS_IP
$username = $env:NAS_USERNAME
$password = $env:NAS_PASSWORD
$appDir = $env:NAS_APP_DIR

# Validate required environment variables
if (-not $nasIP) {
    Write-Host "ERROR: NAS_IP environment variable is required" -ForegroundColor Red
    Write-Host "Set it in .env file or as an environment variable" -ForegroundColor Yellow
    exit 1
}

if (-not $username) {
    Write-Host "ERROR: NAS_USERNAME environment variable is required" -ForegroundColor Red
    Write-Host "Set it in .env file or as an environment variable" -ForegroundColor Yellow
    exit 1
}

if (-not $password) {
    Write-Host "ERROR: NAS_PASSWORD environment variable is required" -ForegroundColor Red
    Write-Host "Set it in .env file or as an environment variable" -ForegroundColor Yellow
    exit 1
}

if (-not $appDir) {
    Write-Host "ERROR: NAS_APP_DIR environment variable is required" -ForegroundColor Red
    Write-Host "Set it in .env file or as an environment variable" -ForegroundColor Yellow
    exit 1
}

Write-Host "Connecting to NAS at $nasIP..." -ForegroundColor Cyan

# Use plink to SSH and restart the server
& "C:\Program Files\PuTTY\plink.exe" -ssh -batch -pw $password "$username@$nasIP" "cd $appDir && bash synology/stop.sh && sleep 2 && bash synology/start.sh && echo 'Server restarted successfully'"

Write-Host "`nRestart command sent. Check the server status on your NAS." -ForegroundColor Green

