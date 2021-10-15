const mermaidExtension = {
  name: 'mermaid',
  level: 'block',
  start(src) {
    return src.match(/^@{3}\s*?mermaid\s*?$/gm)?.index;
  },
  tokenizer(src, tokens) {
    const rule = /\s*?^@{3}\s*?mermaid\s*?^([\s\S]*)^@{3}\s*?$/gm;
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
VSS.init({
  usePlatformScripts: true,
  usePlatformStyles: true,
  explicitNotifyLoaded: true,
});
VSS.ready(function () {
  VSS.register('marked_mermaid_renderer', (_) => markedMermaidRenderer);
  VSS.notifyLoadSucceeded();
});
