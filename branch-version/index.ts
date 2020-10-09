import path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

tl.setResourcePath(path.join(__dirname, 'task.json'));
(async () => {
    // Get and check for Branch Name
    let branchName: string = tl.getInput('BranchName', true) as string;
    let hasBranchName: boolean = branchName !== null && branchName !== undefined && branchName !== '';
    if (hasBranchName === false) {
        // Try to get SourceBranch from the build
        branchName = tl.getVariable('Build.SourceBranchName') as string;
        hasBranchName = branchName !== null && branchName !== undefined && branchName !== '';
        if (hasBranchName === false) {
            // That didn't work, so log an issue and bail out
            tl.setResult(tl.TaskResult.Failed, tl.loc('NoBranchName'));
            return;
        } else { tl.debug(`Using discovered branch name: '${branchName}'`); }
    } else { tl.debug(`Using provided branch name: '${branchName}'`); }

    // Get and check for Version Pattern
    const versionPattern: RegExp = RegExp(tl.getInput('VersionPattern', true) as string);
    const hasVersionPattern: boolean = versionPattern !== null && versionPattern !== undefined;
    if (hasVersionPattern === false) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoPattern'));
        return;
    } else { tl.debug(`Using provided version pattern: '${versionPattern}'`); }

    // Get is Build Name should be updated
    const isRenameBuild: boolean = tl.getBoolInput('IsBuildRenameEnabled');
    tl.debug(`Will${(isRenameBuild ? '' : ' not')} rename the build with an extracted version number.`);

    // Try to capture the version number from the branch name
    const reResults = versionPattern.exec(branchName);
    let branchVersion = (!!reResults && reResults.length >= 2 ? reResults[1] : null);
    if (branchVersion === null) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoCapture'));
        return;
    } else { tl.debug(`Extracted ${branchVersion} from '${branchName}' using '${versionPattern}'`); }

    // Maybe fix up version number to be 3 components
    const versionParts: string[] = branchVersion.split('.', 3);
    while (versionParts.length < 3) { versionParts.push('0'); }

    // Parse revision from build name
    const buildName: string = tl.getVariable('Build.BuildNumber') as string;
    const revResults = RegExp('[\\d+\\.]+\\.(\\d+).*').exec(buildName);
    const revisionNumber = (revResults != null && revResults.length >= 2 ? revResults[1] : null);
    if (!revisionNumber) {
        tl.debug(`Revision extraction from '${buildName}' yielded '${JSON.stringify(revResults)}'.`);
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoRevision'));
        return;
    } else {
        tl.debug(`Extracted a revision number '${revisionNumber}' from '${buildName}'.`);
        versionParts.push(revisionNumber);
    }

    // Format standard version number for variables
    branchVersion = versionParts.join('.');

    // A version number was extracted
    tl.setVariable('Build.BranchVersionNumber', branchVersion, false);
    console.log(`Set $(Build.BranchVersionNumber) to '${branchVersion}'`);
    if (isRenameBuild === true) {
        // Maybe push 'DRAFT' and reformat branchVersion
        if (buildName.toUpperCase().indexOf('DRAFT') >= 0) {
            tl.debug(`Detected DRAFT status for '${buildName}'.`);
            versionParts.push('DRAFT');
            branchVersion = versionParts.join('.');
        }
        tl.updateBuildNumber(branchVersion);
    }
})();
