import { PrototypeAboutRouteOverlay } from "@/components/sandbox/PrototypeAboutRouteOverlay";

export default function PrototypesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PrototypeAboutRouteOverlay />
    </>
  );
}
