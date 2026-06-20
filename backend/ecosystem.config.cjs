module.exports = {
  apps: [
    {
      name: 'bizchat-api',
      cwd: __dirname,
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
