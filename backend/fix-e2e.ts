import * as fs from 'fs';
import * as path from 'path';

const testDir = path.join(__dirname, 'test');
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.e2e-spec.ts'));

for (const file of files) {
  const filePath = path.join(testDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  if (!content.includes('configureApp')) {
    content = content.replace(
      "import { AppModule } from '../src/app.module';",
      "import { AppModule } from '../src/app.module';\nimport { configureApp } from '../src/app.setup';\nimport { ConfigService } from '@nestjs/config';"
    );
    content = content.replace(
      "await app.init();",
      "configureApp(app, app.get(ConfigService));\n    await app.init();"
    );
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
}
