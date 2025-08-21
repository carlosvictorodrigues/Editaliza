module.exports = {
  apps: [{
    name: 'editaliza-app',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    
    // Ambiente
    env: { 
      NODE_ENV: 'production', 
      PORT: 3000,
      NODE_OPTIONS: '--max-old-space-size=384' // Limitar heap size
    },
    
    // Configurações de restart mais conservadoras
    min_uptime: '30s',           // Aumentado para 30s
    max_restarts: 5,             // Reduzido para 5 restarts
    restart_delay: 10000,        // Aumentado para 10 segundos
    max_memory_restart: '400M',  // Aumentado para 400MB
    
    // Exponential backoff para evitar restart loops
    exp_backoff_restart_delay: 100,
    
    // Logs
    error_file: '~/.pm2/logs/editaliza-error.log',
    out_file: '~/.pm2/logs/editaliza-out.log',
    merge_logs: true,
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    
    // Kill timeout
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Autorestart
    autorestart: true,
    
    // Cron restart (opcional - descomente se quiser restart diário)
    // cron_restart: '0 3 * * *',
  }]
};