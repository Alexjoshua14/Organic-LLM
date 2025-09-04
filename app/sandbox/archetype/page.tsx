import { MorphSurface, UIIntent } from "@/packages/organic-ui/";
import ChatArchetype from "@/packages/organic-ui/src/archetypes/Chat";
import "server-only";

export default function ArchetypePage() {
  const intent: UIIntent = {
    id: "random-id-here",
    archetype: "chat",
    confidence: 1,
    data: {
      kind: "chat",
      id: "2f6b5bab-8528-4372-b9fc-786e7d9ad52a",
    },
  };

  return (
    <div className="pt-14 px-2 h-[90dvh] w-full ">
      <div className="h-1/2 w-full">
        <MorphSurface intent={intent}>
          {(() => {
            switch (intent.archetype) {
              case "chat":
                return <ChatArchetype chatId={intent.data.id} />;
              case "news":
                return <div>News</div>;
              default:
                return <div>Unsure of itennt..</div>;
            }
          })()}
        </MorphSurface>
      </div>
      {/*<div className="absolute z-20 top-1/2 -translate-y-1/2 right-0">
        <h1>Intent</h1>
        <select onChange={handleSandboxIntentChange}>
          <option value="chat">Chat</option>
        </select>
      </div>*/}
    </div>
  );
}
