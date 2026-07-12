import { describe, it, expect } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

describe("safe markdown renderer", () => {
  it("escapes raw HTML (no injection)", () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders headings, bold and lists", () => {
    expect(renderMarkdown("# Título")).toContain("<h1");
    expect(renderMarkdown("**negrita**")).toContain("<strong>negrita</strong>");
    const list = renderMarkdown("- uno\n- dos");
    expect(list).toContain("<ul");
    expect((list.match(/<li>/g) || []).length).toBe(2);
  });

  it("allows safe links/images but blocks javascript: URLs", () => {
    expect(renderMarkdown("[x](https://a.test)")).toContain('href="https://a.test"');
    expect(renderMarkdown("![i](/api/manual/media/1)")).toContain('src="/api/manual/media/1"');
    const evil = renderMarkdown("[x](javascript:alert(1))");
    expect(evil).not.toContain("javascript:");
    expect(evil).not.toContain("<a ");
  });
});
