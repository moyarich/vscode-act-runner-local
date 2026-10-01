import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    vscode: '<rootDir>/src/__mocks__/vscode.ts',
  },
  collectCoverageFrom: [
    'src/core/**/*.ts',
    'src/providers/**/*.ts',
    '!src/**/*.test.ts',
    '!src/__mocks__/**',
  ],
  coverageThreshold: {
    global: { lines: 80, functions: 80 },
  },
};

export default config;
