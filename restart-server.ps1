# Restart Server on NAS
# Usage: .\restart-server.ps1

$nasIP = "192.168.50.60"
$username = "admin"
$password = 'MNOmno001!"#'
$appDir = "/volume1/homes/Martin/recept"

Write-Host "Connecting to NAS at $nasIP..." -ForegroundColor Cyan

# Use plink to SSH and restart the server
& "C:\Program Files\PuTTY\plink.exe" -ssh -batch -pw $password "$username@$nasIP" "cd $appDir && bash synology/stop.sh && sleep 2 && bash synology/start.sh && echo 'Server restarted successfully'"

Write-Host "`nRestart command sent. Check the server status on your NAS." -ForegroundColor Green

