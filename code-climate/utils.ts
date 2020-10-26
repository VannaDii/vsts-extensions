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
  const target = factor * Math.ceil(value.length / factor);
  const padSize = target - value.length;
  const pathPadding = value.length + padSize;
  return Buffer.from(value.padEnd(pathPadding)).toString('base64');
}
