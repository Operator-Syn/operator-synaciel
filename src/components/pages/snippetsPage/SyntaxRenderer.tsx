import type { ComponentPropsWithoutRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

type SyntaxHighlighterProps = ComponentPropsWithoutRef<typeof SyntaxHighlighter>;

interface SyntaxRendererProps extends Omit<SyntaxHighlighterProps, "language" | "children"> {
  language: string;
  codeString: string;
}

export default function SyntaxRenderer({ language, codeString, ...props }: SyntaxRendererProps) {
  return (
    <SyntaxHighlighter
      className="snippet-code-highlighter"
      style={vscDarkPlus}
      language={language}
      PreTag="div"
      wrapLongLines={false}
      useInlineStyles={true}
      customStyle={{
        margin: 0,
        padding: "1.25rem",
        fontSize: "13px",
        lineHeight: 1.65,
        overflowX: "auto",
        background: "#1e1e1e",
        whiteSpace: "pre",
        wordBreak: "normal",
        overflowWrap: "normal",
      }}
      {...props}
    >
      {codeString}
    </SyntaxHighlighter>
  );
}
