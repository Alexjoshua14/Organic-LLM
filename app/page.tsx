import type { Metadata } from "next";

import Home from "@/components/pages/home";
import { welcomeCopy } from "@/lib/welcome/copy";

export const metadata: Metadata = {
  title: {
    absolute: welcomeCopy.meta.title,
  },
  description: welcomeCopy.meta.description,
};

export default function HomePage() {
  return <Home />;
}
