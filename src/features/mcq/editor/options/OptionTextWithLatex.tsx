import clsx from "clsx";
import katex from "katex";
import type { CSSProperties, ReactNode } from "react";
import type { OptionsBlock } from "../types";

export function OptionTextWithLatex({ block, text }: { block: OptionsBlock; text: string }) {
  const math = block.settings.inheritMathFont ? block.settings.text : block.settings.math;
  const mathStyle: CSSProperties = {
    fontFamily: math.fontFamily,
    fontSize: `${math.fontSize}pt`,
    fontWeight: math.bold ? 700 : 400,
    fontStyle: math.italic ? "italic" : "normal",
    textDecoration: math.underline ? "underline" : "none",
    verticalAlign: math.superscript ? "super" : math.subscript ? "sub" : "baseline"
  };

  return <>{renderInline(text, block, mathStyle)}</>;
}

function renderInline(text: string, block: OptionsBlock, mathStyle: CSSProperties): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\$[^$]+\$|<(b|i|u|sub|sup)>.*?<\/\2>)/gis;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));

    const token = match[0];
    if (token.startsWith("$") && token.endsWith("$")) {
      nodes.push(renderLatex(token.slice(1, -1), block, mathStyle, nodes.length));
    } else {
      const tag = match[2].toLowerCase();
      const inner = token.replace(new RegExp(`^<${tag}>|</${tag}>$`, "gi"), "");
      const children = renderInline(inner, block, mathStyle);
      const key = `${tag}-${nodes.length}`;
      if (tag === "b") nodes.push(<strong key={key}>{children}</strong>);
      if (tag === "i") nodes.push(<em key={key}>{children}</em>);
      if (tag === "u") nodes.push(<u key={key}>{children}</u>);
      if (tag === "sub") nodes.push(<sub key={key}>{children}</sub>);
      if (tag === "sup") nodes.push(<sup key={key}>{children}</sup>);
    }

    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function renderLatex(source: string, block: OptionsBlock, mathStyle: CSSProperties, key: number) {
  const html = katex.renderToString(source, { throwOnError: false, output: "html" });
  const math = block.settings.inheritMathFont ? block.settings.text : block.settings.math;

  return (
    <span
      className={clsx("mcq-inline-latex-token", math.bold && "is-bold", math.italic && "is-italic", math.underline && "is-underlined")}
      key={`option-latex-${key}`}
      style={mathStyle}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
