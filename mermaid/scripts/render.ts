import markedMermaidRenderer from './marked';
import * as vstsHelpers from 'TFS/Dashboards/WidgetHelpers';
type VsTsHelperType = typeof vstsHelpers;

VSS.init({
  applyTheme: true,
  usePlatformStyles: true,
  usePlatformScripts: true,
  explicitNotifyLoaded: true,
});

VSS.require('TFS/Dashboards/WidgetHelpers', function (WidgetHelpers: VsTsHelperType) {
  WidgetHelpers.IncludeWidgetStyles();

  VSS.register('marked_mermaid_renderer', markedMermaidRenderer);
  VSS.notifyLoadSucceeded();
});
