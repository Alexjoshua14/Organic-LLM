"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const DELAY_MS = 400;

export function BrowseLoadingUI() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
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
  );
}
