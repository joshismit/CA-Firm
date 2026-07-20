const { execSync } = require('child_process');
console.log('Generating Prisma Client...');
const output = execSync('npx prisma generate', { cwd: __dirname, encoding: 'utf-8' });
console.log(output);
