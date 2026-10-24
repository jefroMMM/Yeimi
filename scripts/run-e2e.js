const cypress = require('cypress');
const fs = require('node:fs');
const specs = ['01-reserva', '02-validacion', '03-recuperacion'];
const reverse = process.argv.includes('--reverse');
if (reverse) specs.reverse();
(async () => {
  const results = [];
  // Una ejecución por archivo garantiza el orden; cada spec se reinicia por sí mismo.
  for (const spec of specs) {
    const result = await cypress.run({ spec: `cypress/e2e/${spec}.cy.ts`, browser: 'electron', config: { trashAssetsBeforeRuns: false } });
    const success = result.totalTests === 1 && result.totalPassed === 1 && result.totalFailed === 0;
    results.push({ spec, passed: result.totalPassed || 0, failed: result.totalFailed || 0, status: success ? 'passed' : 'failed', started: result.startedTestsAt, ended: result.endedTestsAt });
    if (!success) process.exitCode = 1;
  }
  fs.mkdirSync('entrega/evidencias', { recursive: true });
  fs.writeFileSync(`entrega/evidencias/cypress-${reverse ? 'inverso' : 'normal'}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.table(results);
})().catch(error => { console.error(error); process.exitCode = 1; });
