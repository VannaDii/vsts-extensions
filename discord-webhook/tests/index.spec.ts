import path from 'path';
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

describe('Discord Webhook Tests', () => {
  it('Invoke Discord Webhook From Defaults As Expected', () => {
    const tp = path.join(__dirname, 'success.ts');
    const tr = new MockTestRunner(tp);

    expect(() => tr.run()).not.toThrow();
    expect(tr.succeeded).toBe(true);
    expect(tr.errorIssues).toHaveLength(0);
    expect(tr.warningIssues).toHaveLength(0);
    expect(tr.stdOutContained('##vso[task.complete result=Succeeded;]Posted to Discord channel #test_channel_id'));
  });

  it('Fails When Discord Response Is Not Positive', () => {
    let tp = path.join(__dirname, 'failure.ts');
    let tr = new MockTestRunner(tp);

    expect(() => tr.run()).not.toThrow();
    expect(tr.succeeded).toBe(false);
    expect(tr.errorIssues).toHaveLength(1);
    expect(tr.warningIssues).toHaveLength(0);
    expect(tr.stdOutContained('##vso[task.issue type=error;]400: Bad request')).toBe(true);
  });
})