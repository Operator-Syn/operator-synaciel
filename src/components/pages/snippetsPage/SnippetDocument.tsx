import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileCode2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import { LoadingBlock, LoadingRegion } from "../../loadingState/LoadingState";
import PointerCoordinates from "../../pointerCoordinates/PointerCoordinates";
import { extractMarkdownHeadings, normalizeMarkdownHeadingText } from "./markdownHeadings";
import SnippetDocumentToc from "./SnippetDocumentToc";
import SnippetMarkdown from "./SnippetMarkdown";
import {
  getSnippetDisplayPath,
  getSnippetDocumentRoute,
  SNIPPETS_ROOT_PATH,
} from "./snippetRoutes";
import "./SnippetDocument.css";

type SnippetDocumentMetadata = {
  id: number;
  name: string;
  type: "file";
  modified: string;
  size: number;
  format: "pdf" | "md";
  path_segments: string[];
};

const apiUrl = import.meta.env.VITE_API_URL;

async function fetchDocumentMetadata(id: number): Promise<SnippetDocumentMetadata> {
  const response = await fetch(`${apiUrl}/v2/snippets/${id}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Snippet document not found");
  }

  const payload = (await response.json()) as { data: SnippetDocumentMetadata };
  return payload.data;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatBytes(bytes: number) {
  if (!bytes) return "—";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function SnippetDocumentContentLoading({ format }: { format?: "pdf" | "md" }) {
  const isPdf = format === "pdf";

  return (
    <LoadingRegion
      className={
        isPdf
          ? "snippet-document-content-loading snippet-document-content-loading-pdf"
          : "snippet-document-content-loading"
      }
      label={isPdf ? "Preparing PDF document" : "Preparing document content"}
    >
      <LoadingBlock />
      <LoadingBlock />
      <LoadingBlock />
      <LoadingBlock />
    </LoadingRegion>
  );
}

function SnippetDocumentLoadingShell() {
  return (
    <LoadingRegion className="snippet-document-loading" label="Preparing document">
      <header className="snippet-document-loading-header">
        <div>
          <LoadingBlock />
          <LoadingBlock />
          <LoadingBlock />
        </div>
        <div className="snippet-document-loading-actions">
          <LoadingBlock />
          <LoadingBlock />
        </div>
      </header>
      <div className="snippet-document-loading-meta">
        <LoadingBlock />
        <LoadingBlock />
        <LoadingBlock />
      </div>
      <div className="snippet-document-loading-reading">
        <LoadingBlock />
        <LoadingBlock />
        <LoadingBlock />
        <LoadingBlock />
      </div>
    </LoadingRegion>
  );
}

export default function SnippetDocument() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const numericId = Number(routeId);
  const hasValidId = Number.isSafeInteger(numericId) && numericId > 0;

  const metadataQuery = useQuery({
    queryKey: ["snippet-document", numericId],
    queryFn: () => fetchDocumentMetadata(numericId),
    enabled: hasValidId,
    staleTime: 60_000,
  });

  const metadata = metadataQuery.data;
  const canonicalPath = metadata ? getSnippetDocumentRoute(metadata.id, metadata.name) : null;
  const canonicalUrl = canonicalPath ? `https://syn-forge.com${canonicalPath}` : undefined;
  const displayPath = metadata
    ? getSnippetDisplayPath(metadata.path_segments)
    : `${SNIPPETS_ROOT_PATH}/document/`;
  const [content, setContent] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);

  useEffect(() => {
    if (!canonicalPath || window.location.pathname === canonicalPath) return;
    navigate(canonicalPath, { replace: true });
  }, [canonicalPath, navigate]);

  useEffect(() => {
    if (!metadata) return;

    const controller = new AbortController();
    let objectUrl: string | null = null;

    setContent(null);
    setFileUrl(null);
    setContentError(null);

    fetch(`${apiUrl}/v2/snippets/${metadata.id}/content`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Snippet content could not be loaded");
        }

        if (metadata.format === "pdf") {
          const blob = await response.blob();
          objectUrl = URL.createObjectURL(blob);
          setFileUrl(objectUrl);
          return;
        }

        setContent(await response.text());
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setContentError(
          error instanceof Error ? error.message : "Snippet content could not be loaded",
        );
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [metadata]);

  const structuredData = useMemo(() => {
    if (!metadata || !canonicalUrl) return undefined;

    return {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: metadata.name,
      dateModified: metadata.modified,
      encodingFormat: metadata.format === "md" ? "text/markdown" : "application/pdf",
      url: canonicalUrl,
      isPartOf: {
        "@type": "CollectionPage",
        name: "Code Snippets",
        url: "https://syn-forge.com/snippets/",
      },
    };
  }, [canonicalUrl, metadata]);

  const pageTitle = metadata?.name || "Snippet document";
  const pageDescription = metadata
    ? `Read ${metadata.name} from the Syn-Forge code snippets archive.`
    : "Read a Syn-Forge code snippet document.";

  const markdownHeadings = useMemo(
    () => (metadata?.format === "md" && content !== null ? extractMarkdownHeadings(content) : []),
    [content, metadata?.format],
  );
  const tableOfContentsHeadings = markdownHeadings.filter((heading) => heading.level >= 2);
  const headingIdsByText = useMemo(
    () =>
      Object.fromEntries(
        markdownHeadings.map((heading) => [
          normalizeMarkdownHeadingText(heading.label),
          heading.id,
        ]),
      ),
    [markdownHeadings],
  );

  const handleDownload = () => {
    if (!metadata) return;

    const anchor = document.createElement("a");
    anchor.href = `${apiUrl}/snippets/${metadata.id}/content`;
    anchor.download = metadata.name;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const isNotFound = !hasValidId || metadataQuery.isError;
  const isLoading = hasValidId && metadataQuery.isLoading;

  return (
    <>
      <GlobalHeadManager
        title={pageTitle}
        description={pageDescription}
        image="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png"
        url={canonicalUrl}
        robots={isNotFound ? "noindex, nofollow" : "index, follow"}
        jsonLd={structuredData}
      />

      <CookingArea>
        <main aria-labelledby="snippet-document-title" className="snippet-document-page">
          <div className="snippet-document-shell">
            <PointerCoordinates
              activeSection={0}
              className="snippet-document-coordinates"
              markerCount={1}
            />

            {isLoading ? (
              <SnippetDocumentLoadingShell />
            ) : isNotFound ? (
              <div className="snippet-document-state snippet-document-error" role="alert">
                <FileCode2 aria-hidden="true" size={38} />
                <h1 id="snippet-document-title">Snippet not found</h1>
                <p>This document is no longer available at this address.</p>
                <Link className="snippet-document-link" to={`${SNIPPETS_ROOT_PATH}/`}>
                  <ArrowLeft aria-hidden="true" size={17} />
                  Back to snippets
                </Link>
              </div>
            ) : metadata ? (
              <>
                <header className="snippet-document-header">
                  <div>
                    <p className="snippet-document-kicker">
                      {metadata.format.toUpperCase()} / DOCUMENT
                    </p>
                    <h1 id="snippet-document-title">{metadata.name}</h1>
                    <p className="snippet-document-path">{displayPath}</p>
                  </div>
                  <div className="snippet-document-actions">
                    <Link className="snippet-document-link secondary" to={`${SNIPPETS_ROOT_PATH}/`}>
                      <ArrowLeft aria-hidden="true" size={17} />
                      Back to index
                    </Link>
                    <button
                      className="snippet-document-link"
                      onClick={handleDownload}
                      type="button"
                    >
                      <Download aria-hidden="true" size={17} />
                      Download
                    </button>
                  </div>
                </header>

                <div className="snippet-document-meta">
                  <span>
                    <span className="snippet-document-meta-label">Modified</span>
                    {formatDate(metadata.modified)}
                  </span>
                  <span>
                    <span className="snippet-document-meta-label">Size</span>
                    {formatBytes(metadata.size)}
                  </span>
                  <span>
                    <span className="snippet-document-meta-label">Path</span>
                    {metadata.path_segments.join(" / ")}
                  </span>
                </div>

                {contentError ? (
                  <div className="snippet-document-state snippet-document-error" role="alert">
                    <p>{contentError}</p>
                  </div>
                ) : metadata.format === "pdf" && fileUrl ? (
                  <div className="snippet-document-content snippet-document-media-content">
                    <iframe className="snippet-document-pdf" src={fileUrl} title={metadata.name} />
                  </div>
                ) : content !== null ? (
                  <div
                    className={
                      tableOfContentsHeadings.length > 0
                        ? "snippet-document-reading has-toc"
                        : "snippet-document-reading"
                    }
                  >
                    {tableOfContentsHeadings.length > 0 && (
                      <SnippetDocumentToc headings={tableOfContentsHeadings} />
                    )}
                    <article
                      aria-label="Markdown document content"
                      className="snippet-document-content"
                    >
                      <SnippetMarkdown
                        className="markdown-body-container snippet-document-markdown"
                        content={content}
                        headingIdsByText={headingIdsByText}
                        resetKey={`${metadata.name}-${content.length}`}
                      />
                    </article>
                  </div>
                ) : (
                  <SnippetDocumentContentLoading format={metadata.format} />
                )}
              </>
            ) : null}
          </div>
        </main>
      </CookingArea>
    </>
  );
}
