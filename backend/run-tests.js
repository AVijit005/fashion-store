const { execSync } = require('child_process');
try {
  console.log(execSync('npm run test:e2e', { cwd: 'd:\\aura-streetwear-main\\backend', stdio: 'pipe' }).toString());
} catch (e) {
  console.log(e.stdout.toString());
  console.log(e.stderr.toString());
}
