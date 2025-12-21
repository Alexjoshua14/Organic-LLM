


export default function ChatLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 p-10 min-h-screen h-screen box-border bg-background">
      <div
        className="w-10 h-10 rounded-full animate-spin"
        style={{
          borderWidth: "4px",
          borderStyle: "solid",
          borderColor: "#e5e7eb", // gray-300
          borderTopColor: "#2563eb", // blue-600
        }}
      />
      <span className="mt-3 text-secondary-foreground text-base">Loading chat…</span>
    </div>
  );
}