"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { DelayedContent } from "@/app/rabbitholes/_components/DelayedContent";

export function BrowseLoadingUI() {
  return (
    <DelayedContent delayMs={400}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-24 text-center"
      >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="mb-4"
      >
        <Loader2 className="w-8 h-8 text-muted-foreground" />
      </motion.div>
      <p className="font-commissioner text-xl text-muted-foreground font-light">
        Loading rabbit holes...
      </p>
      <p className="text-sm text-muted-foreground/70 mt-2">
        Fetching your sessions from the database
      </p>
    </motion.div>
    </DelayedContent>
  );
}
