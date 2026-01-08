/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    roots: ['<rootDir>/tests'],
    testMatch: [
        '**/regression/**/*.test.ts',
        '**/e2e/**/*.test.ts'
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    collectCoverageFrom: [
        'backend/src/**/*.ts',
        'frontend/src/**/*.ts',
        'frontend/src/**/*.tsx',
        '!**/*.d.ts',
        '!**/node_modules/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    testTimeout: 30000,
    verbose: true,
    // Configuración para tests E2E
    globalSetup: '<rootDir>/tests/e2e/setup.ts',
    globalTeardown: '<rootDir>/tests/e2e/teardown.ts',
};
