import { describe, expect, test } from "bun:test";

import { extractReadableText } from "@/lib/security/external-content/extract-text";

describe("extractReadableText", () => {
  test("strips script and style from html", () => {
    const html =
      "<html><head><style>body{color:red}</style></head><body><script>alert(1)</script><p>Visible</p></body></html>";
    const { text } = extractReadableText(html, { contentType: "text/html" });

    expect(text).toContain("Visible");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
  });

  test("strips control and zero-width characters", () => {
    const input = "Hello\u200b\u0007World";
    const { text } = extractReadableText(input, { contentType: "text/plain" });

    expect(text).toBe("HelloWorld");
  });

  test("caps length", () => {
    const input = "a".repeat(100);
    const { text, truncated } = extractReadableText(input, {
      contentType: "text/plain",
      maxChars: 20,
    });

    expect(text.length).toBe(20);
    expect(truncated).toBe(true);
  });
});
