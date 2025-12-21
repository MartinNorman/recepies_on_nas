// PM2 Ecosystem Configuration for Synology NAS
module.exports = {
  apps: [{
    name: 'recept-app',
    script: 'server.js',
    cwd: '/volume1/homes/Martin/recept',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Logging
    error_file: '/volume1/homes/Martin/recept/logs/err.log',
    out_file: '/volume1/homes/Martin/recept/logs/out.log',
    log_file: '/volume1/homes/Martin/recept/logs/combined.log',
    time: true,
    // Restart policy
    exp_backoff_restart_delay: 100,
    restart_delay: 4000,
    // Resource limits for DS218
    node_args: '--max-old-space-size=256'
  }]
};
