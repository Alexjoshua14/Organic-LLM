import { Button } from "@heroui/button";

const SIDEBAR_WIDTH = "20rem";

export function Sidebar() {
  return (
    <div className="bg-secondary h-screen w-64 p-3">
      <div className="w-full h-full flex flex-col items-center gap-4">
        <div>
          <h1>Organic LLM</h1>
        </div>
        <div className="w-full rounded-md">
          <Button className="w-full">New Chat</Button>
        </div>
      </div>
    </div>
  );
}
