const { execSync } = require('child_process');

console.log('Starting DB Deployment Script...');

try {
  console.log('Resolving seed_admin...');
  execSync('npx prisma migrate resolve --rolled-back 20260530000000_seed_admin', { stdio: 'inherit' });
} catch (e) {
  console.log('seed_admin resolve failed or already resolved.');
}

try {
  console.log('Resolving add_soft_deletes...');
  execSync('npx prisma migrate resolve --rolled-back 20260609000000_add_soft_deletes', { stdio: 'inherit' });
} catch (e) {
  console.log('add_soft_deletes resolve failed or already resolved.');
}

try {
  console.log('Deploying migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
} catch (e) {
  console.log('Deploy failed.');
  process.exit(1);
}

console.log('DB Deployment Script Finished.');
