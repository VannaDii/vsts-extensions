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
  const rules: { [key: string]: RegExp } = { toc: /^\[{2}_TOC_\]{2}\s*?$/m, workItem: /^#(\d+)[^\w]?/m };
  const azureTokenizer: marked.TokenizerExtension & marked.RendererExtension = {
    name: 'azure',
    level: 'block',
    tokenizer(src, tokens) {
      const ruleIndex = Object.values(rules).findIndex((rule) => rule.test(src));
      if (ruleIndex < 0) return;

      const ruleKey = Object.keys(rules)[ruleIndex];

      const match = rules[ruleKey].exec(src);
      if (match && src.substring(0, match.index).trim() === '') {
        return {
          type: 'azure',
          case: ruleKey,
          raw: match[0], // Text to consume from the source
          matches: match.map((m) => m), // Additional custom properties
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
        case 'workItem': {
          // This is a work item reference
          // TODO: Fill this in from the work items service in context.
          const workItemId = parseInt(token.matches[1]);
          const workItemUrl = `https://someurl/${workItemId}`;
          const workItemType = 'Feature';
          const workItemTitle = 'Some new feature';
          const workItemState = 'New';
          const workItemJson = JSON.stringify({ workItemId, workItemState, workItemTitle, workItemType, workItemUrl });
          return `<span data-rendered-mention="work-item" class="mention-widget-workitem body-m" style="border-left-color: rgb(119, 59, 147)"><a class="mention-link mention-wi-link mention-click-handled" href="${workItemUrl}" data-wi='[${workItemJson}]'aria-label="${workItemType} ${workItemId}: ${workItemTitle}: State of the work item is ${workItemState}"><span class="work-item-type-icon-host"><i aria-label="${workItemType}" class="work-item-type-icon bowtie-icon bowtie-symbol-trophy work-item-type-icon-no-tooltip" role="figure" style="color: rgb(119, 59, 147)"></i></span><span class="secondary-text">${workItemId}</span><span class="mention-widget-workitem-title fontWeightSemiBold">${workItemTitle}</span></a><span class="mention-widget-workitem-state"><span class="workitem-state-color" style="background-color: rgb(178, 178, 178)"></span><span>${workItemState}</span></span></span>`;
        }
      }
      return JSON.stringify(token);
    },
  };
  return azureTokenizer;
}
