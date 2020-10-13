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
