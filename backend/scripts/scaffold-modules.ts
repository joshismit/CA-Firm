/**
 * Module Scaffold Script
 * Creates all module directories with DDD structure.
 * Run: ts-node scripts/scaffold-modules.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const modules = [
  'auth', 'tenant', 'users', 'roles', 'permissions',
  'clients', 'business', 'contacts', 'documents', 'crm',
  'tasks', 'notifications', 'payments', 'audit', 'reports',
  'dashboard', 'settings', 'subscriptions', 'master-admin',
];

const subDirs = [
  'controller',
  'service',
  'repository',
  'domain/entities',
  'domain/value-objects',
  'domain/events',
  'domain/interfaces',
  'dto',
  'schemas',
  'mapper',
];

const modulesBase = path.resolve(__dirname, '../src/modules');

for (const mod of modules) {
  for (const sub of subDirs) {
    const dirPath = path.join(modulesBase, mod, sub);
    fs.mkdirSync(dirPath, { recursive: true });
    const keepFile = path.join(dirPath, '.gitkeep');
    if (!fs.existsSync(keepFile)) {
      fs.writeFileSync(keepFile, '');
    }
  }

  const indexPath = path.join(modulesBase, mod, 'index.ts');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, `// ${mod} module — public exports\n`);
  }

  console.log(`✅ ${mod} scaffolded`);
}

console.log(`\n🎉 All ${modules.length} modules scaffolded with DDD structure.`);
