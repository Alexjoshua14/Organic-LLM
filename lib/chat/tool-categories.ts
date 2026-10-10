export type ChatToolCategory =
  | "Memory"
  | "Web"
  | "Chat history"
  | "Task management"
  | "Diagrams"
  | "Interactive content"
  | "Reflection views"
  | "Documents"
  | "Restaurants"
  | "Meal planning"
  | "Agents"
  | "Research"
  | "Other";

/** User-facing capabilities, rather than the implementation names of every tool. */
export function getActiveToolCategories(toolNames: string[] = []): ChatToolCategory[] {
  const categories = new Set<ChatToolCategory>();

  for (const name of toolNames) {
    if (/memor|delphi/.test(name)) categories.add("Memory");
    else if (/web_search/.test(name)) categories.add("Web");
    else if (/chat_history|messages_from_date/.test(name)) categories.add("Chat history");
    else if (/task|kanban/.test(name)) categories.add("Task management");
    else if (/mermaid/.test(name)) categories.add("Diagrams");
    else if (/gen_ui/.test(name)) categories.add("Interactive content");
    else if (/introspection/.test(name)) categories.add("Reflection views");
    else if (/strata|knowledge/.test(name)) categories.add("Documents");
    else if (/restaurant/.test(name)) categories.add("Restaurants");
    else if (/recipe|mise|prep_plan/.test(name)) categories.add("Meal planning");
    else if (/subagent|worker|dispatch|thread/.test(name)) categories.add("Agents");
    else if (/rabbit|topic|insight|branch/.test(name)) categories.add("Research");
    else categories.add("Other");
  }

  return [...categories];
}
