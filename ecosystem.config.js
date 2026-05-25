module.exports = {
  apps: [{
    name: 'menu-app',
    script: 'server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'postgresql://db_user:db_password@localhost:5432/menu_db' // Change to match your actual server credentials
    }
  }]
};