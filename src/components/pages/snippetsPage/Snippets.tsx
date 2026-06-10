import { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Modal } from "react-bootstrap";
import CookingArea from "../../cookingArea/CookingArea";
import "./Snippets.css";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import { SNIPPETS_REFETCH_INTERVAL_MS, SNIPPETS_STALE_TIME_MS } from "../../../data/cacheSettings";

// Lazy load the heavy syntax engine to split the bundle
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

// ... [Keep your helper functions: formatBytes, formatDate, generateFileIndex, fetchSnippets] ...
const formatBytes = (bytes?: number) => {
    if (!bytes) return "—";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const formatDate = (dateString: string) =>
    new Date(dateString)
        .toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true })
        .replace(",", "");

const generateFileIndex = (nodes: FileNode[], prefix = "/snippets"): Record<string, FileNode[]> => {
    let index: Record<string, FileNode[]> = { [prefix]: nodes };
    nodes.forEach((node) => {
        if (node.type === "dir" && node.children) {
            index = { ...index, ...generateFileIndex(node.children, `${prefix}/${node.name}`) };
        }
    });
    return index;
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
    const decodedSegments = relativePath
        .split("/")
        .filter(Boolean)
        .map((segment) => {
            try {
                return decodeURIComponent(segment);
            } catch {
                return segment;
            }
        });

    return [INTERNAL_ROOT_PATH, ...decodedSegments].join("/");
};

const getRoutePathFromInternalPath = (internalPath: string) => {
    const relativePath = internalPath
        .replace(/^\/snippets\/?/, "")
        .split("/")
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join("/");

    return `${ROUTE_ROOT_PATH}/${relativePath ? `${relativePath}/` : ""}`;
};

const getCanonicalRoutePath = (pathname: string) => (
    getRoutePathFromInternalPath(getInternalPathFromRoutePath(pathname))
);

