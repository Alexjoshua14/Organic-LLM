import { describe, expect, test } from "bun:test";

import {
  redactPII,
  redactUIMessages,
  isClientPIIRedactionEnabled,
  isRedactPIIInMemoryEnabled,
  type UIMessageLike,
} from "@/lib/pii/redact";

describe("redactPII", () => {
  test("returns empty string unchanged", () => {
    expect(redactPII("")).toBe("");
  });

  test("returns non-string input unchanged", () => {
    // Runtime guard returns falsy/non-string input unchanged; signature is string for type safety
    // @ts-expect-error - intentional invalid arg to assert runtime behavior
    expect(redactPII(null)).toBe(null);
    // @ts-expect-error - intentional invalid arg to assert runtime behavior
    expect(redactPII(undefined)).toBe(undefined);
  });

  test("leaves text with no PII unchanged", () => {
    expect(redactPII("Hello world")).toBe("Hello world");
    expect(redactPII("The quick brown fox")).toBe("The quick brown fox");
  });

  test("redacts email addresses", () => {
    expect(redactPII("Contact me at alice@example.com")).toBe(
      "Contact me at [EMAIL]",
    );
    expect(redactPII("a+b@test.co.uk")).toBe("[EMAIL]");
    expect(redactPII("user.name+tag@domain.org")).toBe("[EMAIL]");
  });

  test("redacts US SSN formats", () => {
    expect(redactPII("SSN: 123-45-6789")).toBe("SSN: [SSN]");
    expect(redactPII("123 45 6789")).toBe("[SSN]");
    expect(redactPII("123456789")).toBe("[SSN]");
  });

  test("redacts credit card-like numbers (4 groups of 4)", () => {
    expect(redactPII("Card 4111-1111-1111-1111")).toBe("Card [CARD]");
    expect(redactPII("4111 1111 1111 1111")).toBe("[CARD]");
    expect(redactPII("4111111111111111")).toBe("[CARD]");
  });

  test("redacts US/NA phone numbers", () => {
    expect(redactPII("Call 555-123-4567")).toBe("Call [PHONE]");
    expect(redactPII("(555) 123-4567")).toBe("[PHONE]");
    expect(redactPII("+1 555 123 4567")).toBe("[PHONE]");
    expect(redactPII("+1-555-123-4567")).toBe("[PHONE]");
  });

  test("redacts multiple PII types in one string", () => {
    const input =
      "Email alice@test.com, SSN 123-45-6789, call 555-123-4567 for help.";
    const out = redactPII(input);
    expect(out.includes("[EMAIL]")).toBe(true);
    expect(out.includes("[SSN]")).toBe(true);
    expect(out.includes("[PHONE]")).toBe(true);
    expect(out.includes("alice@test.com")).toBe(false);
    expect(out.includes("123-45-6789")).toBe(false);
    expect(out.includes("555-123-4567")).toBe(false);
  });

  test("does not mutate short digit sequences that are not SSN/card/phone", () => {
    expect(redactPII("Room 42")).toBe("Room 42");
    expect(redactPII("Zip 12345")).toBe("Zip 12345");
  });

  test("leaves whitespace-only string unchanged", () => {
    expect(redactPII("   ")).toBe("   ");
    expect(redactPII("\n\t")).toBe("\n\t");
  });

  test("redacts PII at start and end of string", () => {
    expect(redactPII("alice@test.com wrote:")).toBe("[EMAIL] wrote:");
    expect(redactPII("Call me at 555-123-4567")).toBe("Call me at [PHONE]");
    expect(redactPII("End with 123-45-6789")).toBe("End with [SSN]");
  });

  test("redacts multiple occurrences of same PII type", () => {
    const out = redactPII("Email a@b.com and c@d.co for the list.");
    expect(out).toBe("Email [EMAIL] and [EMAIL] for the list.");
  });

  test("redacts PII with newlines and surrounding whitespace", () => {
    expect(redactPII("Contact:\nalice@example.com\nThanks")).toBe(
      "Contact:\n[EMAIL]\nThanks",
    );
    expect(redactPII("  (555) 123-4567  ")).toBe("  [PHONE]  ");
  });

  test("redacts email case-insensitively", () => {
    expect(redactPII("ALICE@EXAMPLE.COM")).toBe("[EMAIL]");
    expect(redactPII("MixEd@DoMaIn.Org")).toBe("[EMAIL]");
  });

  test("leaves placeholder-like text unchanged (no double-redaction)", () => {
    expect(redactPII("[EMAIL]")).toBe("[EMAIL]");
    expect(redactPII("Something [PHONE] here")).toBe("Something [PHONE] here");
  });

  test("redacts adjacent PII without space between", () => {
    const out = redactPII("Send to alice@a.com or 555-111-2222");
    expect(out.includes("[EMAIL]")).toBe(true);
    expect(out.includes("[PHONE]")).toBe(true);
    expect(out.includes("alice@a.com")).toBe(false);
    expect(out.includes("555-111-2222")).toBe(false);
  });

  test("redacts email with subdomain", () => {
    expect(redactPII("user@mail.example.com")).toBe("[EMAIL]");
    expect(redactPII("a@b.c.co")).toBe("[EMAIL]");
  });

  test("redacts phone with dots as separators", () => {
    expect(redactPII("555.123.4567")).toBe("[PHONE]");
  });

  test("handles long string with many PII occurrences", () => {
    const emails = Array(10).fill("x@y.com").join(" ");
    const out = redactPII(emails);
    expect(out.includes("x@y.com")).toBe(false);
    expect(out.split("[EMAIL]").length).toBe(11);
  });

  test("preserves Unicode and non-ASCII around PII", () => {
    expect(redactPII("Contact José at jose@example.com")).toBe(
      "Contact José at [EMAIL]",
    );
    expect(redactPII("我的邮箱 me@test.com 谢谢").includes("[EMAIL]")).toBe(
      true,
    );
  });

  test("redacts 9-digit sequence matching SSN pattern even with surrounding words", () => {
    // Any 9 digits in SSN form are redacted; no semantic "ID vs SSN" distinction
    expect(redactPII("Reference 123456789 only")).toBe("Reference [SSN] only");
  });
});

