#!/bin/bash
# Recipe App Startup Script for Synology NAS

APP_DIR="/volume1/homes/Martin/recept"
LOG_DIR="$APP_DIR/logs"
PID_FILE="$APP_DIR/app.pid"
# Try to find Node.js automatically, fallback to common paths
if [ -d "/var/packages/Node.js_v18/target/bin" ]; then
  NODE_PATH="/var/packages/Node.js_v18/target/bin"
elif [ -d "/var/packages/Node.js_v16/target/bin" ]; then
  NODE_PATH="/var/packages/Node.js_v16/target/bin"
elif [ -d "/var/packages/Node.js_v12/target/usr/local/bin" ]; then
  NODE_PATH="/var/packages/Node.js_v12/target/usr/local/bin"
else
  # Try to find node in common locations
  NODE_PATH=$(find /var/packages -name "node" -type f 2>/dev/null | head -1 | xargs dirname)
  if [ -z "$NODE_PATH" ]; then
    echo "$(date): ERROR - Cannot find Node.js installation"
    exit 1
  fi
fi

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Add Node.js to PATH
export PATH="$NODE_PATH:$PATH"

# Change to app directory
cd "$APP_DIR"

# Load environment variables from .env file
if [ -f "$APP_DIR/.env" ]; then
  export $(cat "$APP_DIR/.env" | grep -v '^#' | xargs)
  echo "$(date): Loaded environment variables from .env"
fi

# Check if already running
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if ps -p "$OLD_PID" > /dev/null 2>&1; then
    echo "$(date): Recipe App is already running with PID $OLD_PID"
    exit 1
  else
    echo "$(date): Removing stale PID file"
    rm "$PID_FILE"
  fi
fi

# Verify Node.js exists
if [ ! -f "$NODE_PATH/node" ]; then
  echo "$(date): ERROR - Node.js not found at $NODE_PATH/node"
  echo "$(date): Please check your Node.js installation"
  exit 1
fi

echo "$(date): Using Node.js at $NODE_PATH/node"
echo "$(date): Node.js version: $($NODE_PATH/node --version)"

# Check if port 3000 is free
if netstat -tlnp 2>/dev/null | grep -q :3000; then
  echo "$(date): WARNING - Port 3000 is already in use"
  echo "$(date): Attempting to free port 3000..."
  ps aux | grep "[n]ode.*server.js" | awk '{print $2}' | xargs kill -9 2>/dev/null
  sleep 2
fi

# Start the application
echo "$(date): Starting Recipe App..."
cd "$APP_DIR"
"$NODE_PATH/node" server.js >> "$LOG_DIR/app.log" 2>&1 &
NEW_PID=$!

# Save PID
echo "$NEW_PID" > "$PID_FILE"

# Wait a moment and check if it started successfully
sleep 3
if ps -p "$NEW_PID" > /dev/null 2>&1; then
  echo "$(date): Recipe App started successfully with PID $NEW_PID"
  echo "$(date): Logs available at $LOG_DIR/app.log"
  echo "$(date): Check logs with: tail -f $LOG_DIR/app.log"
else
  echo "$(date): ERROR - Recipe App failed to start"
  echo "$(date): Check the logs for details:"
  echo "$(date): tail -20 $LOG_DIR/app.log"
  tail -20 "$LOG_DIR/app.log" 2>/dev/null || echo "$(date): Could not read log file"
  rm -f "$PID_FILE"
  exit 1
fi
