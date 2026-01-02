import { glass } from '@/components/design-system/primitives';
import Page from '@/components/layout/page';
import { PropagateLoader } from 'react-spinners'

export default function ChatLoading() {
  return (
    <Page>
      <div className="flex flex-col items-center justify-center gap-10 -translate-y-10 p-10 min-h-screen h-screen box-border bg-background">
        <span className="mt-3 text-secondary-foreground text-xl">Loading chat…</span>
        <PropagateLoader color="#128C74" />
        <span className={`${glass()} py-1 px-2 rounded absolute bottom-4 text-xs text-primary shadow-md whitespace-nowrap z-10`}>Demonstration of chat loading component</span>
      </div>
    </Page>
  );
}