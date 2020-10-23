import * as tl from 'azure-pipelines-task-lib/task';

export function findCodeClimate() {
  let path!: string;
  let exists!: boolean;
  try {
    path = tl.which('codeclimate', true);
    exists = !!path;
  } catch (error) {
    path = '';
    exists = false;
  }
  return { path, exists };
}

export function getEvenHash(value: string) {
  const factor = 3; // Base64 operates on 3's
  const pathPadding =
    value.length + (factor - [...value.length.toString()].map((s) => parseInt(s)).reduce((p, c) => p + c, 0));
  const sourceRootHash = Buffer.from(value.padEnd(pathPadding)).toString('base64');
  return sourceRootHash;
}
