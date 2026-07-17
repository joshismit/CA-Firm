/**
 * Backend Module Scaffold Script
 * ================================
 * Creates all module directories with the DDD-influenced structure:
 *
 *   module/
 *   ├── controller/
 *   ├── service/
 *   ├── repository/
 *   ├── domain/
 *   │   ├── entities/
 *   │   ├── value-objects/
 *   │   ├── events/
 *   │   └── interfaces/
 *   ├── dto/
 *   ├── schemas/
 *   └── mapper/
 *
 * Run from the backend/ directory:
 *   node scripts/scaffold-modules.js
 */

const fs = require('fs');
const path = require('path');

const MODULES = [
  'auth', 'tenant', 'users', 'roles', 'permissions',
  'clients', 'business', 'contacts', 'documents', 'crm',
  'tasks', 'notifications', 'payments', 'audit', 'reports',
  'dashboard', 'settings', 'subscriptions', 'master-admin',
];

const SUB_DIRS = [
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

const MODULES_BASE = path.join(__dirname, '..', 'src', 'modules');

let created = 0;

for (const mod of MODULES) {
  for (const sub of SUB_DIRS) {
    const dirPath = path.join(MODULES_BASE, mod, sub);
    fs.mkdirSync(dirPath, { recursive: true });

    const keepFile = path.join(dirPath, '.gitkeep');
    if (!fs.existsSync(keepFile)) {
      fs.writeFileSync(keepFile, '');
      created++;
    }
  }

  // Create barrel index if missing
  const indexPath = path.join(MODULES_BASE, mod, 'index.ts');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, `// ${mod} module — public exports\n`);
    created++;
  }

  console.log(`  ✅  ${mod}`);
}

console.log(`\n🎉 Done! ${MODULES.length} modules scaffolded. ${created} new files created.`);
