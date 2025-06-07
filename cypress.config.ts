import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
    supportFile: false,
    video: false,
    screenshotOnRunFailure: false,
    fileServerFolder: '.',
  },
});