describe("redactUIMessages", () => {
  test("returns new array and does not mutate original messages", () => {
    const msg: UIMessageLike = {
      role: "user",
      parts: [{ type: "text", text: "Email me at foo@bar.com" }],
    };
    const original = [msg];
    const result = redactUIMessages(original);

    expect(result === original).toBe(false);
    expect(result[0] === original[0]).toBe(false);
    const origText: string = (original[0].parts![0] as { text: string }).text;
    const resultText: string = (result[0].parts![0] as { text: string }).text;
    expect(resultText === "Email me at [EMAIL]").toBe(true);
  });

  test("redacts text in parts", () => {
    const messages: UIMessageLike[] = [
      {
        role: "user",
        parts: [
          { type: "text", text: "My SSN is 123-45-6789" },
          { type: "text", text: "Call 555-999-0000" },
        ],
      },
    ];
    const result = redactUIMessages(messages);

    expect((result[0].parts![0] as { text: string }).text).toBe(
      "My SSN is [SSN]",
    );
    expect((result[0].parts![1] as { text: string }).text).toBe("Call [PHONE]");
  });

  test("redacts legacy content string", () => {
    const messages: UIMessageLike[] = [
      { role: "user", content: "Contact: alice@example.com" },
    ];
    const result = redactUIMessages(messages);

    expect(result[0].content).toBe("Contact: [EMAIL]");
  });

  test("preserves non-text parts unchanged", () => {
    const messages: UIMessageLike[] = [
      {
        role: "user",
        parts: [
          { type: "text", text: "foo@bar.com" },
          { type: "tool-invocation", toolName: "search", state: "call" },
        ],
      },
    ];
    const result = redactUIMessages(messages);

    expect((result[0].parts![0] as { text: string }).text).toBe("[EMAIL]");
    const part1 = result[0].parts![1] as { type: string; toolName: string; state: string };
    expect(part1.type).toBe("tool-invocation");
    expect(part1.toolName).toBe("search");
    expect(part1.state).toBe("call");
  });

  test("handles empty parts", () => {
    const messages: UIMessageLike[] = [{ role: "user", parts: [] }];
    const result = redactUIMessages(messages);
    expect(result).toHaveLength(1);
    expect((result[0].parts?.length ?? 0) === 0).toBe(true);
  });

  test("handles empty messages array", () => {
    expect(redactUIMessages([]).length).toBe(0);
  });

  test("redacts both parts and content when both present", () => {
    const messages: UIMessageLike[] = [
      {
        role: "user",
        parts: [{ type: "text", text: "Parts: foo@bar.com" }],
        content: "Content: alice@example.com",
      },
    ];
    const result = redactUIMessages(messages);
    expect((result[0].parts![0] as { text: string }).text).toBe(
      "Parts: [EMAIL]",
    );
    expect(result[0].content).toBe("Content: [EMAIL]");
  });

  test("preserves extra message properties (id, role, etc.)", () => {
    type MessageWithExtras = UIMessageLike & { id?: string; createdAt?: number };
    const messages: MessageWithExtras[] = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "hi" }],
        createdAt: 12345,
      },
    ];
    const result = redactUIMessages(messages);
    const first = result[0] as MessageWithExtras;
    expect(first.id === "msg-1").toBe(true);
    expect(first.role).toBe("user");
    expect(first.createdAt === 12345).toBe(true);
  });

  test("handles text part with empty string", () => {
    const messages: UIMessageLike[] = [
      { role: "user", parts: [{ type: "text", text: "" }] },
    ];
    const result = redactUIMessages(messages);
    expect((result[0].parts![0] as { text: string }).text).toBe("");
  });

  test("handles text part with undefined text (no throw)", () => {
    const messages: UIMessageLike[] = [
      { role: "user", parts: [{ type: "text" }] },
    ];
    const result = redactUIMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].parts).toHaveLength(1);
  });

  test("multiple messages: only messages with PII are redacted", () => {
    const messages: UIMessageLike[] = [
      { role: "user", parts: [{ type: "text", text: "No PII here" }] },
      { role: "user", parts: [{ type: "text", text: "Email me at x@y.com" }] },
      { role: "assistant", parts: [{ type: "text", text: "Sure thing" }] },
    ];
    const result = redactUIMessages(messages);
    expect((result[0].parts![0] as { text: string }).text).toBe("No PII here");
    expect((result[1].parts![0] as { text: string }).text).toBe(
      "Email me at [EMAIL]",
    );
    expect((result[2].parts![0] as { text: string }).text).toBe("Sure thing");
  });

  test("message with only content (no parts) redacts content", () => {
    const messages: UIMessageLike[] = [
      { role: "user", content: "Just content 555-123-4567" },
    ];
    const result = redactUIMessages(messages);
    expect(result[0].content).toBe("Just content [PHONE]");
  });

  test("message with only non-text parts leaves message intact", () => {
    const messages: UIMessageLike[] = [
      {
        role: "user",
        parts: [{ type: "tool-invocation", toolName: "x", state: "call" }],
      },
    ];
    const result = redactUIMessages(messages);
    expect(result[0].parts).toHaveLength(1);
    expect((result[0].parts![0] as { type: string }).type).toBe(
      "tool-invocation",
    );
  });
});

