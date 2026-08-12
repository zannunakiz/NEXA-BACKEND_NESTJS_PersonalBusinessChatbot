module.exports = {
  apps: [
    {
      name: 'nexa-api',
      script: './dist/main.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
      kill_timeout: 12000,
      listen_timeout: 30000,
      time: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
