module.exports = {
  apps: [{
    name: 'menu-app',
    script: 'server.js',
    // Default environment variables
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    // Production environment variables (Triggers with --env production)
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'postgresql://db_user:db_password@localhost:5432/menu_db'
    }
  }]
};