describe("isClientPIIRedactionEnabled", () => {
  const key = "NEXT_PUBLIC_REDACT_PII";

  test("returns true when env is unset (default on)", () => {
    const orig = process.env[key];
    delete process.env[key];
    expect(isClientPIIRedactionEnabled()).toBe(true);
    if (orig !== undefined) process.env[key] = orig;
  });

  test("returns true when env is not 'false'", () => {
    const orig = process.env[key];
    process.env[key] = "true";
    expect(isClientPIIRedactionEnabled()).toBe(true);
    process.env[key] = "1";
    expect(isClientPIIRedactionEnabled()).toBe(true);
    if (orig !== undefined) process.env[key] = orig;
    else delete process.env[key];
  });

  test("returns false when env is 'false'", () => {
    const orig = process.env[key];
    process.env[key] = "false";
    expect(isClientPIIRedactionEnabled()).toBe(false);
    if (orig !== undefined) process.env[key] = orig;
    else delete process.env[key];
  });

  test("returns true for empty string or 'False' (exact 'false' required to disable)", () => {
    const orig = process.env[key];
    process.env[key] = "";
    expect(isClientPIIRedactionEnabled()).toBe(true);
    process.env[key] = "False";
    expect(isClientPIIRedactionEnabled()).toBe(true);
    if (orig !== undefined) process.env[key] = orig;
    else delete process.env[key];
  });
});

describe("isRedactPIIInMemoryEnabled", () => {
  const key = "REDACT_PII_IN_MEMORY";

  test("returns true when env is unset (default on)", () => {
    const orig = process.env[key];
    delete process.env[key];
    expect(isRedactPIIInMemoryEnabled()).toBe(true);
    if (orig !== undefined) process.env[key] = orig;
  });

  test("returns true when env is 'true'", () => {
    const orig = process.env[key];
    process.env[key] = "true";
    expect(isRedactPIIInMemoryEnabled()).toBe(true);
    if (orig !== undefined) process.env[key] = orig;
    else delete process.env[key];
  });

  test("returns false when env is 'false'", () => {
    const orig = process.env[key];
    process.env[key] = "false";
    expect(isRedactPIIInMemoryEnabled()).toBe(false);
    if (orig !== undefined) process.env[key] = orig;
    else delete process.env[key];
  });

  test("returns true for empty string (exact 'false' required to disable)", () => {
    const orig = process.env[key];
    process.env[key] = "";
    expect(isRedactPIIInMemoryEnabled()).toBe(true);
    if (orig !== undefined) process.env[key] = orig;
    else delete process.env[key];
  });
});
