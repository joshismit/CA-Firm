const { execSync } = require('child_process');

try {
  console.log("Running tsc --noEmit...");
  const output = execSync('npx tsc --noEmit', { cwd: __dirname, encoding: 'utf-8' });
  console.log("Success!");
  console.log(output);
} catch (error) {
  console.error("TypeScript Error:");
  console.error(error.stdout);
}
