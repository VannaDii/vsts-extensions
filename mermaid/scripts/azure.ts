import { marked } from 'marked';

const TOC_CONTAINER_ID = 'toc-container-EySxfDRvi';

export type TocItem = { text: string; level: number; slug: string; children?: TocItem[] };
export type TocCollector = (item: TocItem) => void;
export type TocRetriever = () => TocItem[];

export function makeAzureRenderer(toc: TocCollector) {
  const azureRenderer: marked.RendererObject = {
    heading(text, level, raw, slugger) {
      const slug = slugger.slug(text).toLowerCase();
      toc && toc({ text, level, slug });
      return `<h${level}><a name="${slug}" class="anchor" href="#${slug}"><span class="header-link"></span></a>${text}</h${level}>`;
    },
  };
  return azureRenderer;
}

function renderItems(items: TocItem[]): string {
  return items
    .map((i) => `<li><a href="#${i.slug}">${i.text}</a><ul>${i.children && renderItems(i.children)}</ul></li>`)
    .join('');
}

export function populateToc(retriever: TocRetriever) {
  const items = retriever && retriever();
  const itemsHtml = renderItems(items);
  const tocHtml = `<div class="toc-container-header">Contents</div><ul>${itemsHtml}</ul>`;
  const tocContainer = document.getElementById(TOC_CONTAINER_ID);
  if (!tocContainer) throw new Error('A fundamental structural TOC error has occurred.');
  tocContainer.innerHTML = tocHtml;
}

export function makeAzureExtension() {
  const rule = /^\[{2}_TOC_\]{2}\s*?$/gm;
  const azureTokenizer: marked.TokenizerExtension & marked.RendererExtension = {
    name: 'azure',
    level: 'block',
    start(src) {
      return src.match(rule)?.index ?? Number.NaN;
    },
    tokenizer(src, tokens) {
      const match = rule.exec(src);
      if (match && src.substring(0, match.index).trim() === '') {
        return {
          type: 'azure',
          case: 'toc',
          raw: match[0], // Text to consume from the source
          text: match[0], // Additional custom properties
          tokens: [], // Array where child inline tokens will be generated
        };
      }
    },
    renderer(token) {
      if (!token.case) return 'Unsupported Azure Token';
      switch (token.case) {
        case 'toc': {
          return `<div id="${TOC_CONTAINER_ID}" class="toc-container"></div>`;
        }
      }
      return JSON.stringify(token);
    },
  };
  return azureTokenizer;
}
