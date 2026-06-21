type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
};

function parseDesc(raw: string): TiptapNode[] | null {
  const body = raw.startsWith("[v2]") ? raw.slice(4) : raw;
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed) ? (parsed as TiptapNode[]) : null;
  } catch {
    return null;
  }
}

function applyMarks(text: string, marks: TiptapNode["marks"]): string {
  if (!marks) return text;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        text = `**${text}**`;
        break;
      case "italic":
        text = `_${text}_`;
        break;
      case "code":
        text = `\`${text}\``;
        break;
      case "strike":
        text = `~~${text}~~`;
        break;
      case "link": {
        const href = (mark.attrs?.href as string) ?? "";
        text = `[${text}](${href})`;
        break;
      }
    }
  }
  return text;
}

function inlineContent(nodes: TiptapNode[]): string {
  return nodes.map((n) => {
    if (n.type === "text") return applyMarks(n.text ?? "", n.marks);
    if (n.type === "hardBreak") return "\n";
    if (n.content) return inlineContent(n.content);
    return "";
  }).join("");
}

function nodeToMarkdown(node: TiptapNode): string {
  switch (node.type) {
    case "text":
      return applyMarks(node.text ?? "", node.marks);

    case "paragraph": {
      const inner = inlineContent(node.content ?? []);
      return inner ? `${inner}\n\n` : "\n";
    }

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const inner = inlineContent(node.content ?? []);
      return `${"#".repeat(level)} ${inner}\n\n`;
    }

    case "bulletList":
      return (node.content ?? []).map((item) => {
        const inner = inlineContent(
          (item.content ?? []).flatMap((n) =>
            n.type === "paragraph" ? (n.content ?? []) : [n],
          ),
        ).trimEnd();
        return `- ${inner}\n`;
      }).join("") + "\n";

    case "orderedList":
      return (node.content ?? []).map((item, i) => {
        const inner = inlineContent(
          (item.content ?? []).flatMap((n) =>
            n.type === "paragraph" ? (n.content ?? []) : [n],
          ),
        ).trimEnd();
        return `${i + 1}. ${inner}\n`;
      }).join("") + "\n";

    case "blockquote": {
      const inner = (node.content ?? []).map(nodeToMarkdown).join("").trimEnd();
      return inner.split("\n").map((line) => `> ${line}`).join("\n") + "\n\n";
    }

    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const inner = (node.content ?? []).map((n) => n.text ?? "").join("");
      return `\`\`\`${lang}\n${inner}\n\`\`\`\n\n`;
    }

    case "hardBreak":
      return "\n";

    case "horizontalRule":
      return "---\n\n";

    case "image": {
      const src = (node.attrs?.src as string) ?? "";
      const alt = (node.attrs?.alt as string) ?? "";
      return `![${alt}](${src})\n\n`;
    }

    default:
      return (node.content ?? []).map(nodeToMarkdown).join("");
  }
}

export function tiptapToMarkdown(raw: string): string {
  if (!raw) return "";
  const nodes = parseDesc(raw);
  if (!nodes) return raw;
  return nodes.map(nodeToMarkdown).join("").trimEnd();
}
