let graphCounter = 0;
const mermaidExtension = {
  name: 'mermaid',
  level: 'block',
  start(src) {
    return src.match(/^[@:]{3}\s*?mermaid\s*?$/gm)?.index;
  },
  tokenizer(src, tokens) {
    const rule = /^[@:]{3}\smermaid\s*?^([\s\S]*?)^[@:]{3}\s*?$/gm;
    const match = rule.exec(src);
    if (match && src.substring(0, match.index).trim() === '') {
      const token = {
        type: 'mermaid',
        raw: match[0], // Text to consume from the source
        text: match[0], // Additional custom properties
        tokens: [...match[1].split('\n')], // Array where child inline tokens will be generated
        id: graphCounter++,
      };
      return token;
    }
  },
  renderer(token) {
    let graphSvg;
    const grafDef = token.tokens.filter((t) => !t.startsWith('@')).join('\n');
    mermaid.mermaidAPI.render(`graphDiv_${token.id}`, grafDef, (svg) => (graphSvg = svg));
    return `<div class="mermaid">${graphSvg}</div>`;
  },
};
