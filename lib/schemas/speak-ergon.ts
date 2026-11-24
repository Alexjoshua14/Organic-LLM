import { z } from "zod";

/** Read-only workspace queries; no model-supplied tool names or credentials. */
export const SpeakErgonReadSchema = z
  .object({
    action: z.enum([
      "list_projects",
      "get_project",
      "list_issues",
      "get_issue",
      "list_documents",
      "get_document",
      "get_clause",
    ]),
    query: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe("Project name/search, or full-text search for list_documents; required for get_project"),
    project: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe("Required for list_issues; optional project slug for list_documents"),
    id: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe("Required for get_issue, get_document, or get_clause (clause ref)"),
    cursor: z.string().max(500).optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    const required = {
      list_projects: null,
      get_project: "query",
      list_issues: "project",
      get_issue: "id",
      list_documents: null,
      get_document: "id",
      get_clause: "id",
    } as const;
    const field = required[input.action];

    if (field && !input[field])
      ctx.addIssue({ code: "custom", path: [field], message: `${field} is required` });
  });
