module.exports = {
  apps: [
    {
      name: 'auth',
      cwd: '/app/auth',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'backend1',
      cwd: '/app/backend',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        INSTANCE_NAME: 'backend1'
      }
    },
    {
      name: 'backend2',
      cwd: '/app/backend',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4001,
        INSTANCE_NAME: 'backend2'
      }
    },
    {
      name: 'frontend1',
      cwd: '/app/frontend',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'frontend2',
      cwd: '/app/frontend',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
}
