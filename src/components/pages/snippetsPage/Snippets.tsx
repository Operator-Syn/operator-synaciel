import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown"; 
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Modal } from "react-bootstrap";
import "./Snippets.css";

type FileNode = { id: number; name: string; type: "dir" | "file"; modified: string; size?: number; format?: 'pdf' | 'md'; path?: string | null; children?: FileNode[]; };

const formatBytes = (bytes?: number) => {
    if (!bytes) return "—";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const formatDate = (dateString: string) => new Date(dateString).toLocaleString('en-US', { 
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false 
}).replace(',', '');

const generateFileIndex = (nodes: FileNode[], prefix = "/snippets"): Record<string, FileNode[]> => {
    let index: Record<string, FileNode[]> = { [prefix]: nodes };
    nodes.forEach(node => {
        if (node.type === "dir" && node.children) {
            index = { ...index, ...generateFileIndex(node.children, `${prefix}/${node.name}`) };
        }
    });
    return index;
};

const fetchSnippets = async (): Promise<FileNode[]> => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/snippets`);
    if (!response.ok) throw new Error("Failed to fetch");
    return response.json();
};

export default function Snippets() {
    // Integrated background refresh and cache management
    const { data: rootFileSystem, isLoading } = useQuery({ 
        queryKey: ["snippets"], 
        queryFn: fetchSnippets,
        refetchInterval: 1000 * 60 * 30,           // 30 mins
        refetchIntervalInBackground: true,
        staleTime: 1000 * 60 * 30,                 // 30 mins
        gcTime: 1000 * 60 * 35,                    // 35 mins
    });

    const [currentPathStr, setCurrentPathStr] = useState<string>("/snippets");
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [previewFileName, setPreviewFileName] = useState<string>("");
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fileIndex = useMemo(() => rootFileSystem ? generateFileIndex(rootFileSystem) : {}, [rootFileSystem]);
    const currentItems = fileIndex[currentPathStr] || [];

    const handleCopy = (code: string, id: string) => {
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDownloadFullFile = () => {
        if (!previewContent) return;
        const element = document.createElement("a");
        const file = new Blob([previewContent], { type: 'text/markdown' });
        element.href = URL.createObjectURL(file);
        element.download = previewFileName || "snippet.md";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const handleFileClick = async (file: FileNode) => {
        if (!file.path || file.format !== 'md') return;
        setPreviewFileName(file.name);
        const res = await fetch(`${import.meta.env.VITE_CDN_URL}/${file.path}`);
        setPreviewContent(await res.text());
    };

    if (isLoading) return <div className="p-5 text-center text-muted">Loading...</div>;

    return (
        <div className="p-3 p-md-5 autoindex-page">
            <div className="bg-white px-4 pb-4 pt-0 rounded shadow-sm snippet-card">
                <h5 className="mb-4 mt-4 text-dark fw-bold">Index of {currentPathStr}/</h5>
                
                <table className="table align-middle mb-0 table-fixed">
                    <thead className="text-muted small">
                        <tr>
                            <th className="col-name">NAME</th>
                            <th className="d-none d-md-table-cell col-modified">MODIFIED</th>
                            <th className="text-end d-none d-md-table-cell col-size">SIZE</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentPathStr !== "/snippets" && (
                            <tr className="cursor-pointer" onClick={() => setCurrentPathStr(currentPathStr.substring(0, currentPathStr.lastIndexOf("/")) || "/snippets")}>
                                <td className="text-dark fw-bold" colSpan={3}>📁 ../</td>
                            </tr>
                        )}
                        {currentItems.map((item) => (
                            <tr key={item.id} className="cursor-pointer" onClick={() => item.type === "dir" ? setCurrentPathStr(`${currentPathStr}/${item.name}`) : handleFileClick(item)}>
                                <td className="text-dark text-truncate">
                                    <span className="me-2">{item.type === "dir" ? "📁" : "📄"}</span> 
                                    {item.name}
                                </td>
                                <td className="text-muted small d-none d-md-table-cell">{formatDate(item.modified)}</td>
                                <td className="text-end text-muted small d-none d-md-table-cell">{item.type === "dir" ? "—" : formatBytes(item.size)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal show={!!previewContent} onHide={() => setPreviewContent(null)} size="lg" centered contentClassName="markdown-modal-content">
                <Modal.Header closeButton className="px-4 py-3 border-bottom-0">
                    <div className="d-flex justify-content-between align-items-center w-100 me-3">
                        <Modal.Title as="h6" className="fw-bold text-dark m-0 text-truncate" style={{ maxWidth: '70%' }}>
                            {previewFileName}
                        </Modal.Title>
                        <button className="btn btn-outline-dark btn-sm rounded-pill px-3 fw-bold shadow-sm" style={{ fontSize: '10px' }} onClick={handleDownloadFullFile}>
                            Download .md
                        </button>
                    </div>
                </Modal.Header>
                <Modal.Body className="markdown-body-container px-4">
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                            code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeString = String(children).replace(/\n$/, '');
                                const blockId = useMemo(() => btoa(codeString).substring(0, 16), [codeString]);

                                return !inline && match ? (
                                    <div className="code-block-wrapper">
                                        <div className="code-header">
                                            <span>{match[1].toUpperCase()}</span>
                                            <button className={`copy-btn shadow-sm ${copiedId === blockId ? 'copied' : ''}`} onClick={() => handleCopy(codeString, blockId)}>
                                                {copiedId === blockId ? "✓ Copied" : "Copy"}
                                            </button>
                                        </div>
                                        <SyntaxHighlighter
                                            style={vscDarkPlus}
                                            language={match[1]}
                                            PreTag="div"
                                            useInlineStyles={true}
                                            codeTagProps={{ style: { display: 'block', whiteSpace: 'pre', width: 'max-content', minWidth: '100%', lineHeight: '1.5' } }}
                                            customStyle={{ margin: 0, padding: '1.25rem', fontSize: '13px', overflowX: 'auto', background: '#1e1e1e' }}
                                            {...props}
                                        >
                                            {codeString}
                                        </SyntaxHighlighter>
                                    </div>
                                ) : (
                                    <code className="inline-code" {...props}>{children}</code>
                                );
                            }
                        }}
                    >
                        {previewContent}
                    </ReactMarkdown>
                </Modal.Body>
            </Modal>
        </div>
    );
}