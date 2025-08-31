import Page from "@/components/layout/page";
import { NewChat } from "@/components/chat/new-chat";

export default function Home() {
  return (
    <Page>
      <div className="relative inline-block max-w-4xl h-full w-full text-center justify-center">
        <NewChat />
        {/*<span className={title()}>Make&nbsp;</span>
        <span className={title({ color: "violet" })}>beautiful&nbsp;</span>
        <br />
        <span className={title()}>
          websites regardless of your design experience.
        </span>
        <div className={subtitle({ class: "mt-4" })}>
          Beautiful, fast and modern React UI library.
        </div>*/}
      </div>
    </Page>
  );
}
