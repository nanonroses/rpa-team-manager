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
    testTimeout: 30000,
    verbose: true,
    // ts-jest transformation
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: './backend/tsconfig.json'
        }]
    },
    // Ignorar node_modules
    testPathIgnorePatterns: ['/node_modules/'],
};
