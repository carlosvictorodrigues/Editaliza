module.exports = {
  apps: [{
    name: 'editaliza-app',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    env: { NODE_ENV: 'production', PORT: 3000 },
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 5000,
    max_memory_restart: '300M',
    error_file: '~/.pm2/logs/editaliza-error.log',
    out_file: '~/.pm2/logs/editaliza-out.log',
    merge_logs: true,
    time: true
  }]
};