/// <reference path="../node_modules/vss-web-extension-sdk/typings/VSS.SDK.d.ts" />

const markedMermaidRenderer = {
  renderContent: function (rawContent, options) {
    const targetElement = document.getElementById('render-content-display');
    if (marked && marked.parse) {
      marked.setOptions({
        gfm: true,
        xhtml: true,
        headerIds: true,
      });
      marked.use({ extensions: [mermaidExtension] });
      targetElement.innerHTML = marked.parse(rawContent);
    } else {
      targetElement.innerHTML = `Looks like there's a problem with how we're using marked. Please drop us a line and let us know. 🙏`;
    }
  },
};

VSS.init({
  applyTheme: true,
  usePlatformStyles: true,
  usePlatformScripts: true,
  explicitNotifyLoaded: true,
});

VSS.require(
  'TFS/Dashboards/WidgetHelpers',
  function (WidgetHelpers) {
    WidgetHelpers.IncludeWidgetStyles();

    VSS.register('marked_mermaid_renderer', (_) => markedMermaidRenderer);
    VSS.notifyLoadSucceeded();
  }
);

