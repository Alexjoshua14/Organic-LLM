"use client";
import { AnimatePresence, motion } from "framer-motion";
import { UIIntent } from "./schemas/archetype";

// import { UIIntent } from "./schemas/archetype";
// import Chat from "./archetypes/Chat";

export default function MorphSurface({
  children,
  intent,
}: {
  children: React.ReactNode;
  intent: UIIntent;
}) {
  return (
    <div className="h-full w-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={intent.id}
          className="h-full w-full inset-shadow-sm rounded bg-background"
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 1.02, filter: "blur(10px)" }}
          initial={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {children}
          {/*{(() => {
            switch (intent.archetype) {
              case "chat":
                return <Chat chatId={(intent.data as any).id} />;
              case "news":
                return <div>News</div>;
              default:
                return <div>Unsure of itennt..</div>;
            }
          })()}*/}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
