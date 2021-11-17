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

| One | Two | Three | Four | Five |
| --- | --- | ----- | ---- | ---- |
| a   | b   | c     | d    | e    |
| f   | g   | h     | i    | j    |
| k   | l   | m     | n    | o    |
| p   | q   | r     | s    | t    |

`);
}