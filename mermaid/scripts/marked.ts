import { marked } from 'marked';
import { mermaidExtension } from './mermaid';
import { makeAzureExtension, makeAzureRenderer, populateToc, TocItem } from './azure';

function buildMarkedMermaidRenderer() {
  const toc: TocItem[] = [];
  const azureRenderer = makeAzureRenderer((i) => {
    const last = toc.length - 1;
    if (last >= 0 && i.level > toc[last].level) {
      toc[last].children = toc[last].children || [];
      toc[last].children?.push(i);
    } else {
      toc.push(i);
    }
  });
  const azureExtension = makeAzureExtension();
  return {
    renderContent: function (rawContent: string, options?: any) {
      const targetElement = document.getElementById('render-content-display');
      if (!targetElement) throw new Error('A fundamental structural error has occurred.');
      if (marked && marked.parse) {
        marked.setOptions({
          gfm: true,
          xhtml: true,
          headerIds: true,
        });
        marked.use({ extensions: [azureExtension, mermaidExtension], renderer: azureRenderer });
        marked.parse(rawContent, { silent: true }, (error, result) => {
          if (error) {
            targetElement.innerHTML = `<code>${error.message}${error.stackTrace}</code>`;
          } else {
            targetElement.innerHTML = result;
            populateToc(() => toc);
          }
        });
      } else {
        targetElement.innerHTML = `<pre>Looks like there's a problem with how we're using marked. Please drop us a line and let us know. 🙏</pre>`;
      }
    },
  };
}

export const markedMermaidRenderer = buildMarkedMermaidRenderer();

export default markedMermaidRenderer;
