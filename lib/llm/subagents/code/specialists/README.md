# Code Specialists (Layer 2) — Thoughts

> The niche experts that the Code Agent (L1) orchestrates.

---

## Grouping Strategy

<!-- 
  Current groupings:
    - Source Control (GitHub + local git) — grouped because they're both VCS
    - Local Files (read/search/diff) — separate from git because it's non-VCS file ops
    - Architect (system design, patterns)
    - Diagrams (Mermaid, PlantUML)
    - Security (OWASP, CVEs, secrets)
    - Accessibility (WCAG, ARIA)

  Do these groupings make sense? Too many? Too few?
  Should architect + diagrams merge? (architecture often produces diagrams)
  Should security + a11y merge into a "code quality" agent?
-->


## Priority Order

<!-- Which specialists to build first? What's the highest-value, lowest-effort one? -->


## Quality Bars

<!-- 
  What does "good enough" look like for each specialist?
  Which ones need to be near-perfect (security) vs. "helpful but okay to be approximate" (diagrams)?
-->


## GitHub Agent — Specifics

<!-- 
  Auth strategy: PAT? OAuth app? GitHub App?
  Scope: just your repos? Any public repo? Organizations?
  API: REST vs GraphQL vs both?
  Rate limiting concerns?
-->


## Local Files Agent — Specifics

<!-- 
  Sandboxing: which directories are allowed?
  How does the user configure their "project root"?
  File size limits? Binary file handling?
  Integration with the existing project context (.context/ directory)?
-->


## Architect Agent — Specifics

<!-- 
  How opinionated should it be? (prescriptive vs. presenting trade-offs)
  Does it know about the user's stack? (Next.js, Supabase, etc. — from organic state?)
  Should it generate ADRs automatically?
-->


## Diagrams Agent — Specifics

<!-- 
  Output format: Mermaid only? PlantUML? ASCII? SVG?
  Does the frontend already render Mermaid? (check rabbit-hole rendering)
  Should it edit existing diagrams or only generate new ones?
-->


## Security Agent — Specifics

<!-- 
  Static analysis only, or can it check running services?
  Dependency scanning: npm audit? Snyk? Advisory DBs?
  How to handle false positives without crying wolf?
-->


## Accessibility Agent — Specifics

<!-- 
  Operates on code (JSX/HTML) or on rendered output (axe-core)?
  WCAG level target: A, AA, or AAA?
  Integration with existing component library (Radix, HeroUI)?
-->


## Specialists Not Yet Considered

<!-- 
  Testing agent? (generate unit/integration tests)
  Performance agent? (profiling, bundle analysis, lighthouse)
  Documentation agent? (generate JSDoc, API docs, changelogs)
  DevOps / CI-CD agent? (Dockerfile, GitHub Actions, deployment)
  Database agent? (SQL, migrations, query optimization — ties into Supabase)
-->

