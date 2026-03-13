import Page from "@/components/layout/page";
import { BrowseLoadingUI } from "./_components/BrowseLoadingUI";

export default function BrowseLoading() {
  return (
    <Page className="block px-8 py-14">
      <BrowseLoadingUI />
    </Page>
  );
}
