// src/components/pages/snippetsPage/Snippets.tsx

import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Folder, X } from "lucide-react";
import {
  Component,
  type ComponentPropsWithoutRef,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import { useLocation, useNavigate } from "react-router-dom";
import remarkGfm from "remark-gfm";

import CookingArea from "../../cookingArea/CookingArea";
import "./Snippets.css";
import { SNIPPETS_REFETCH_INTERVAL_MS, SNIPPETS_STALE_TIME_MS } from "../../../data/cacheSettings";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";

const SyntaxRenderer = lazy(() => import("./SyntaxRenderer"));

const INTERNAL_ROOT_PATH = "/snippets";
const ROUTE_ROOT_PATH = "/snippets/root";

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

type MarkdownErrorBoundaryProps = {
  resetKey: string;
  children: ReactNode;
};

type MarkdownErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class MarkdownErrorBoundary extends Component<
  MarkdownErrorBoundaryProps,
  MarkdownErrorBoundaryState
> {
  state: MarkdownErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: unknown): MarkdownErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unknown render error",
    };
  }

  componentDidUpdate(previousProps: MarkdownErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({
        hasError: false,
        message: "",
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-warning text-center py-5">
          <div className="fw-bold mb-2">This Markdown file could not be rendered.</div>
          <div className="small opacity-75">
            {this.state.message || "The file may contain unsupported Markdown or code syntax."}
          </div>
          <div className="small opacity-75 mt-2">
            You can still use the Download button to inspect the raw file.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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

const slugifyPathSegment = (segment: string) =>
  segment.trim().replace(/\s+/g, "-").replace(/-+/g, "-");

const unslugifyPathSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment).replace(/-/g, " ");
  } catch {
    return segment.replace(/-/g, " ");
  }
};

const getInternalPathFromRoutePath = (pathname: string) => {
  const normalizedPathname = pathname.replace(/\/+$/, "");

  if (normalizedPathname === "/snippets" || normalizedPathname === ROUTE_ROOT_PATH) {
    return INTERNAL_ROOT_PATH;
  }

  if (!normalizedPathname.startsWith(`${ROUTE_ROOT_PATH}/`)) {
    return INTERNAL_ROOT_PATH;
  }

  const relativePath = normalizedPathname.slice(`${ROUTE_ROOT_PATH}/`.length);

  const decodedSegments = relativePath.split("/").filter(Boolean).map(unslugifyPathSegment);

  return [INTERNAL_ROOT_PATH, ...decodedSegments].join("/");
};

const getRoutePathFromInternalPath = (internalPath: string) => {
  const relativePath = internalPath
    .replace(/^\/snippets\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(slugifyPathSegment(segment)))
    .join("/");

  return `${ROUTE_ROOT_PATH}/${relativePath ? `${relativePath}/` : ""}`;
};

const getCanonicalRoutePath = (pathname: string) =>
  getRoutePathFromInternalPath(getInternalPathFromRoutePath(pathname));

