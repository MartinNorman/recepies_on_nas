@echo off
REM Restart Server on NAS using plink

"C:\Program Files\PuTTY\plink.exe" -ssh -batch -pw "MNOmno001!`"#`"" admin@192.168.50.60 "cd /volume1/homes/Martin/recept && bash synology/stop.sh && sleep 2 && bash synology/start.sh && echo 'Server restarted successfully'"

pause

