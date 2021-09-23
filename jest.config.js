const path = require('path');
const jestDir = path.resolve(__dirname, './.jest');
const reporters = [
  'default',
  [
    'jest-junit',
    {
      suiteName: 'Unit Tests',
      outputDirectory: `${jestDir}`,
      outputName: 'junit.xml',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true,
      titleTemplate: '{classname} › {title}',
      classNameTemplate: (vars) => vars.filename.split('.').shift(),
    },
  ],
];

module.exports = {
  preset: 'ts-jest',
  collectCoverage: false,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  modulePathIgnorePatterns: [
    '<rootDir>/.built',
    '<rootDir>/.bundle',
    '<rootDir>/.jest',
    '<rootDir>/.vscode',
    '<rootDir>/.aws-s3',
    '<rootDir>/.code-climate',
    '<rootDir>/.compare-branches',
    '<rootDir>/.discord-webhook',
    '<rootDir>/.git-hash',
    '<rootDir>/.git-pull-request',
    '<rootDir>/.git-push',
  ],
  reporters,
  transformIgnorePatterns: ['.*node_modules.*'],
  testPathIgnorePatterns: ['/node_modules/', '/.built/', '/.bundle/', '/.jest/', '/.vscode/', '/.__mocks__/'],
  setupFiles: [],
  setupFilesAfterEnv: [],
  testEnvironment: 'node',
  timers: 'fake',
};
