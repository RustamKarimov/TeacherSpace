import katex from "katex";
import clsx from "clsx";
import type { ReactNode } from "react";
import type { TextBlock } from "../types";

export function TextWithInlineLatex({ block }: { block: TextBlock }) {
  const mathStyle = {
    fontFamily: block.inlineLatex.inheritTextFont ? block.settings.fontFamily : block.inlineLatex.fontFamily,
    fontSize: `${block.inlineLatex.inheritTextFont ? block.settings.fontSize : block.inlineLatex.fontSize}pt`,
    fontWeight: block.inlineLatex.bold ? 700 : 400,
    fontStyle: block.inlineLatex.italic ? "italic" : "normal",
    textDecoration: block.inlineLatex.underline ? "underline" : "none",
    verticalAlign: block.inlineLatex.superscript ? "super" : block.inlineLatex.subscript ? "sub" : "baseline"
  };

  return <>{renderStructuredText(block.text, block, mathStyle)}</>;
}

function renderStructuredText(text: string, block: TextBlock, mathStyle: React.CSSProperties): ReactNode[] {
  const paragraphGroups = text.split(/\r?\n\s*\r?\n/);
  if (paragraphGroups.length > 1) {
    return paragraphGroups.map((paragraph, index) => (
      <div className="mcq-text-paragraph" key={`paragraph-${index}`} style={{ marginBottom: index === paragraphGroups.length - 1 ? 0 : block.settings.paragraphSpacing ?? 6 }}>
        {renderLines(paragraph, block, mathStyle)}
      </div>
    ));
  }

  return renderLines(text, block, mathStyle);
}

function renderLines(text: string, block: TextBlock, mathStyle: React.CSSProperties): ReactNode[] {
  const lines = text.split(/\r?\n/);
  const hasStructuredLines = lines.length > 1 || lines.some((line) => parseListLine(line));
  if (!hasStructuredLines) {
    return renderFormattedInline(text, block, mathStyle);
  }

  return lines.map((line, index) => {
    const parsed = parseListLine(line);
    if (parsed) {
      return (
        <div className={clsx("mcq-text-line", "is-list-line", `is-depth-${parsed.depth}`)} key={`line-${index}`}>
          <span className="mcq-text-list-marker">{parsed.marker}</span>
          <span>{renderFormattedInline(parsed.content, block, mathStyle)}</span>
        </div>
      );
    }
    return (
      <div className="mcq-text-line" key={`line-${index}`}>
        {line ? renderFormattedInline(line, block, mathStyle) : <br />}
      </div>
    );
  });
}

function parseListLine(line: string) {
  const match = line.match(/^(\s*)([-*]|\u2022|\d+[.)]|\(\d+\)|[a-zA-Z][.)]|\([a-zA-Z]\)|[ivxlcdmIVXLCDM]+[.)]|\([ivxlcdmIVXLCDM]+\))\s+(.+)$/);
  if (!match) return null;
  return {
    depth: Math.min(3, Math.floor(match[1].length / 2)),
    marker: match[2] === "-" || match[2] === "*" ? "\u2022" : match[2],
    content: match[3]
  };
}

function renderFormattedInline(text: string, block: TextBlock, mathStyle: React.CSSProperties): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\$[^$]+\$|<span data-(font|size)="([^"]+)">.*?<\/span>|<(b|i|u|sub|sup)>.*?<\/\4>)/gis;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const token = match[0];
    if (token.startsWith("$") && token.endsWith("$")) {
      nodes.push(renderLatex(token.slice(1, -1), block, mathStyle, nodes.length));
    } else if (token.startsWith("<span")) {
      const kind = match[2];
      const value = match[3];
      const inner = token.replace(/^<span data-(font|size)="[^"]+">|<\/span>$/gi, "");
      const style = kind === "font" ? { fontFamily: value } : { fontSize: `${Number(value)}pt` };
      nodes.push(
        <span key={`span-${nodes.length}`} style={style}>
          {renderFormattedInline(inner, block, mathStyle)}
        </span>
      );
    } else {
      const tag = match[4].toLowerCase();
      const inner = token.replace(new RegExp(`^<${tag}>|</${tag}>$`, "gi"), "");
      const children = renderFormattedInline(inner, block, mathStyle);
      const key = `${tag}-${nodes.length}`;

      if (tag === "b") nodes.push(<strong key={key}>{children}</strong>);
      if (tag === "i") nodes.push(<em key={key}>{children}</em>);
      if (tag === "u") nodes.push(<u key={key}>{children}</u>);
      if (tag === "sub") nodes.push(<sub key={key}>{children}</sub>);
      if (tag === "sup") nodes.push(<sup key={key}>{children}</sup>);
    }

    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function renderLatex(source: string, block: TextBlock, mathStyle: React.CSSProperties, key: number) {
  const html = katex.renderToString(source, {
    throwOnError: false,
    output: "html"
  });

  return (
    <span
      className={clsx(
        "mcq-inline-latex-token",
        block.inlineLatex.bold && "is-bold",
        block.inlineLatex.italic && "is-italic",
        block.inlineLatex.underline && "is-underlined"
      )}
      key={`latex-${key}`}
      style={mathStyle}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
