// src/components/pages/snippetsPage/Snippets.tsx

import {
    Component,
    lazy,
    Suspense,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ComponentPropsWithoutRef,
    type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Modal } from "react-bootstrap";

import CookingArea from "../../cookingArea/CookingArea";
import "./Snippets.css";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import {
    SNIPPETS_REFETCH_INTERVAL_MS,
    SNIPPETS_STALE_TIME_MS,
} from "../../../data/cacheSettings";

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
        if (
            previousProps.resetKey !== this.props.resetKey &&
            this.state.hasError
        ) {
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

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

    if (
        normalizedPathname === "/snippets" ||
        normalizedPathname === ROUTE_ROOT_PATH
    ) {
        return INTERNAL_ROOT_PATH;
    }

    if (!normalizedPathname.startsWith(`${ROUTE_ROOT_PATH}/`)) {
        return INTERNAL_ROOT_PATH;
    }

    const relativePath = normalizedPathname.slice(`${ROUTE_ROOT_PATH}/`.length);

    const decodedSegments = relativePath
        .split("/")
        .filter(Boolean)
        .map(unslugifyPathSegment);

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
    const [previewFileFormat, setPreviewFileFormat] =
        useState<FileNode["format"]>(undefined);
    const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

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
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/snippets/${file.id}/content`,
                {
                    signal: controller.signal,
                    cache: "no-store",
                },
            );

            if (!response.ok) {
                throw new Error("Failed to fetch file");
            }

            if (file.format === "pdf") {
                const blob = await response.blob();
                const fileUrl = URL.createObjectURL(blob);

                if (
                    previewRequestIdRef.current !== requestId ||
                    controller.signal.aborted
                ) {
                    URL.revokeObjectURL(fileUrl);
                    return;
                }

                setPreviewFileUrl(fileUrl);
            } else {
                const content = await response.text();

                if (
                    previewRequestIdRef.current !== requestId ||
                    controller.signal.aborted
                ) {
                    return;
                }

                setPreviewContent(content);
            }
        } catch {
            if (
                previewRequestIdRef.current !== requestId ||
                controller.signal.aborted
            ) {
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

    const handleClosePreview = () => {
        previewRequestIdRef.current += 1;
        previewAbortControllerRef.current?.abort();
        previewAbortControllerRef.current = null;

        setPreviewContent(null);
        setPreviewFileUrl(null);
        setPreviewFileName("");
        setPreviewFileFormat(undefined);
        setPreviewError(null);
        setIsPreviewLoading(false);
    };

    const handleFolderClick = (folderName: string) => {
        navigate(getRoutePathFromInternalPath(`${currentPathStr}/${folderName}`));
    };

    const handleParentClick = () => {
        const parentPath =
            currentPathStr.substring(0, currentPathStr.lastIndexOf("/")) ||
            INTERNAL_ROOT_PATH;

        navigate(getRoutePathFromInternalPath(parentPath));
    };

    const isModalOpen =
        isPreviewLoading ||
        !!previewContent ||
        !!previewFileUrl ||
        !!previewError;

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
                <div className="p-3 p-md-5 autoindex-page">
                    {isLoading && (
                        <div className="d-flex justify-content-center my-5">
                            <div className="spinner-border text-primary" role="status" />
                        </div>
                    )}

                    {!isLoading && (
                        <div className="px-4 pb-4 pt-0 rounded snippet-card">
                            <h5 className="mb-4 mt-4 text-white fw-bold snippet-path-heading">
                                <span>Index of&nbsp;</span>
                                <span
                                    className="snippet-path-text"
                                    title={`${currentPathStr}/`}
                                >
                                    {currentPathStr}/
                                </span>
                            </h5>

                            <table className="table align-middle mb-0 table-fixed">
                                <thead className="text-white-50 small">
                                    <tr>
                                        <th className="col-name">NAME</th>
                                        <th className="d-none d-md-table-cell col-modified">
                                            MODIFIED
                                        </th>
                                        <th className="text-end d-none d-md-table-cell col-size">
                                            SIZE
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {currentPathStr !== INTERNAL_ROOT_PATH && (
                                        <tr
                                            className="cursor-pointer"
                                            onClick={handleParentClick}
                                        >
                                            <td className="text-white fw-bold" colSpan={3}>
                                                📁 ../
                                            </td>
                                        </tr>
                                    )}

                                    {currentItems.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="cursor-pointer"
                                            onClick={() =>
                                                item.type === "dir"
                                                    ? handleFolderClick(item.name)
                                                    : handleFileClick(item)
                                            }
                                        >
                                            <td className="text-white text-truncate">
                                                <span className="me-2">
                                                    {item.type === "dir" ? "📁" : "📄"}
                                                </span>
                                                {item.name}
                                            </td>

                                            <td className="text-white-50 small d-none d-md-table-cell">
                                                {formatDate(item.modified)}
                                            </td>

                                            <td className="text-end text-white-50 small d-none d-md-table-cell">
                                                {item.type === "dir"
                                                    ? "—"
                                                    : formatBytes(item.size)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <Modal
                        show={isModalOpen}
                        onHide={handleClosePreview}
                        size="xl"
                        fullscreen="sm-down"
                        centered
                        contentClassName="markdown-modal-content"
                    >
                        <Modal.Header closeButton className="px-4 py-3 border-bottom-0">
                            <div className="d-flex justify-content-between align-items-center w-100 me-3">
                                <Modal.Title
                                    as="h6"
                                    className="fw-bold text-dark m-0 text-truncate"
                                    style={{ maxWidth: "70%" }}
                                >
                                    {previewFileName}
                                </Modal.Title>

                                <button
                                    type="button"
                                    className="btn btn-outline-dark btn-sm rounded-pill px-3 fw-bold shadow-sm"
                                    onClick={handleDownloadFullFile}
                                    disabled={!previewContent && !previewFileUrl}
                                >
                                    Download
                                </button>
                            </div>
                        </Modal.Header>

                        <Modal.Body
                            className={`markdown-body-container px-4 ${
                                previewFileFormat === "pdf" ? "pdf-modal-body" : ""
                            }`}
                        >
                            {isPreviewLoading && (
                                <div className="text-center py-5">
                                    <div
                                        className="spinner-border text-dark mb-3"
                                        role="status"
                                    />
                                </div>
                            )}

                            {!isPreviewLoading && previewError && (
                                <div className="text-danger text-center py-5">
                                    {previewError}
                                </div>
                            )}

                            {!isPreviewLoading &&
                                previewFileUrl &&
                                previewFileFormat === "pdf" && (
                                    <iframe
                                        className="pdf-preview-frame"
                                        src={previewFileUrl}
                                        title={previewFileName}
                                    />
                                )}

                            {!isPreviewLoading && previewContent && (
                                <MarkdownErrorBoundary
                                    resetKey={`${previewFileName}-${previewContent.length}`}
                                >
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            code({ className, children, ...props }: ComponentPropsWithoutRef<"code">) {
                                                const rawCode = String(children ?? "");
                                                const codeString = rawCode.replace(/\n$/, "");
                                                const match = /language-([\w-]+)/.exec(
                                                    className || "",
                                                );

                                                const isBlock =
                                                    Boolean(match) || rawCode.includes("\n");

                                                if (!isBlock) {
                                                    return (
                                                        <code
                                                            className="inline-code"
                                                            {...props}
                                                        >
                                                            {children}
                                                        </code>
                                                    );
                                                }

                                                const language = match?.[1] || "text";
                                                const blockId = createSafeCodeBlockId(
                                                    `${language}:${codeString}`,
                                                );

                                                return (
                                                    <div className="code-block-wrapper">
                                                        <div className="code-header">
                                                            <span>{language.toUpperCase()}</span>

                                                            <button
                                                                type="button"
                                                                className={`copy-btn shadow-sm ${
                                                                    copiedId === blockId
                                                                        ? "copied"
                                                                        : ""
                                                                }`}
                                                                onClick={() =>
                                                                    handleCopy(
                                                                        codeString,
                                                                        blockId,
                                                                    )
                                                                }
                                                            >
                                                                {copiedId === blockId
                                                                    ? "✓ Copied"
                                                                    : "Copy"}
                                                            </button>
                                                        </div>

                                                        <Suspense
                                                            fallback={
                                                                <div className="p-3 text-muted">
                                                                    Loading Syntax...
                                                                </div>
                                                            }
                                                        >
                                                            <SyntaxRenderer
                                                                language={language}
                                                                codeString={codeString}
                                                            />
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
                        </Modal.Body>
                    </Modal>
                </div>
            </CookingArea>
        </>
    );
}
