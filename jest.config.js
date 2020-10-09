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
  reporters,
  transformIgnorePatterns: ['.*node_modules.*'],
  testPathIgnorePatterns: ['/node_modules/', '/.built/', '/.bundle/', '/.jest/'],
  setupFiles: [],
  setupFilesAfterEnv: [],
  testEnvironment: 'node',
};
