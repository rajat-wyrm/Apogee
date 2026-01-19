module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/teardown.js'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  maxWorkers: 1,
};

