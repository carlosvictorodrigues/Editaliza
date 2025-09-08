const { defineConfig } = require("cypress");

module.exports = defineConfig({
  projectId: 'vtnytu',
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
