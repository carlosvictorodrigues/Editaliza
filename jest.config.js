module.exports = {
    testEnvironment: "node",
    setupFilesAfterEnv: [
      "<rootDir>/tests/setup-simple.js"
    ],
    testMatch: [
      "<rootDir>/tests/**/*.test.js"
    ],
    testPathIgnorePatterns: [
      "<rootDir>/node_modules/",
      "<rootDir>/tests/legacy/",
      "<rootDir>/tests/manual/"
    ],
    collectCoverageFrom: [
      "server.js",
      "middleware.js",
      "database*.js",
      "src/**/*.js",
      "!src/**/*.test.js",
      "!src/config/test-*.js"
    ],
    coverageDirectory: "coverage",
    coverageReporters: [
      "text",
      "lcov",
      "html"
    ],
    testTimeout: 30000,
    verbose: true,
    detectOpenHandles: true,
    forceExit: true,
    maxWorkers: 1
  };