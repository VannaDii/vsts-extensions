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

function describeThing(thing) {
  if (typeof thing === 'function') {
    return thing
      .toString()
      .replace(/[\r\n\s]+/g, ' ')
      .match(/(?:function\s*\w*)?\s*(?:\((.*?)\)|([^\s]+))/)
      .slice(1, 3)
      .join('');
  } else {
    try {
      return JSON.stringify(thing);
    } catch {
      return (thing.toJSON && thing.toJSON()) || (thing.toJson && thing.toJson()) || thing.toString();
    }
  }
}

VSS.init({
  usePlatformScripts: true,
  usePlatformStyles: true,
  explicitNotifyLoaded: true,
  applyTheme: true,
});

VSS.require(
  'TFS/Dashboards/WidgetHelpers',
  'VSS/Features/Markdown',
  'Wiki/ViewCommon',
  'Wiki/Renderer',
  function (WidgetHelpers, Markdown, WikiCommon, WikiRenderer) {
    WidgetHelpers.IncludeWidgetStyles();

    console.log(`Markdown: ${JSON.stringify(Object.keys(Markdown).map((k) => describeThing(Markdown[k])))}`);
    console.log(`WikiCommon: ${JSON.stringify(Object.keys(WikiCommon).map((k) => describeThing(WikiCommon[k])))}`);
    console.log(
      `WikiRenderer: ${JSON.stringify(Object.keys(WikiRenderer).map((k) => describeThing(WikiRenderer[k])))}`
    );

    VSS.register('marked_mermaid_renderer', (_) => markedMermaidRenderer);
    VSS.notifyLoadSucceeded();
  }
);

/* function renderTestContent() {
  console.log('Rendering content');
  markedMermaidRenderer.renderContent(`
# Testing Content Rendering

This is a simple sample to test various markdowns

## Below is a Mermaid graph

@@@ mermaid
graph TD
  A[Christmas] -->|Get money| B(Go shopping)
  B --> C{Let me think}
  C -->|One| D[Laptop]
  C -->|Two| E[iPhone]
  C -->|Three| F[fa:fa-car Car]
@@@

## Sometime we have table issues

The above renders fine, but, the below does not render the grid lines:

| C1 | C2 |
|--|--|
| 1 | A |
| 2 | B |

`);
}
 */