const fetchSnippets = async (): Promise<FileNode[]> => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/snippets`);
    if (!response.ok) throw new Error("Failed to fetch snippets");
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

    const fileIndex = useMemo(() => (rootFileSystem ? generateFileIndex(rootFileSystem) : {}), [rootFileSystem]);
    const currentPathStr = useMemo(() => getInternalPathFromRoutePath(location.pathname), [location.pathname]);
    const currentItems = fileIndex[currentPathStr] || [];

    useEffect(() => {
        const canonicalPath = getCanonicalRoutePath(location.pathname);

        if (location.pathname !== canonicalPath) {
            navigate(canonicalPath, { replace: true });
        }
    }, [location.pathname, navigate]);

    useEffect(() => {
        if (!isLoading && rootFileSystem && !fileIndex[currentPathStr]) {
            navigate(getRoutePathFromInternalPath(INTERNAL_ROOT_PATH), { replace: true });
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

    const handleCopy = (code: string, id: string) => {
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDownloadFullFile = () => {
        if (!previewContent && !previewFileUrl) return;

        const element = document.createElement("a");

        if (previewFileFormat === "pdf" && previewFileUrl) {
            element.href = previewFileUrl;
            element.download = previewFileName || "snippet.pdf";
        } else if (previewContent) {
            const file = new Blob([previewContent], { type: "text/markdown" });
            element.href = URL.createObjectURL(file);
            element.download = previewFileName || "snippet.md";
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
            const res = await fetch(`${import.meta.env.VITE_API_URL}/snippets/${file.id}/content`, {
                signal: controller.signal,
            });
            if (!res.ok) throw new Error("Failed to fetch file");

            if (file.format === "pdf") {
                const blob = await res.blob();
                const fileUrl = URL.createObjectURL(blob);

                if (previewRequestIdRef.current !== requestId || controller.signal.aborted) {
                    URL.revokeObjectURL(fileUrl);
                    return;
                }

                setPreviewFileUrl(fileUrl);
            } else {
                const content = await res.text();

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
        const parentPath = currentPathStr.substring(0, currentPathStr.lastIndexOf("/")) || INTERNAL_ROOT_PATH;
        navigate(getRoutePathFromInternalPath(parentPath));
    };

    const isModalOpen = isPreviewLoading || !!previewContent || !!previewFileUrl || !!previewError;

    return (
        <>
            <GlobalHeadManager
                title="Snippets"
                description="A collection of code snippets..."
                image="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png"
                url="https://syn-forge.com/snippets"
            />
            
            <CookingArea>
                <div className="p-3 p-md-5 autoindex-page">
                    {isLoading && (
                        <div className="d-flex justify-content-center my-5">
                            <div className="spinner-border text-primary" role="status"></div>
                        </div>
                    )}

                    {!isLoading && (
                        <div className="px-4 pb-4 pt-0 rounded snippet-card">
                            <h5 className="mb-4 mt-4 text-white fw-bold snippet-path-heading">
                                <span>Index of&nbsp;</span>
                                <span className="snippet-path-text" title={`${currentPathStr}/`}>{currentPathStr}/</span>
                            </h5>
                            <table className="table align-middle mb-0 table-fixed">
                                <thead className="text-white-50 small">
                                    <tr><th className="col-name">NAME</th><th className="d-none d-md-table-cell col-modified">MODIFIED</th><th className="text-end d-none d-md-table-cell col-size">SIZE</th></tr>
                                </thead>
                                <tbody>
                                    {currentPathStr !== "/snippets" && (
                                        <tr className="cursor-pointer" onClick={handleParentClick}>
                                            <td className="text-white fw-bold" colSpan={3}>📁 ../</td>
                                        </tr>
                                    )}
                                    {currentItems.map((item) => (
                                        <tr key={item.id} className="cursor-pointer" onClick={() => item.type === "dir" ? handleFolderClick(item.name) : handleFileClick(item)}>
                                            <td className="text-white text-truncate"><span className="me-2">{item.type === "dir" ? "📁" : "📄"}</span>{item.name}</td>
                                            <td className="text-white-50 small d-none d-md-table-cell">{formatDate(item.modified)}</td>
                                            <td className="text-end text-white-50 small d-none d-md-table-cell">{item.type === "dir" ? "—" : formatBytes(item.size)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <Modal show={isModalOpen} onHide={handleClosePreview} size="xl" fullscreen="sm-down" centered contentClassName="markdown-modal-content">
                        <Modal.Header closeButton className="px-4 py-3 border-bottom-0">
                            <div className="d-flex justify-content-between align-items-center w-100 me-3">
                                <Modal.Title as="h6" className="fw-bold text-dark m-0 text-truncate" style={{ maxWidth: "70%" }}>{previewFileName}</Modal.Title>
                                <button className="btn btn-outline-dark btn-sm rounded-pill px-3 fw-bold shadow-sm" onClick={handleDownloadFullFile} disabled={!previewContent && !previewFileUrl}>Download</button>
                            </div>
                        </Modal.Header>
                        <Modal.Body className={`markdown-body-container px-4 ${previewFileFormat === "pdf" ? "pdf-modal-body" : ""}`}>
                            {isPreviewLoading && <div className="text-center py-5"><div className="spinner-border text-dark mb-3" role="status" /></div>}
                            {!isPreviewLoading && previewError && <div className="text-danger text-center py-5">{previewError}</div>}
                            {!isPreviewLoading && previewFileUrl && previewFileFormat === "pdf" && (
                                <iframe className="pdf-preview-frame" src={previewFileUrl} title={previewFileName} />
                            )}
                            {!isPreviewLoading && previewContent && (
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                    code({ className, children, ...props }: any) {
                                        const match = /language-(\w+)/.exec(className || "");
                                        const codeString = String(children).replace(/\n$/, "");
                                        const blockId = btoa(codeString).substring(0, 16);
                                        return match ? (
                                            <div className="code-block-wrapper">
                                                <div className="code-header"><span>{match[1].toUpperCase()}</span>
                                                    <button className={`copy-btn shadow-sm ${copiedId === blockId ? "copied" : ""}`} onClick={() => handleCopy(codeString, blockId)}>{copiedId === blockId ? "✓ Copied" : "Copy"}</button>
                                                </div>
                                                <Suspense fallback={<div className="p-3 text-muted">Loading Syntax...</div>}>
                                                    <SyntaxRenderer language={match[1]} codeString={codeString} {...props} />
                                                </Suspense>
                                            </div>
                                        ) : <code className="inline-code" {...props}>{children}</code>;
                                    }
                                }}>{previewContent}</ReactMarkdown>
                            )}
                        </Modal.Body>
                    </Modal>
                </div>
            </CookingArea>
        </>
    );
}
