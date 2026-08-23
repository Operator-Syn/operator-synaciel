import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

type SyntaxHighlighterProps = ComponentPropsWithoutRef<typeof SyntaxHighlighter>;

interface SyntaxRendererProps extends Omit<SyntaxHighlighterProps, "language" | "children"> {
  language: string;
  codeString: string;
}

const defaultCodeTagStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.82rem",
  lineHeight: 1.65,
  whiteSpace: "pre",
  wordBreak: "normal",
  overflowWrap: "normal",
};

export default function SyntaxRenderer({
  language,
  codeString,
  codeTagProps,
  ...props
}: SyntaxRendererProps) {
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
        fontSize: "0.82rem",
        lineHeight: 1.65,
        overflowX: "auto",
        background: "var(--color-canvas)",
        fontFamily: "var(--font-mono)",
        whiteSpace: "pre",
        wordBreak: "normal",
        overflowWrap: "normal",
      }}
      codeTagProps={{
        className: `language-${language}`,
        ...codeTagProps,
        style: {
          ...defaultCodeTagStyle,
          ...codeTagProps?.style,
        },
      }}
      {...props}
    >
      {codeString}
    </SyntaxHighlighter>
  );
}
