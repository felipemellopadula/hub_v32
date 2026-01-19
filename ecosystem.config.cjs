module.exports = {
  apps: [
    {
      name: "frontend-v31",
      cwd: "/var/www/31/v31", // caminho do projeto
      script: "npm",
      args: "run preview -- --host 0.0.0.0 --port 4183",

      // REMOVI o "interpreter"

      env: {
        NODE_ENV: "production",
      },
      env_production: {
        NODE_ENV: "production",
      },

      instances: 2,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
    },
  ],
};
