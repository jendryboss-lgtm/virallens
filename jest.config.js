/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          jsx: 'react',
          esModuleInterop: true,
          strict: true,
          baseUrl: '.',
          paths: { '@/*': ['src/*'] },
        },
        babelConfig: false,
      },
    ],
  },
};
