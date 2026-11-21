/**
 * One entry of the snippet tree as the API returns it.
 *
 * A node is either a folder (`dir`, with `children`) or a document (`file`).
 */
export interface SnippetNode {
  id: number;
  name: string;
  type: "dir" | "file";
  modified: string;
  size?: number;
  format?: "pdf" | "md";
  path?: string | null;
  children?: SnippetNode[];
}

/** A document leaf paired with the internal path that led to it. */
export interface SnippetDocument {
  id: number;
  name: string;
  path: string;
}

/**
 * Flatten the snippet tree to its document leaves.
 *
 * Algorithm:
 * 1. Walk the nodes depth-first, carrying the path built so far.
 * 2. Join each node's name onto that prefix with "/", leaving the first level bare.
 * 3. A `file` node becomes a document; a `dir` node recurses into its children.
 * 4. Return the documents in tree order, so links read like the folder listing.
 *
 * @param nodes Children of the level being walked.
 * @param prefix Path of the parent folder, empty at the root.
 * @returns Every document leaf, with its path relative to the snippets root.
 */
export function collectSnippetDocuments(nodes: SnippetNode[], prefix = ""): SnippetDocument[] {
  const documents: SnippetDocument[] = [];

  for (const node of nodes) {
    const nodePath = prefix ? `${prefix}/${node.name}` : node.name;

    if (node.type === "file") {
      documents.push({ id: node.id, name: node.name, path: nodePath });
      continue;
    }

    if (node.children) {
      documents.push(...collectSnippetDocuments(node.children, nodePath));
    }
  }

  return documents;
}
