import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/integration/**/*.test.ts'],
  globalSetup: './integration/setup.ts',
};

export default config;
