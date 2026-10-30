import type { UserConnectorsProfile } from "@/lib/schemas/user-connectors";

export type DossierField = keyof Pick<
  UserConnectorsProfile,
  "educationAndTranscripts" | "careerHistory" | "resumeText" | "workingPreferences"
>;

type DossierPromptSpec = {
  label: string;
  detail: string;
  maxChars: number;
  topics: string;
  output: string;
};

export const DOSSIER_PROMPTS = {
  educationAndTranscripts: {
    label: "education and transcripts",
    detail: "200–450 words",
    maxChars: 6_000,
    topics:
      "Schools and institutions; degrees, majors, minors, and attendance or graduation dates; relevant coursework and seminars; research, thesis, capstone, or studio work; certifications and academic distinctions. Include grades or GPA only when explicitly provided. Distinguish completed, in-progress, and planned study.",
    output: `## Education
- Institution — degree/program, field, dates, completion status.
## Coursework and training
- Subject or course — relevant skills or focus; institution/date when known.
## Research and academic work
- Project/title — topic, my contribution, methods, and outcome.
## Credentials and distinctions
- Credential/award — issuer and date when known.
## To confirm
- Missing or conflicting facts needed to complete this entry.`,
  },
  careerHistory: {
    label: "career history and projects",
    detail: "300–600 words",
    maxChars: 9_000,
    topics:
      "Employment, contracting, entrepreneurship, and substantial volunteer roles; organizations, titles, and dates; actual responsibilities and ownership; significant projects or systems built, technologies, collaborators, shipped outcomes, and explicitly supported metrics; domain expertise. Separate my own contribution from team outcomes. Distinguish professional work, personal projects, and future ambitions.",
    output: `## Career history
- Organization — role, dates, employment/project type.
  - Responsibilities, ownership, and supported outcomes.
## Selected projects and systems
- Project — purpose, timeframe, my contribution, technologies, and outcome.
## Skills and domain expertise
- Skills grounded in the roles or projects above.
## Direction and constraints
- Explicitly stated career goals or work constraints, separate from completed work.
## To confirm
- Missing or conflicting dates, ownership, or outcomes.`,
  },
  resumeText: {
    label: "resume or CV",
    detail: "400–900 words",
    maxChars: 14_000,
    topics:
      "A factual master resume suitable as grounding for later writing, not a speculative or job-targeted rewrite. Capture professional summary, reverse-chronological experience, education, selected projects, technical/domain skills, certifications, and publications or awards when supported. Preserve exact dates, titles, technologies, and verified metrics. Do not turn interests into professional skills or ambitions into accomplishments.",
    output: `## Professional summary
A short factual summary in first person.
## Experience
### Organization — role | dates
- My responsibilities and achievements, with exact metrics only when known.
## Education
- Institution — degree/program, field, dates, status.
## Selected projects
- Name — purpose, my contribution, technologies, outcome.
## Skills
- Demonstrated technical and domain skills, grouped briefly.
## Credentials, publications, and awards
- Supported entries with issuer/venue and date when known.
## To confirm
- Missing or conflicting facts required before this could be used as a resume.`,
  },
  workingPreferences: {
    label: "working and infrastructure preferences",
    detail: "150–350 words",
    maxChars: 5_000,
    topics:
      "Current workstations, operating systems, hardware constraints, servers and deployment environment; preferred languages, runtimes, frameworks, package managers, editors, and tools; architectural preferences and explicit tradeoffs; testing, review, collaboration, communication, and accessibility preferences. Separate tools I currently use from tools I want to learn. Exclude passwords, tokens, private network addresses, connection strings, and other access credentials.",
    output: `## Environment and hardware
- Current devices, operating systems, servers, and relevant constraints.
## Stack and tools
- Current languages, runtimes, frameworks, package managers, editors, and deployment tools.
## Architecture and workflow
- Explicit preferences for design, testing, reviews, and collaboration.
## Communication and constraints
- How I prefer explanations and assistance; practical constraints when stated.
## To confirm
- Outdated, conflicting, or missing preferences.`,
  },
} as const satisfies Record<DossierField, DossierPromptSpec>;

/** A static request: existing dossier contents are never added to the outbound prompt. */
export function getDossierPrompt(field: DossierField): string {
  const spec = DOSSIER_PROMPTS[field];

  return `Help me prepare the ${spec.label} section of my personal profile in Organic LLM. I will copy your entire response and paste it directly into that section.

Sources and accuracy
- Use only information about me actually available in this conversation, accessible memory, or documents I have supplied. Do not claim access to other chats or files you cannot read. Do not search for people who might be me.
- Include only stated or documented facts. Do not infer employers, qualifications, dates, grades, metrics, skills, or preferences. Keep plans separate from accomplishments.
- Prefer the most recent explicit information. Put unresolved conflicts and missing details under "To confirm" instead of guessing. If no relevant information is available, say so there.
- Do not include secrets, access credentials, or unrelated sensitive personal details.

Topics to capture
${spec.topics}

Output contract
- Return only the finished profile entry in Markdown, in my first-person voice where prose is needed.
- Use the exact headings below in order, with concise bullets. Replace each instruction/example line with known facts; write "Not provided" where a section has no supported information.
- Aim for ${spec.detail} when supported, fewer when little is known. Never pad or invent details to meet the word range. Stay under ${spec.maxChars} characters including whitespace.
- Preserve specific names, dates, roles, technologies, and supported outcomes. Prefer YYYY-MM dates when known; preserve year-only precision when that is all you have.
- No preamble, code fences, JSON, commentary about the task, advice, or follow-up questions outside the entry. The whole response must be ready to paste as-is.

${spec.output}`;
}
