// Minimal, safe Markdown renderer for the bar manual (spec §4.6).
// Strategy: escape ALL HTML first, then re-introduce only a known set of tags.
// This makes injection impossible while supporting headings, bold/italic, lists,
// links and images (media embedding).

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/")) return u; // relative to app
  return null; // block javascript:, data:, etc.
}

function inline(text: string): string {
  let s = text;
  // Images: ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, url) => {
    const safe = safeUrl(url);
    if (!safe) return escapeHtml(alt);
    return `<img src="${safe}" alt="${alt}" class="my-2 max-w-full rounded" />`;
  });
  // Links: [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, txt, url) => {
    const safe = safeUrl(url);
    if (!safe) return txt;
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="text-madre underline">${txt}</a>`;
  });
  // Bold / italic
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return s;
}

/** Render trusted-author markdown to sanitized HTML. */
export function renderMarkdown(src: string): string {
  const escaped = escapeHtml(src);
  const lines = escaped.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) {
      closeList();
      out.push(`<h3 class="font-semibold text-base mt-3 mb-1">${inline(line.replace(/^###\s+/, ""))}</h3>`);
    } else if (/^##\s+/.test(line)) {
      closeList();
      out.push(`<h2 class="font-bold text-lg mt-4 mb-1">${inline(line.replace(/^##\s+/, ""))}</h2>`);
    } else if (/^#\s+/.test(line)) {
      closeList();
      out.push(`<h1 class="font-bold text-xl mt-4 mb-2">${inline(line.replace(/^#\s+/, ""))}</h1>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul class="list-disc pl-5 my-1 space-y-0.5">');
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      out.push(`<p class="my-1">${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}
