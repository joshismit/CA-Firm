const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

exec('npx tsc --noEmit', { cwd: __dirname }, (error, stdout, stderr) => {
  const result = `Error: ${error ? error.message : 'null'}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;
  fs.writeFileSync(path.join(__dirname, 'tsc-output.txt'), result);
});
