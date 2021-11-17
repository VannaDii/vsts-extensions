import mermaid from 'mermaid';
import { marked } from 'marked';

let graphCounter = 0;
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
export const mermaidExtension: marked.TokenizerExtension & marked.RendererExtension = {
  name: 'mermaid',
  level: 'block',
  start(src) {
    return src.match(/^[@:]{3}\s*?mermaid\s*?$/gm)?.index ?? Number.NaN;
  },
  tokenizer(src, tokens) {
    const rule = /^[@:]{3}\smermaid\s*?^([\s\S]*?)^[@:]{3}\s*?$/gm;
    const match = rule.exec(src);
    if (match && src.substring(0, match.index).trim() === '') {
      return {
        type: 'mermaid',
        raw: match[0], // Text to consume from the source
        text: match[0], // Additional custom properties
        tokens: [...match[1].split('\n').map((v) => ({ type: 'GraphLine', raw: v } as marked.Tokens.Generic))], // Array where child inline tokens will be generated
        id: graphCounter++,
      } as marked.Tokens.Generic;
    }
  },
  renderer(token) {
    const defaultError = 'Looks like you have an empty graph in this document.';
    let graphSvg: string = defaultError;
    const elementId = `graphDiv_${token.id}`;
    const graphDef = token.tokens
      ?.filter((t) => !t.raw.startsWith('@') && !t.raw.startsWith(':'))
      .map((t) => t.raw)
      .join('\n');
    if (graphDef) {
      try {
        mermaid.mermaidAPI.render(elementId, graphDef, (svg) => (graphSvg = svg));
        return `<div class="mermaid">${graphSvg}</div>`;
      } catch (error: any) {
        document.getElementById(elementId)?.parentElement?.remove();
        const errorMessage = `Graph parse failed:<br /><br />${graphDef}<br /><br />${error.message}`;
        return `<code>${errorMessage.replace(/\n/gm, '<br />')}</code>`;
      }
    }
    return `<code>${defaultError}</code>`;
  },
};
