module.exports = {
    testEnvironment: "node",
    setupFilesAfterEnv: [
      "<rootDir>/tests/setup-simple.js"
    ],
    testMatch: [
      "<rootDir>/tests/**/*.test.js"
    ],
    collectCoverageFrom: [
      "server.js",
      "middleware.js",
      "database.js",
      "src/**/*.js"
    ],
    coverageDirectory: "coverage",
    coverageReporters: [
      "text",
      "lcov",
      "html"
    ],
    verbose: true
  };