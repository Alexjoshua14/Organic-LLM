import { ShowcaseNav } from "@/components/showcase/ShowcaseNav";

import "./showcase.css";

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="showcase-layout">
      <a className="showcase-skip" href="#showcase-content">
        Skip to showcase
      </a>
      <ShowcaseNav />
      <div className="showcase-route" id="showcase-content">
        {children}
      </div>
    </div>
  );
}
