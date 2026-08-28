import type { SnippetNode } from "./types.ts";

export function flattenSnippetTree(
  nodes: SnippetNode[],
  pathSegments: string[] = [],
): Array<SnippetNode & { path_segments: string[] }> {
  const files: Array<SnippetNode & { path_segments: string[] }> = [];

  for (const node of nodes) {
    const nextPath = [...pathSegments, node.name];
    if (node.type === "file") {
      files.push({ ...node, path_segments: nextPath });
    } else if (node.children) {
      files.push(...flattenSnippetTree(node.children, nextPath));
    }
  }

  return files;
}
