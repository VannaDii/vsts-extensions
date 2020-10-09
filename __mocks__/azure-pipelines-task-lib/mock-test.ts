import path from 'path';
const { MockTestRunner } = jest.requireActual('azure-pipelines-task-lib/mock-test');

MockTestRunner.prototype.getPathToNodeExe = function (nodeVersion: string, downloadDestination: string) {
  const tsNodePath = path.resolve(__dirname, '../../', 'node_modules/.bin/ts-node');
  return tsNodePath;
};

exports.MockTestRunner = MockTestRunner;
