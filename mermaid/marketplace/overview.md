# Marked Mermaid Renderer

Render and preview [mermaid](https://mermaid-js.github.io/mermaid/) diagrams in the repo.

This extension currently only works with `.mmd` and `.md` files.

Mermaid diagrams embedded within markdown file rendering is handled via [marked](https://marked.js.org)

## Usage

Install this extension to your Azure DevOps Organization.

Choose any `Markdown` (`.md`) or `Mermaid` diagram (`.mmd`) file in your repo. The preview pane will show the rendered content of `Marked Mermaid`.

The extension leverages the latest `Mermaid` and `Marked` versions available from their CDN, so new features should be available as soon as they are released.

## Azure Wiki Support

At this time it is not possible to extend the Azure Wiki interface with this functionality, so it only works as a previewer for repo files.

Additional support for Azure-specific features is underway and will be tracked below:

- ✅ [TOC](https://docs.microsoft.com/en-us/azure/devops/project/wiki/wiki-markdown-guidance?view=azure-devops#table-of-contents-toc-for-wiki-pages)
- ✅ [Mermaid Live](https://mermaid.live)
  - This is a CDN pull from MermaidJS and not the built-in Azure version
- ✅ [HTML Tags](https://docs.microsoft.com/en-us/azure/devops/project/wiki/wiki-markdown-guidance?view=azure-devops#html-tag-support-in-wiki-pages) - [see markedjs caveats](https://github.com/markedjs/marked/blob/master/docs/demo/quickref.md#inline-html)
- ⬜️ [Work Item Links](https://docs.microsoft.com/en-us/azure/devops/project/wiki/wiki-markdown-guidance?view=azure-devops#link-to-work-items-from-a-wiki-page)
- ⬜️ [@mentions User/Group](https://docs.microsoft.com/en-us/azure/devops/project/wiki/wiki-markdown-guidance?view=azure-devops#-users-and-groups)
- ⬜️ [YAML Tags](https://docs.microsoft.com/en-us/azure/devops/project/wiki/wiki-markdown-guidance?view=azure-devops#yaml-tags)
- ⬜️ [Query Tables](https://docs.microsoft.com/en-us/azure/devops/project/wiki/wiki-markdown-guidance?view=azure-devops#embed-azure-boards-query-results-in-wiki)
- ⬜️ [Videos](https://docs.microsoft.com/en-us/azure/devops/project/wiki/wiki-markdown-guidance?view=azure-devops#embed-videos-in-a-wiki-page)
- ⬜️ [Page Visits](https://docs.microsoft.com/en-us/azure/devops/project/wiki/wiki-markdown-guidance?view=azure-devops#page-visits-for-wiki-pages)