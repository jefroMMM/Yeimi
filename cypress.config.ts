import { defineConfig } from 'cypress';
export default defineConfig({
  video: true,
  viewportWidth: 1200, viewportHeight: 900,
  screenshotsFolder: 'cypress/screenshots',
  e2e: {
    baseUrl: 'http://127.0.0.1:4311',
    supportFile: false,
    testIsolation: true,
    setupNodeEvents(on) {
      on('task', {
        evidence({ name, contents }: { name: string; contents: unknown }) {
          const fs = require('node:fs');
          fs.mkdirSync('entrega/evidencias', { recursive: true });
          fs.writeFileSync(`entrega/evidencias/${name}.json`, JSON.stringify(contents, null, 2));
          return null;
        },
      });
    },
  },
});
