const mermaidExtension = {
  name: 'mermaid',
  level: 'block',
  start(src) {
    return src.match(/^:{3}\s*?mermaid\s*?$/gm)?.index;
  },
  tokenizer(src, tokens) {
    const rule = /\s*?^:{3}\s*?mermaid\s*?^([\s\S]*)^:{3}\s*?$/gm;
    const match = rule.exec(src);
    if (match && src.substring(0, match.index).trim() === '') {
      const token = {
        type: 'mermaid',
        raw: match[0], // Text to consume from the source
        text: match[0], // Additional custom properties
        tokens: [...match[1].split('\n')], // Array where child inline tokens will be generated
      };
      return token;
    }
  },
  renderer(token) {
    return `<div class="mermaid">${token.tokens.filter((t) => !t.startsWith(':')).join('\n')}</div>`;
  },
};

const markedMermaidRenderer = {
  renderContent: function (rawContent, options) {
    marked.use({ extensions: [mermaidExtension] });
    document.getElementById('render-content-display').innerHTML = marked(rawContent);
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

document.addEventListener('readystatechange', (event) => {
  if (document.readyState === 'complete') {
    markedMermaidRenderer.renderContent(`
# This is a markdown page

I've embedded a diagram into it for testing purposes. You should see a diagram immediately below this paragraph.

::: mermaid
sequenceDiagram
%%{wrap}%%
participant A as AI
Note left of A: AI interface
participant U as User
Note right of U: small business owner<br/> seeking UIUX designer
A->>U: What brings you to CatOps?
Note left of A: tie responses to <br/>corpus
U->>A: I need a UIUX designer
Note right of U: we know this is<br/>a seeker requiring<br/> a professional connection
A->>U: Can you briefly describe the project?
Note left of A: This provides <br/>text for analysis <br/> for user insights
U->>A: I'm building an app that connects professionals.
Note left of A: From this AI can start <br/> to define the user: <br/>-actioned entrepreneur <br/> -development stage product <br/>-passion for helping professionals <br/> -passion for tech
:::

## Troubleshooting

If you didn't see a diagram, then you should let me know.

`);
  }
});