const createSafeCodeBlockId = (value: string) => {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(i);
    hash |= 0;
  }

  return `code-${Math.abs(hash).toString(36)}-${value.length}`;
};

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

  const { data: rootFileSystem, isLoading } = useQuery({
    queryKey: ["snippets"],
    queryFn: fetchSnippets,
    refetchInterval: SNIPPETS_REFETCH_INTERVAL_MS,
    staleTime: SNIPPETS_STALE_TIME_MS,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>("");
  const [previewFileFormat, setPreviewFileFormat] = useState<FileNode["format"]>(undefined);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const previewRequestIdRef = useRef(0);
  const previewAbortControllerRef = useRef<AbortController | null>(null);
  const previewDialogRef = useRef<HTMLDivElement | null>(null);
  const previousPreviewFocusRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    const canonicalPath = getCanonicalRoutePath(location.pathname);

    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!isLoading && rootFileSystem && !fileIndex[currentPathStr]) {
      navigate(getRoutePathFromInternalPath(INTERNAL_ROOT_PATH), {
        replace: true,
      });
    }
  }, [currentPathStr, fileIndex, isLoading, navigate, rootFileSystem]);

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

  const handleCopy = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  };

  const handleDownloadFullFile = () => {
    if (!previewContent && !previewFileUrl) return;

    const element = document.createElement("a");

    if (previewFileFormat === "pdf" && previewFileUrl) {
      element.href = previewFileUrl;
      element.download = previewFileName || "snippet.pdf";
    } else if (previewContent) {
      const file = new Blob([previewContent], {
        type: "text/markdown;charset=utf-8",
      });

      const objectUrl = URL.createObjectURL(file);

      element.href = objectUrl;
      element.download = previewFileName || "snippet.md";

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    }

    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleFileClick = async (file: FileNode) => {
    if (!file.format) return;

    previewAbortControllerRef.current?.abort();

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;

    const controller = new AbortController();
    previewAbortControllerRef.current = controller;

    setPreviewFileName(file.name);
    setPreviewFileFormat(file.format);
    setPreviewContent(null);
    setPreviewFileUrl(null);
    setPreviewError(null);
    setIsPreviewLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/snippets/${file.id}/content`, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch file");
      }

      if (file.format === "pdf") {
        const blob = await response.blob();
        const fileUrl = URL.createObjectURL(blob);

        if (previewRequestIdRef.current !== requestId || controller.signal.aborted) {
          URL.revokeObjectURL(fileUrl);
          return;
        }

        setPreviewFileUrl(fileUrl);
      } else {
        const content = await response.text();

        if (previewRequestIdRef.current !== requestId || controller.signal.aborted) {
          return;
        }

        setPreviewContent(content);
      }
    } catch {
      if (previewRequestIdRef.current !== requestId || controller.signal.aborted) {
        return;
      }

      setPreviewError("Failed to load file.");
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

    setPreviewContent(null);
    setPreviewFileUrl(null);
    setPreviewFileName("");
    setPreviewFileFormat(undefined);
    setPreviewError(null);
    setIsPreviewLoading(false);
  }, []);

  const handleFolderClick = (folderName: string) => {
    navigate(getRoutePathFromInternalPath(`${currentPathStr}/${folderName}`));
  };

  const handleParentClick = () => {
    const parentPath =
      currentPathStr.substring(0, currentPathStr.lastIndexOf("/")) || INTERNAL_ROOT_PATH;

    navigate(getRoutePathFromInternalPath(parentPath));
  };

  const isModalOpen = isPreviewLoading || !!previewContent || !!previewFileUrl || !!previewError;

  useEffect(() => {
    if (!isModalOpen) return;

    previousPreviewFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    previewDialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClosePreview();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = previewDialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])",
      );

      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousPreviewFocusRef.current?.focus();
    };
  }, [handleClosePreview, isModalOpen]);

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
        item: canonicalUrl,
      },
    ],
  };

  return (
    <>
      <GlobalHeadManager
        title="Code Snippets"
        description="Browse code snippets, developer notes, and reference files from the Syn-Forge portfolio."
        image="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png"
        url={canonicalUrl}
        jsonLd={breadcrumbSchema}
      />

      <CookingArea>
        <div className="py-10 sm:py-14">
          {isLoading && (
            <div
              className="grid min-h-72 place-items-center border-y border-line"
              data-cursor="wait"
            >
              <p className="eyebrow animate-pulse">Loading snippets</p>
            </div>
          )}

          {!isLoading && (
            <div className="border-y border-line">
              <div className="border-b border-line py-6">
                <p className="eyebrow mb-4">04 / 04</p>
                <h1 className="text-page-title text-text">
                  <span>Index of&nbsp;</span>
                  <span
                    className="font-mono text-[0.55em] text-signal sm:text-[0.6em]"
                    title={`${currentPathStr}/`}
                  >
                    {currentPathStr}/
                  </span>
                </h1>
                <p className="mt-4 max-w-2xl text-lg text-text-muted">
                  Browse folders and open Markdown or PDF notes when you need them.
                </p>
              </div>

              <table className="w-full table-fixed text-left">
                <thead className="font-mono text-meta uppercase tracking-[0.06em] text-text-faint">
                  <tr>
                    <th className="w-[60%] border-b border-line px-3 py-4 sm:px-5">NAME</th>
                    <th className="hidden w-[25%] border-b border-line px-3 py-4 md:table-cell sm:px-5">
                      MODIFIED
                    </th>
                    <th className="hidden w-[15%] border-b border-line px-3 py-4 text-right md:table-cell sm:px-5">
                      SIZE
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {currentPathStr !== INTERNAL_ROOT_PATH && (
                    <tr
                      className="group cursor-pointer border-b border-line text-text hover:bg-surface-raised"
                      data-cursor="alias"
                      onClick={handleParentClick}
                    >
                      <td className="px-3 py-4 font-mono text-sm font-semibold sm:px-5" colSpan={3}>
                        <span className="mr-3 text-signal">../</span>
                        Parent folder
                      </td>
                    </tr>
                  )}

                  {currentItems.map((item) => (
                    <tr
                      key={item.id}
                      className="group cursor-pointer border-b border-line text-text transition-colors hover:bg-surface-raised"
                      data-cursor={item.type === "dir" ? "context-menu" : "alias"}
                      onClick={() =>
                        item.type === "dir" ? handleFolderClick(item.name) : handleFileClick(item)
                      }
                    >
                      <td className="truncate px-3 py-4 text-sm sm:px-5">
                        {item.type === "dir" ? (
                          <Folder
                            aria-hidden="true"
                            className="mr-3 inline text-signal"
                            size={17}
                          />
                        ) : (
                          <FileText
                            aria-hidden="true"
                            className="mr-3 inline text-text-muted"
                            size={17}
                          />
                        )}
                        {item.name}
                      </td>

                      <td className="hidden px-3 py-4 font-mono text-meta text-text-muted md:table-cell sm:px-5">
                        {formatDate(item.modified)}
                      </td>

                      <td className="hidden px-3 py-4 text-right font-mono text-meta text-text-muted md:table-cell sm:px-5">
                        {item.type === "dir" ? "—" : formatBytes(item.size)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="border-t border-line px-3 py-4 font-mono text-meta text-text-faint sm:px-5">
                Folders open to canonical paths. Files are fetched only when selected.
              </p>
            </div>
          )}

          {isModalOpen && (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-canvas/90 p-4 backdrop-blur-sm"
              data-cursor={isPreviewLoading ? "progress" : "zoom-out"}
              role="dialog"
              aria-modal="true"
              aria-label={previewFileName || "Snippet preview"}
            >
              <div
                ref={previewDialogRef}
                className="flex max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden border border-line-strong bg-surface shadow-panel outline-none"
                data-cursor="default"
                tabIndex={-1}
              >
                <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6">
                  <h2 className="truncate font-mono text-sm uppercase tracking-[0.06em] text-text">
                    {previewFileName || "Snippet preview"}
                  </h2>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      aria-label="Download file"
                      className="action-quiet min-h-10 px-3"
                      onClick={handleDownloadFullFile}
                      disabled={!previewContent && !previewFileUrl}
                    >
                      <Download aria-hidden="true" size={15} />
                      <span className="hidden sm:inline">Download</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Close preview"
                      className="inline-grid min-h-10 min-w-10 place-items-center border border-line-strong bg-transparent text-text hover:border-signal hover:text-signal"
                      onClick={handleClosePreview}
                    >
                      <X aria-hidden="true" size={18} />
                    </button>
                  </div>
                </header>

                <div
                  className={`markdown-body-container overflow-y-auto px-4 sm:px-8 ${previewFileFormat === "pdf" ? "pdf-modal-body" : ""}`}
                >
                  {isPreviewLoading && (
                    <div className="grid min-h-64 place-items-center">
                      <p className="eyebrow animate-pulse">Loading file</p>
                    </div>
                  )}

                  {!isPreviewLoading && previewError && (
                    <div className="py-16 text-center text-danger">{previewError}</div>
                  )}

                  {!isPreviewLoading && previewFileUrl && previewFileFormat === "pdf" && (
                    <iframe
                      className="h-[min(78dvh,860px)] w-full border-0"
                      src={previewFileUrl}
                      title={previewFileName}
                    />
                  )}

                  {!isPreviewLoading && previewContent && (
                    <MarkdownErrorBoundary resetKey={`${previewFileName}-${previewContent.length}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({
                            className,
                            children,
                            ...props
                          }: ComponentPropsWithoutRef<"code">) {
                            const rawCode = String(children ?? "");
                            const codeString = rawCode.replace(/\n$/, "");
                            const match = /language-([\w-]+)/.exec(className || "");

                            const isBlock = Boolean(match) || rawCode.includes("\n");

                            if (!isBlock) {
                              return (
                                <code className="inline-code" {...props}>
                                  {children}
                                </code>
                              );
                            }

                            const language = match?.[1] || "text";
                            const blockId = createSafeCodeBlockId(`${language}:${codeString}`);

                            return (
                              <div className="code-block-wrapper" data-cursor="text">
                                <div className="code-header flex items-center justify-between">
                                  <span className="font-mono text-meta text-text-muted">
                                    {language.toUpperCase()}
                                  </span>

                                  <button
                                    type="button"
                                    className={`action-quiet min-h-9 px-3 ${
                                      copiedId === blockId ? "border-success text-success" : ""
                                    }`}
                                    data-cursor="copy"
                                    onClick={() => handleCopy(codeString, blockId)}
                                  >
                                    {copiedId === blockId ? "Copied" : "Copy"}
                                  </button>
                                </div>

                                <Suspense
                                  fallback={
                                    <div className="p-3 text-text-muted">Loading Syntax...</div>
                                  }
                                >
                                  <SyntaxRenderer language={language} codeString={codeString} />
                                </Suspense>
                              </div>
                            );
                          },
                        }}
                      >
                        {previewContent}
                      </ReactMarkdown>
                    </MarkdownErrorBoundary>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </CookingArea>
    </>
  );
}
