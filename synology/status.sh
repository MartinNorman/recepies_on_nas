#!/bin/bash
# Recipe App Status Script for Synology NAS

APP_DIR="/volume1/homes/Martin/recept"
PID_FILE="$APP_DIR/app.pid"
LOG_FILE="$APP_DIR/logs/app.log"

echo "=== Recipe App Status ==="
echo ""

# Check PID file
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  echo "PID File: $PID_FILE"
  echo "Stored PID: $PID"

  if ps -p "$PID" > /dev/null 2>&1; then
    echo "Status: RUNNING"
    echo ""
    echo "Process Info:"
    ps -p "$PID" -o pid,ppid,user,%cpu,%mem,start,time,command
  else
    echo "Status: NOT RUNNING (stale PID file)"
  fi
else
  echo "PID File: Not found"
  echo "Status: NOT RUNNING"
fi

echo ""
echo "=== Recent Logs ==="
if [ -f "$LOG_FILE" ]; then
  tail -20 "$LOG_FILE"
else
  echo "No log file found at $LOG_FILE"
fi

echo ""
echo "=== System Resources ==="
echo "Memory Usage:"
free -m | head -2

echo ""
echo "Disk Usage:"
df -h /volume1 | tail -1

echo ""
echo "=== Network ==="
echo "Listening on port:"
netstat -tlnp 2>/dev/null | grep ":3000" || echo "Port 3000 not in use"
