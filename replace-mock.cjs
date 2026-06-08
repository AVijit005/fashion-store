const fs = require('fs');
const path = require('path');

function replaceInFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInFiles(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      if (content.includes('@/lib/data/products')) {
        content = content.replace(/@\/lib\/data\/products/g, '@/lib/api/catalog');
        changed = true;
      }
      if (content.includes('@/lib/data/categories')) {
        content = content.replace(/@\/lib\/data\/categories/g, '@/lib/api/catalog');
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log('Updated', fullPath);
      }
    }
  }
}

replaceInFiles(path.join(__dirname, 'src'));
console.log('Done');
