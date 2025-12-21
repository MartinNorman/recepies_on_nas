#!/bin/bash
# Recipe App Stop Script for Synology NAS

APP_DIR="/volume1/homes/Martin/recept"
PID_FILE="$APP_DIR/app.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")

  if ps -p "$PID" > /dev/null 2>&1; then
    echo "$(date): Stopping Recipe App (PID: $PID)..."
    kill "$PID" 2>/dev/null || sudo kill "$PID" 2>/dev/null

    # Wait for graceful shutdown
    sleep 2

    # Force kill if still running
    if ps -p "$PID" > /dev/null 2>&1; then
      echo "$(date): Force killing Recipe App..."
      kill -9 "$PID" 2>/dev/null || sudo kill -9 "$PID" 2>/dev/null
    fi

    rm "$PID_FILE"
    echo "$(date): Recipe App stopped"
  else
    echo "$(date): Process $PID is not running"
    rm "$PID_FILE"
  fi
else
  echo "$(date): PID file not found at $PID_FILE"
  echo "$(date): Attempting to find and kill node process..."

  # Try to find the process using ps (works on Synology)
  PIDS=$(ps aux | grep "[n]ode.*server.js" | awk '{print $2}')
  if [ -n "$PIDS" ]; then
    echo "$(date): Found Node.js processes: $PIDS"
    for PID in $PIDS; do
      echo "$(date): Killing process $PID..."
      # Try without sudo first, then with sudo if needed
      kill "$PID" 2>/dev/null || sudo kill "$PID" 2>/dev/null || \
      kill -9 "$PID" 2>/dev/null || sudo kill -9 "$PID" 2>/dev/null
    done
    echo "$(date): Killed processes"
  else
    echo "$(date): No Recipe App process found"
  fi
  
  # Also check for processes using port 3000
  PORT_PIDS=$(lsof -ti:3000 2>/dev/null || netstat -tlnp 2>/dev/null | grep :3000 | awk '{print $7}' | cut -d'/' -f1 | sort -u)
  if [ -n "$PORT_PIDS" ]; then
    echo "$(date): Found processes using port 3000: $PORT_PIDS"
    for PID in $PORT_PIDS; do
      echo "$(date): Killing process $PID using port 3000..."
      kill "$PID" 2>/dev/null || sudo kill "$PID" 2>/dev/null || \
      kill -9 "$PID" 2>/dev/null || sudo kill -9 "$PID" 2>/dev/null
    done
    echo "$(date): Killed processes using port 3000"
  fi
fi
