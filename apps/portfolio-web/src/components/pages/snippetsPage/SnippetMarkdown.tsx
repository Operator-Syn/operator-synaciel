import { Component, type ComponentPropsWithoutRef, lazy, Suspense, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { LoadingBlock, LoadingRegion } from "../../loadingState/LoadingState";
import { markdownNodeToText, normalizeMarkdownHeadingText } from "./markdownHeadings";

import "./Snippets.css";

const SyntaxRenderer = lazy(() => import("./SyntaxRenderer"));

type MarkdownErrorBoundaryProps = {
  resetKey: string;
  children: React.ReactNode;
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
        <div className="snippets-markdown-error">
          <strong>This Markdown file could not be rendered.</strong>
          <span>
            {this.state.message || "The file may contain unsupported Markdown or code syntax."}
          </span>
          <span>You can still use the Download button to inspect the raw file.</span>
        </div>
      );
    }

    return this.props.children;
  }
}

function createSafeCodeBlockId(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return `code-${Math.abs(hash).toString(36)}-${value.length}`;
}

type SnippetMarkdownProps = {
  className?: string;
  content: string;
  headingIdsByText?: Record<string, string>;
  resetKey?: string;
};

export default function SnippetMarkdown({
  className = "markdown-body-container",
  content,
  headingIdsByText,
  resetKey = content,
}: SnippetMarkdownProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const renderHeading = (level: 1 | 2 | 3 | 4 | 5 | 6, props: ComponentPropsWithoutRef<"h1">) => {
    const Heading = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    const { children, ...headingProps } = props;
    const headingText = normalizeMarkdownHeadingText(markdownNodeToText(children));
    const headingId = headingIdsByText?.[headingText];

    return (
      <Heading {...headingProps} id={headingId}>
        {children}
      </Heading>
    );
  };

  const handleCopy = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <div className={className}>
      <MarkdownErrorBoundary resetKey={resetKey}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: (props) => renderHeading(1, props),
            h2: (props) => renderHeading(2, props),
            h3: (props) => renderHeading(3, props),
            h4: (props) => renderHeading(4, props),
            h5: (props) => renderHeading(5, props),
            h6: (props) => renderHeading(6, props),
            code({
              className: codeClassName,
              children,
              ...props
            }: ComponentPropsWithoutRef<"code">) {
              const rawCode = String(children ?? "");
              const codeString = rawCode.replace(/\n$/, "");
              const match = /language-([\w-]+)/.exec(codeClassName || "");
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
                  <div className="code-header">
                    <span className="font-mono text-meta text-text-muted">
                      {language.toUpperCase()}
                    </span>
                    <button
                      className={
                        copiedId === blockId
                          ? "action-quiet min-h-9 px-3 border-success text-success"
                          : "action-quiet min-h-9 px-3"
                      }
                      data-cursor="copy"
                      onClick={() => void handleCopy(codeString, blockId)}
                      type="button"
                    >
                      {copiedId === blockId ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <Suspense
                    fallback={
                      <LoadingRegion
                        className="snippets-syntax-loading"
                        label="Preparing syntax highlighting"
                      >
                        <LoadingBlock />
                      </LoadingRegion>
                    }
                  >
                    <SyntaxRenderer language={language} codeString={codeString} />
                  </Suspense>
                </div>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </MarkdownErrorBoundary>
    </div>
  );
}
