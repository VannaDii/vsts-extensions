import path from 'path';
import { S3 } from 'aws-sdk';
import * as tl from 'azure-pipelines-task-lib/task';

tl.setResourcePath(path.join(__dirname, 'task.json'));

async function doesBucketExist(client: S3, bucketName: string) {
  try {
    const result = await client.headBucket({ Bucket: bucketName }).promise();
    return result?.$response?.httpResponse?.statusCode === 200;
  } catch (error: any) {
    tl.error(error);
  }
  return false;
}

(async () => {
  try {
    const ifNotExists = tl.getBoolInput('IfNotExists', false) || false;
    const bucketName = tl.getInput('BucketName', true);
    const actionType = tl.getInput('ActionType', true);

    if (!bucketName || bucketName.length === 0) {
      tl.setResult(tl.TaskResult.Failed, tl.loc('NoBucketName'));
      return;
    } else {
      tl.debug(`Using provided bucket name: '${bucketName}'`);
    }
    if (!actionType || actionType.length === 0) {
      tl.setResult(tl.TaskResult.Failed, tl.loc('NoActionType'));
      return;
    } else {
      tl.debug(`Using provided action type: '${actionType}'`);
    }

    const s3Client = new S3();
    const bucketExists = await doesBucketExist(s3Client, bucketName);
    switch (actionType) {
      case 'Create':
        {
          if (bucketExists === false) {
            tl.debug(`Creating '${bucketName}'`);
            const result = await s3Client.createBucket({ Bucket: bucketName }).promise();
            await s3Client.waitFor('bucketExists', { Bucket: bucketName }).promise();
            tl.debug(`Bucket '${bucketName}' created in ${result.Location}`);
          }
        }
        break;
      case 'Destroy':
        {
          if (bucketExists === true) {
            tl.debug(`Destroying '${bucketName}'`);
            await s3Client.deleteBucket({ Bucket: bucketName }).promise();
            await s3Client.waitFor('bucketNotExists', { Bucket: bucketName }).promise();
            tl.debug(`Bucket '${bucketName}' is destroyed`);
          }
        }
        break;
      default:
        tl.setResult(tl.TaskResult.Failed, tl.loc('InvalidActionType'));
    }

    tl.setResult(tl.TaskResult.Succeeded, `${actionType} bucket succeeded!`);
  } catch (error: any) {
    tl.error(error);
    tl.setResult(
      tl.TaskResult.Failed,
      `Bucket management failed! ${error.name || 'Error'}: ${error.message || 'No message available'}\n${error.stack}`
    );
  }
})();
