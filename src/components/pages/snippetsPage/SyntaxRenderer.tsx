import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface SyntaxRendererProps {
  language: string;
  codeString: string;
  [key: string]: any;
}

export default function SyntaxRenderer({ language, codeString, ...props }: SyntaxRendererProps) {
  return (
    <SyntaxHighlighter
      style={vscDarkPlus}
      language={language}
      PreTag="div"
      useInlineStyles={true}
      customStyle={{
        margin: 0,
        padding: "1.25rem",
        fontSize: "13px",
        overflowX: "auto",
        background: "#1e1e1e",
      }}
      {...props}
    >
      {codeString}
    </SyntaxHighlighter>
  );
}