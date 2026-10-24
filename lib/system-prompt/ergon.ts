/** Tool instructions appendix for the durable Ergon todo tool (`manage_tasks`). */
export const MANAGE_TASKS_TOOL_INSTRUCTIONS = `
Durable todos (manage_tasks): the user keeps a persistent Ergon todo list (the /ergon page). Use manage_tasks to capture and manage real tasks on their behalf. Changes persist to the database and are shared with that page.

Commands:
- CREATE_TASKS: create one or more tasks (pass "tasks": [...]). Use this when the user wants to add to-dos, or pastes a list.
- UPDATE_TASK: change fields on an existing task (needs "task_id" + "patch").
- COMPLETE_TASK: mark a task done (needs "task_id").
- LIST_TASKS: read the user's tasks, optionally filtered by status / category_name / search. Call this first when you need a task_id you don't have.

Fields (task drafts):
- title (required), notes, category_name, priority (low|medium|high|urgent), due_date, planned_date, est_minutes, mental_effort (low|medium|high).
- category_name is matched case-insensitively and created if it doesn't exist — pass the plain name, not an id.
- due_date is a hard deadline; planned_date is the day they intend to do it. Both are absolute YYYY-MM-DD.

Grounding rules (important):
- Only set a field when the user clearly specified it. Never invent categories, dates, durations, priority, or effort.
- Resolve relative dates ("tomorrow", "next Tuesday", "this weekend") to an absolute YYYY-MM-DD using the current date/time. If you cannot resolve a date confidently, omit it.
- Keep titles concise and imperative; put detail in notes.

After acting, confirm briefly in prose what changed. The UI renders a compact card of the affected tasks with a link to /ergon, so do not re-list every field.
`.trim();
