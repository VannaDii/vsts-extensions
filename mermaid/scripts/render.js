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

/* VSS.init({
  usePlatformScripts: true,
  usePlatformStyles: true,
  explicitNotifyLoaded: true,
});

VSS.ready(function () {
  VSS.register('marked_mermaid_renderer', (_) => markedMermaidRenderer);
  VSS.notifyLoadSucceeded();
}); */

function renderTestContent() {
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

