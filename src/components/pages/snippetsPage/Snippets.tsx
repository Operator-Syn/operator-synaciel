// src/components/pages/snippetsPage/Snippets.tsx

import { useQuery } from "@tanstack/react-query";
import {
  Copy,
  Download,
  FileCode2,
  FileText,
  Folder,
  Home as HomeIcon,
  Info,
  Link as LinkIcon,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { SNIPPETS_REFETCH_INTERVAL_MS, SNIPPETS_STALE_TIME_MS } from "../../../data/cacheSettings";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import { LoadingBlock, LoadingRegion } from "../../loadingState/LoadingState";
import TransitionLink from "../../pageTransition/TransitionLink";
import usePageNavigate from "../../pageTransition/usePageNavigate";
import PointerCoordinates from "../../pointerCoordinates/PointerCoordinates";
import SnippetMarkdown from "./SnippetMarkdown";
import { getSnippetDocumentRoute, SNIPPETS_ROOT_PATH } from "./snippetRoutes";
import "./Snippets.css";

const INTERNAL_ROOT_PATH = SNIPPETS_ROOT_PATH;
const apiUrl = import.meta.env.VITE_API_URL;

type FileNode = {
  id: number;
  name: string;
  type: "dir" | "file";
  modified: string;
  size?: number;
  format?: "pdf" | "md";
  path?: string | null;
  children?: FileNode[];
};

const formatBytes = (bytes?: number) => {
  if (!bytes) return "—";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

const formatDate = (dateString: string) =>
  new Date(dateString)
    .toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(",", "");

const generateFileIndex = (
  nodes: FileNode[],
  prefix = INTERNAL_ROOT_PATH,
): Record<string, FileNode[]> => {
  let index: Record<string, FileNode[]> = {
    [prefix]: nodes,
  };

  nodes.forEach((node) => {
    if (node.type === "dir" && node.children) {
      index = {
        ...index,
        ...generateFileIndex(node.children, `${prefix}/${node.name}`),
      };
    }
  });

  return index;
};

const slugifyPathSegment = (segment: string) => segment.trim();

const unslugifyPathSegment = (segment: string, legacySlug = false) => {
  try {
    const decodedSegment = decodeURIComponent(segment);
    return legacySlug ? decodedSegment.replace(/-/g, " ") : decodedSegment;
  } catch {
    return legacySlug ? segment.replace(/-/g, " ") : segment;
  }
};

const getInternalPathFromRoutePath = (pathname: string) => {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const usesLegacyRoot =
    normalizedPathname === "/snippets/root" || normalizedPathname.startsWith("/snippets/root/");
  const routeRoot = usesLegacyRoot ? "/snippets/root" : "/snippets";

  if (normalizedPathname === "/snippets" || normalizedPathname === "/snippets/root") {
    return INTERNAL_ROOT_PATH;
  }

  if (!normalizedPathname.startsWith(`${routeRoot}/`)) {
    return INTERNAL_ROOT_PATH;
  }

  const relativePath = normalizedPathname.slice(`${routeRoot}/`.length);
  const decodedSegments = relativePath
    .split("/")
    .filter(Boolean)
    .map((segment) => unslugifyPathSegment(segment, usesLegacyRoot));

  return [INTERNAL_ROOT_PATH, ...decodedSegments].join("/");
};

const getRoutePathFromInternalPath = (internalPath: string) => {
  const relativePath = internalPath
    .replace(/^\/snippets\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(slugifyPathSegment(segment)))
    .join("/");

  return `/snippets/${relativePath ? `${relativePath}/` : ""}`;
};

const getCanonicalRoutePath = (pathname: string) =>
  getRoutePathFromInternalPath(getInternalPathFromRoutePath(pathname));

function SnippetIndexLoading() {
  return (
    <LoadingRegion className="snippets-index-loading" label="Preparing snippet index">
      <div className="snippets-index-loading-heading">
        <LoadingBlock />
        <LoadingBlock />
        <LoadingBlock />
      </div>
      {["one", "two", "three", "four", "five"].map((key) => (
        <div className="snippets-index-loading-row" key={key}>
          <LoadingBlock />
          <LoadingBlock />
          <LoadingBlock />
        </div>
      ))}
    </LoadingRegion>
  );
}

function SnippetPreviewLoading({ format }: { format?: FileNode["format"] }) {
  const isPdf = format === "pdf";

  return (
    <LoadingRegion
      className={
        isPdf
          ? "snippets-preview-loading snippets-preview-loading-pdf"
          : "snippets-preview-loading snippets-preview-loading-md"
      }
      label={isPdf ? "Preparing PDF preview" : "Preparing Markdown preview"}
    >
      <LoadingBlock />
      <LoadingBlock />
      <LoadingBlock />
      <LoadingBlock />
    </LoadingRegion>
  );
}

const fetchSnippets = async (): Promise<FileNode[]> => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/snippets`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch snippets");
  }

  const payload = await response.json();

  return payload.data;
};

export default function Snippets() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigateWithTransition = usePageNavigate();

  const {
    data: rootFileSystem,
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["snippets"],
    queryFn: fetchSnippets,
    refetchInterval: SNIPPETS_REFETCH_INTERVAL_MS,
    staleTime: SNIPPETS_STALE_TIME_MS,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewTruncated, setPreviewTruncated] = useState(false);

  const previewRequestIdRef = useRef(0);
  const previewAbortControllerRef = useRef<AbortController | null>(null);

  const fileIndex = useMemo(
    () => (rootFileSystem ? generateFileIndex(rootFileSystem) : {}),
    [rootFileSystem],
  );

  const currentPathStr = useMemo(
    () => getInternalPathFromRoutePath(location.pathname),
    [location.pathname],
  );
  const canonicalUrl = `https://syn-forge.com${getCanonicalRoutePath(location.pathname)}`;
  const currentItems = fileIndex[currentPathStr] || [];
  const selectedFilePath = selectedFile ? `${currentPathStr}/${selectedFile.name}` : null;

  useEffect(() => {
    const canonicalPath = getCanonicalRoutePath(location.pathname);

    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!isLoading && !isError && rootFileSystem && !fileIndex[currentPathStr]) {
      navigate(getRoutePathFromInternalPath(INTERNAL_ROOT_PATH), {
        replace: true,
      });
    }
  }, [currentPathStr, fileIndex, isError, isLoading, navigate, rootFileSystem]);

  useEffect(() => {
    return () => {
      if (previewFileUrl) {
        URL.revokeObjectURL(previewFileUrl);
      }
    };
  }, [previewFileUrl]);

  useEffect(() => {
    return () => {
      previewAbortControllerRef.current?.abort();
    };
  }, []);

  const handleDownloadFullFile = async () => {
    if (!selectedFile || isPreviewLoading) return;

    if (selectedFile.format === "pdf" && previewFileUrl) {
      const element = document.createElement("a");
      element.href = previewFileUrl;
      element.download = selectedFile.name;
      document.body.appendChild(element);
      element.click();
      element.remove();
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/snippets/${selectedFile.id}/content`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to download file");
      }

      const objectUrl = URL.createObjectURL(await response.blob());
      const element = document.createElement("a");
      element.href = objectUrl;
      element.download = selectedFile.name;
      document.body.appendChild(element);
      element.click();
      element.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setPreviewError("Failed to download file. Try again.");
    }
  };

  const handleFileSelect = async (file: FileNode) => {
    if (file.type !== "file" || !file.format) return;

    previewAbortControllerRef.current?.abort();

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;

    const controller = new AbortController();
    previewAbortControllerRef.current = controller;

    setSelectedFile(file);
    setPreviewContent(null);
    setPreviewFileUrl(null);
    setPreviewError(null);
    setPreviewTruncated(false);
    setIsPreviewLoading(true);

    try {
      const previewResponse = await fetch(`${apiUrl}/v2/snippets/${file.id}/preview`, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!previewResponse.ok) {
        throw new Error("Failed to fetch file preview");
      }

      const previewPayload = (await previewResponse.json()) as {
        data: {
          excerpt: string | null;
          truncated: boolean;
        };
      };

      if (file.format === "pdf") {
        const contentResponse = await fetch(`${apiUrl}/v2/snippets/${file.id}/content`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!contentResponse.ok) {
          throw new Error("Failed to fetch PDF preview");
        }

        const blob = await contentResponse.blob();
        const fileUrl = URL.createObjectURL(blob);

        if (previewRequestIdRef.current !== requestId || controller.signal.aborted) {
          URL.revokeObjectURL(fileUrl);
          return;
        }

        setPreviewFileUrl(fileUrl);
      } else {
        if (previewRequestIdRef.current !== requestId || controller.signal.aborted) {
          return;
        }

        setPreviewContent(previewPayload.data.excerpt);
        setPreviewTruncated(previewPayload.data.truncated);
      }
    } catch {
      if (previewRequestIdRef.current !== requestId || controller.signal.aborted) {
        return;
      }

      setPreviewError("Failed to load file preview. Try again or download the raw file.");
    } finally {
      if (previewRequestIdRef.current === requestId) {
        previewAbortControllerRef.current = null;
        setIsPreviewLoading(false);
      }
    }
  };

  const handleClosePreview = useCallback(() => {
    previewRequestIdRef.current += 1;
    previewAbortControllerRef.current?.abort();
    previewAbortControllerRef.current = null;

    setSelectedFile(null);
    setPreviewContent(null);
    setPreviewFileUrl(null);
    setPreviewError(null);
    setPreviewTruncated(false);
    setIsPreviewLoading(false);
  }, []);

  const handleFolderClick = (folderName: string) => {
    handleClosePreview();
    navigateWithTransition(getRoutePathFromInternalPath(`${currentPathStr}/${folderName}`));
  };

  const handleParentClick = () => {
    const parentPath =
      currentPathStr.substring(0, currentPathStr.lastIndexOf("/")) || INTERNAL_ROOT_PATH;

    handleClosePreview();
    navigateWithTransition(getRoutePathFromInternalPath(parentPath));
  };

  useEffect(() => {
    if (!selectedFile && !isPreviewLoading && !previewError) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClosePreview();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleClosePreview, isPreviewLoading, previewError, selectedFile]);

  const breadcrumbSegments = currentPathStr.split("/").filter(Boolean).slice(1);
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://syn-forge.com/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Snippets",
        item: "https://syn-forge.com/snippets/",
      },
      ...breadcrumbSegments.map((segment, index) => ({
        "@type": "ListItem",
        position: index + 3,
        name: segment,
        item:
          "https://syn-forge.com" +
          getRoutePathFromInternalPath(
            [INTERNAL_ROOT_PATH, ...breadcrumbSegments.slice(0, index + 1)].join("/"),
          ),
      })),
    ],
  };

  return (
    <>
      <GlobalHeadManager
        title="Code Snippets"
        description="Browse code snippets, developer notes, and reference files from the Syn-Forge portfolio."
        url={canonicalUrl}
        jsonLd={breadcrumbSchema}
      />

      <main aria-labelledby="snippets-page-title">
        <CookingArea>
          <div className="snippets-shell">
            <PointerCoordinates
              activeSection={0}
              className="snippets-coordinates"
              markerCount={1}
            />

            <div className="snippets-workspace">
              <section className="snippets-index-panel" aria-labelledby="snippets-page-title">
                <div className="snippets-index-content">
                  <nav aria-label="Snippet breadcrumbs" className="snippets-breadcrumb">
                    <TransitionLink
                      aria-label="Snippets index root"
                      className="snippets-breadcrumb-home"
                      data-cursor="open"
                      to={getRoutePathFromInternalPath(INTERNAL_ROOT_PATH)}
                    >
                      <HomeIcon aria-hidden="true" size={18} />
                    </TransitionLink>
                    <span aria-hidden="true">/</span>
                    <span className="snippets-breadcrumb-current">snippets</span>
                    <span aria-hidden="true">/</span>
                    {breadcrumbSegments.map((segment) => (
                      <span className="snippets-breadcrumb-segment" key={segment}>
                        {segment}
                      </span>
                    ))}
                  </nav>

                  <h1 className="sr-only" id="snippets-page-title">
                    Code snippets index
                  </h1>

                  {isLoading && <SnippetIndexLoading />}

                  {!isLoading && isError && (
                    <div className="snippets-state snippets-error-state">
                      <p role="alert">The snippet index could not be loaded.</p>
                      <button className="action-quiet" onClick={() => void refetch()} type="button">
                        Try again
                      </button>
                    </div>
                  )}

                  {!isLoading && !isError && (
                    <>
                      <div className="sr-only">
                        <span id="snippets-folder-action">Opens this folder.</span>
                        <span id="snippets-file-action">Previews this file.</span>
                      </div>
                      <table className="snippets-file-table">
                        <caption className="sr-only">Files and folders in {currentPathStr}</caption>
                        <thead>
                          <tr>
                            <th scope="col">Name</th>
                            <th scope="col">Modified</th>
                            <th scope="col">Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPathStr !== INTERNAL_ROOT_PATH && (
                            <tr className="snippet-parent-row">
                              <td colSpan={3}>
                                <button
                                  className="snippet-file-action"
                                  data-cursor="alias"
                                  onClick={handleParentClick}
                                  type="button"
                                >
                                  <span className="snippet-file-primary">
                                    <span className="snippet-parent-mark">../</span>
                                    <span>Parent folder</span>
                                  </span>
                                </button>
                              </td>
                            </tr>
                          )}

                          {currentItems.map((item) => {
                            const isSelected = item.type === "file" && selectedFile?.id === item.id;
                            const itemSize = item.type === "dir" ? "—" : formatBytes(item.size);

                            return (
                              <tr className={isSelected ? "is-selected" : undefined} key={item.id}>
                                <td colSpan={3}>
                                  <button
                                    aria-describedby={
                                      item.type === "dir"
                                        ? "snippets-folder-action"
                                        : "snippets-file-action"
                                    }
                                    aria-pressed={item.type === "file" ? isSelected : undefined}
                                    className="snippet-file-action"
                                    data-cursor={item.type === "dir" ? "context-menu" : "open"}
                                    onClick={() => {
                                      if (item.type === "dir") {
                                        handleFolderClick(item.name);
                                      } else {
                                        void handleFileSelect(item);
                                      }
                                    }}
                                    type="button"
                                  >
                                    <span className="snippet-file-primary">
                                      {item.type === "dir" ? (
                                        <Folder
                                          aria-hidden="true"
                                          className="snippet-file-icon"
                                          size={18}
                                        />
                                      ) : (
                                        <FileText
                                          aria-hidden="true"
                                          className="snippet-file-icon snippet-file-icon-muted"
                                          size={18}
                                        />
                                      )}
                                      <span className="snippet-file-name">{item.name}</span>
                                      <span className="snippet-file-mobile-meta">
                                        {formatDate(item.modified)} · {itemSize}
                                      </span>
                                    </span>
                                    <span className="snippet-file-meta">
                                      {formatDate(item.modified)}
                                    </span>
                                    <span className="snippet-file-meta snippet-file-size">
                                      {itemSize}
                                    </span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}

                          {currentItems.length === 0 && (
                            <tr>
                              <td className="snippets-empty-index" colSpan={3}>
                                No files or folders in this directory.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>

                <footer className="snippets-index-note">
                  <Info aria-hidden="true" size={18} />
                  <div>
                    <p>Folders open to /snippets/&lt;name&gt;/. Markdown and PDF previews.</p>
                  </div>
                </footer>
              </section>

              <aside
                aria-busy={isPreviewLoading}
                aria-labelledby="snippets-preview-title"
                className="snippets-preview-panel"
              >
                <header className="snippets-preview-header">
                  <div className="snippets-preview-heading">
                    <FileCode2 aria-hidden="true" size={21} />
                    <span id="snippets-preview-title">Preview</span>
                    {selectedFile?.format && (
                      <span className="snippets-preview-format">
                        {selectedFile.format.toUpperCase()}
                      </span>
                    )}
                    <span className="snippets-preview-path">
                      {selectedFilePath || "No file selected"}
                    </span>
                  </div>

                  <div className="snippets-preview-actions">
                    {selectedFile?.format === "md" && (
                      <>
                        <TransitionLink
                          aria-label={`Read more about ${selectedFile.name}`}
                          className="snippets-preview-read-more"
                          data-cursor="alias"
                          to={getSnippetDocumentRoute(selectedFile.id, selectedFile.name)}
                        >
                          <LinkIcon aria-hidden="true" size={16} />
                          <span>Read more</span>
                        </TransitionLink>
                        <button
                          aria-label="Download file"
                          className="snippets-preview-download"
                          disabled={isPreviewLoading}
                          onClick={() => void handleDownloadFullFile()}
                          type="button"
                        >
                          <Download aria-hidden="true" size={17} />
                          <span>Download</span>
                        </button>
                      </>
                    )}
                    <button
                      aria-label="Close preview"
                      className="snippets-preview-close"
                      disabled={!selectedFile && !isPreviewLoading && !previewError}
                      onClick={handleClosePreview}
                      type="button"
                    >
                      <X aria-hidden="true" size={19} />
                    </button>
                  </div>
                </header>

                <div className="snippets-preview-body" data-cursor="default">
                  {!selectedFile && !isPreviewLoading && !previewError && (
                    <div className="snippets-empty-preview">
                      <div aria-hidden="true" className="snippets-empty-preview-mark">
                        <FileCode2 size={44} strokeWidth={1.5} />
                      </div>
                      <p className="snippets-empty-preview-kicker">Preview / Standby</p>
                      <h2 id="snippets-empty-preview-title">Select a file to inspect</h2>
                      <p className="snippets-empty-preview-copy">
                        Choose a Markdown or PDF file from the index to begin.
                      </p>
                      <div className="snippets-supported-actions">
                        <div className="snippets-supported-actions-heading">
                          <span>Available in preview</span>
                          <span>02 actions</span>
                        </div>
                        <ul>
                          <li>
                            <Copy aria-hidden="true" size={18} />
                            Copy code blocks
                          </li>
                          <li>
                            <Download aria-hidden="true" size={18} />
                            Download source file
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {isPreviewLoading && <SnippetPreviewLoading format={selectedFile?.format} />}

                  {!isPreviewLoading && previewError && (
                    <div className="snippets-state snippets-error-state">
                      <p role="alert">{previewError}</p>
                      {selectedFile && (
                        <button
                          className="action-quiet"
                          onClick={() => void handleFileSelect(selectedFile)}
                          type="button"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  )}

                  {!isPreviewLoading && previewFileUrl && selectedFile?.format === "pdf" && (
                    <iframe
                      className="snippets-pdf-frame"
                      data-pointer-surface="native"
                      src={previewFileUrl}
                      title={selectedFile.name}
                    />
                  )}

                  {!isPreviewLoading &&
                    previewContent !== null &&
                    selectedFile?.format === "md" && (
                      <>
                        <SnippetMarkdown
                          content={previewContent}
                          resetKey={`${selectedFile.name || ""}-${previewContent.length}`}
                        />
                        <div className="snippets-preview-document-cta">
                          <span>
                            {previewTruncated
                              ? "Preview ends here. Read the full document for the complete file."
                              : "Open the document in its dedicated reading view."}
                          </span>
                          <TransitionLink
                            aria-label={`Read the full document ${selectedFile.name}`}
                            className="snippets-preview-read-more"
                            data-cursor="alias"
                            to={getSnippetDocumentRoute(selectedFile.id, selectedFile.name)}
                          >
                            <LinkIcon aria-hidden="true" size={16} />
                            <span>Read more</span>
                          </TransitionLink>
                        </div>
                      </>
                    )}
                </div>

                <footer className="snippets-preview-footer">
                  <span className={previewError ? "snippets-status is-error" : "snippets-status"}>
                    {isPreviewLoading && (
                      <span aria-hidden="true" className="loading-inline-signal" />
                    )}
                    {previewError ? "Error" : isPreviewLoading ? "Preview" : "Ready"}
                  </span>
                  <span>
                    {selectedFile?.format === "md" && previewContent !== null
                      ? "Preview is bounded; read more opens the full document."
                      : "Files load only when selected."}
                  </span>
                </footer>
              </aside>
            </div>
          </div>
        </CookingArea>
      </main>
    </>
  );
}
