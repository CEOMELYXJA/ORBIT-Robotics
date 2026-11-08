const fs = require('node:fs');
const assert = require('node:assert/strict');

const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
assert.match(workflow, /push:\s*\n\s+branches:\s*\[main\]/, 'the default branch should trigger verification and deployment');
assert.match(workflow, /pull_request:/, 'pull requests should run the verification job');
assert.match(workflow, /workflow_dispatch:/, 'the workflow should be runnable manually');
assert.match(workflow, /uses: actions\/checkout@v7/, 'jobs should use the current checkout action major');
assert.match(workflow, /uses: actions\/setup-node@v7[\s\S]*?node-version: 22/, 'the test runner should use a defined Node.js version');
assert.match(workflow, /for test in verify-\*\.cjs; do[\s\S]*?node "\$test"/, 'the workflow should run every local interaction check');
assert.match(workflow, /deploy:[\s\S]*?needs: verify/, 'deployment must wait for successful verification');
assert.match(workflow, /if: github\.event_name != 'pull_request' && github\.ref == 'refs\/heads\/main'/, 'only the main branch should deploy');
assert.match(workflow, /pages: write[\s\S]*?id-token: write/, 'the deployment job should have only the Pages and OIDC permissions it needs');
assert.match(workflow, /cp index\.html styles\.css space-engine\.js app\.js sw\.js manifest\.webmanifest icon\.svg _site\//, 'the Pages artifact should contain only the seven public web assets');
assert.match(workflow, /uses: actions\/upload-pages-artifact@v4[\s\S]*?path: _site/, 'the workflow should upload the isolated static artifact');
assert.match(workflow, /uses: actions\/deploy-pages@v4/, 'the workflow should publish through the official Pages deployment action');
console.log('GitHub Pages workflow checks passed: verification gate, pull-request checks, main-only deployment, limited permissions, and isolated web artifact.');

