import path from 'path';
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

describe('Git Hash Tests', () => {
  it('Obtains A Git Hash From Defaults As Expected', () => {
    let tp = path.join(__dirname, 'success.ts');
    let tr = new MockTestRunner(tp);

    expect(() => tr.run()).not.toThrow();
    expect(tr.succeeded).toBe(true);
    expect(tr.errorIssues).toHaveLength(0);
    expect(tr.warningIssues).toHaveLength(0);
    expect(tr.invokedToolCount).toEqual(1);
    expect(tr.stdOutContained('[command]/usr/local/bin/git rev-parse HEAD')).toBe(true);
    expect(tr.stdOutContained('3e607e73b918617896ac4adccf1ef2c298fa5f69')).toBe(true);
  });

  it('Fails When Git Is Not Available', () => {
    let tp = path.join(__dirname, 'failure.ts');
    let tr = new MockTestRunner(tp);

    expect(() => tr.run()).not.toThrow();
    expect(tr.succeeded).toBe(false);
    expect(tr.errorIssues).toHaveLength(1);
    expect(tr.warningIssues).toHaveLength(0);
    expect(tr.stdOutContained('##vso[task.issue type=error;]Unhandled: Not found null')).toBe(true);
  });
})