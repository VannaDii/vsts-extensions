import dash = require('TFS/Dashboards/WidgetHelpers');
import build = require('TFS/Build/RestClient');
import test = require('TFS/TestManagement/RestClient');
import BuildContracts = require('TFS/Build/Contracts');
import TestContracts = require('TFS/TestManagement/Contracts');
import WidgetContracts = require('TFS/Dashboards/WidgetContracts');
import $ = require('jquery');

interface IBuildCodeCoverageValues {
    total: number;
    covered: number;
    percent: number;
}
interface IBuildCodeCoverageStats {
    id: number;
    number: string;
    result: BuildContracts.BuildResult;
    url: string;
    branch: string;
    definitionId: number;
    definitionName: string;
    values: IBuildCodeCoverageValues;
}

async function getCodeCoverageSummary(projectId: string, buildId: number, type: string = 'Lines'): Promise<IBuildCodeCoverageValues> {
    const result = await test.getClient().getCodeCoverageSummary(projectId, buildId)
        .then(summary => {
            let coverageData: TestContracts.CodeCoverageData = null;
            if (summary && summary.coverageData) { coverageData = summary.coverageData.shift(); }
            if (!coverageData || !coverageData.coverageStats) {
                return { total: 1, covered: 0, percent: 0 } as IBuildCodeCoverageValues;
            }

            return coverageData.coverageStats.filter(stats => {
                return stats.label.toUpperCase() === type.toUpperCase();
            }).map(stats => {
                return {
                    total: stats.total,
                    covered: stats.covered,
                    percent: (stats.covered / stats.total) * 100.0
                } as IBuildCodeCoverageValues;
            }).reduce((prev, curr) => {
                const newTotal = Math.max(prev.total + curr.total, 1);
                const newCovered = prev.covered + curr.covered;
                const values = {
                    total: newTotal,
                    covered: newCovered,
                    percent: (newCovered / newTotal) * 100.0
                } as IBuildCodeCoverageValues;
                return values;
            });
        });
    return result;
}

function getBuildsFromProject(projectId: string, buildDefinitionId: number, maxBuilds: number): IPromise<BuildContracts.Build[]> {
    return build.getClient().getBuilds(projectId, [buildDefinitionId],
        null, null, null, null, null, null, BuildContracts.BuildStatus.Completed,
        BuildContracts.BuildResult.Failed | BuildContracts.BuildResult.PartiallySucceeded | BuildContracts.BuildResult.Succeeded,
        null, null, null, null, maxBuilds, null, null, null, null, null);
}

async function getBuildInfo(projectId: string, buildDefId: number,
    maxBuilds: number = 25, type: string = 'Lines'): Promise<IBuildCodeCoverageStats[]> {
    // Get most recent successful build details
    const builds = await getBuildsFromProject(projectId, buildDefId, maxBuilds).then(async (builds) => {
        const coverages = await builds.map(async (build) => {
            const values = await getCodeCoverageSummary(projectId, build.id, type);
            return {
                id: build.id,
                number: build.buildNumber,
                result: build.result,
                url: build._links.web.href as string,
                branch: build.sourceBranch,
                definitionId: build.definition.id,
                definitionName: build.definition.name,
                values: values
            } as IBuildCodeCoverageStats;
        });
        return Promise.all(coverages);
    });

    return builds.sort((a, b) => { return a.id - b.id; });
}

function getBuildStatusColor(result: BuildContracts.BuildResult): string {
    switch (result) {
        case BuildContracts.BuildResult.Canceled:
        case BuildContracts.BuildResult.Failed:
            return '#da0a00'; // Red
        case BuildContracts.BuildResult.PartiallySucceeded:
            return '#f8a800'; // Orange
        case BuildContracts.BuildResult.Succeeded:
            return '#107c10'; // Green
        default:
            return '#c8c8c8'; // Gray
    }
}

async function loadWithSettings(widgetSettings: any): Promise<WidgetContracts.WidgetStatus> {
    try {
        $('h2.title').text(widgetSettings.name);

        const settings = JSON.parse(widgetSettings.customSettings.data);
        if (!settings || !settings.buildDefinition) {
            // Initialize display values
            $('#init-label').show();
            $('#code-coverage-history').hide();
            $('#percent-label').hide();

            return dash.WidgetStatusHelper.Success();
        } else { $('#init-label').hide(); }

        const barWidth: number = 10;
        const barOffset: number = 2;

        const projectId = VSS.getWebContext().project.id;
        const buildDefId: number = parseInt(settings.buildDefinition);
        const measurementName: string = (settings.coverageMeasurement as string) || 'Lines';
        const showBuildName: boolean = (settings && settings.checkOptionBuildName === true);
        const showMeasurementName: boolean = (settings && settings.checkOptionMeasurementName === true);
        const decimalPlaces: number = (settings && settings.decimalPlaces) ? parseInt(settings.decimalPlaces) : 0;

        return getBuildInfo(projectId, buildDefId, undefined, measurementName).then(stats => {
            const minPercent: number = Math.min(...stats.map(s => s.values.percent));
            const maxPercent: number = Math.max(...stats.map(s => s.values.percent));
            const avgPercent: number = (minPercent + maxPercent) / 2;
            const lastStat: IBuildCodeCoverageStats = stats[stats.length - 1];

            // Bind things to the UI
            const chartContainer = $('#code-coverage-history');
            chartContainer.show().css('width', 300).css('height', 82)
                .css('position', 'relative').css('margin-bottom', 8);

            $('#percent-label').show();
            $('#last-percent-label').text(lastStat.values.percent.toFixed(decimalPlaces));

            if (showMeasurementName) {
                $('#measurement-label').text(' of ' + measurementName.toLocaleLowerCase());
            } else { $('#measurement-label').hide(); }

            if (showBuildName) {
                $('#last-build-anchor').text(lastStat.number).attr('href', lastStat.url);
            } else {
                $('#last-build-anchor').hide();
                $('#last-build-anchor-prefix').hide();
            }

            // Setup the histogram bars
            stats.forEach((stat, index) => {
                const bar = $(document.createElement('div'));
                const barHeight = ((stat.values.percent > 0 ? stat.values.percent : avgPercent) / maxPercent) * 100;
                bar.css('position', 'absolute').css('bottom', 0)
                    .css('cursor', 'pointer')
                    .css('left', index > 0 ? (barWidth + barOffset) * index : 0)
                    .css('background-color', getBuildStatusColor(stat.result))
                    .width(barWidth).height(barHeight + '%')
                    .attr('title', stat.definitionName + ' ' + stat.number + ' @ ' +
                    stat.values.percent.toFixed(decimalPlaces) + '% of ' + measurementName)
                    .click(e => {
                        e.preventDefault();
                        window.open(stat.url);
                    })
                    .appendTo(chartContainer);
            });

            return dash.WidgetStatusHelper.Success();
        }).catch(error => {
            console.error('Error loading code coverage chart widget: ' + error);
            return dash.WidgetStatusHelper.Failure(error as string);
        });
    } catch (error) {
        console.error('Error loading code coverage chart widget: ' + error);
        return dash.WidgetStatusHelper.Failure(error as string);
    }
}

function run(): void {
    dash.IncludeWidgetStyles();
    VSS.register('CodeCoverageChartWidget', function () {
        return {
            load: function (widgetSettings: any) { return loadWithSettings(widgetSettings); },
            reload: function (widgetSettings: any) { return loadWithSettings(widgetSettings); }
        };
    });
    VSS.notifyLoadSucceeded();
}

run();