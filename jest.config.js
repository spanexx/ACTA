// Root Jest config for ACTA monorepo (Phase-1 baseline)
// Configures Jest for TypeScript with coverage and workspace-aware test discovery.
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages/', '<rootDir>/apps/'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'packages/**/src/**/*.ts',
    'apps/**/src/**/*.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
