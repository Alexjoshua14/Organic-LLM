import { BrowseLoadingUI } from "./_components/BrowseLoadingUI";

import Page from "@/components/layout/page";

export default function BrowseLoading() {
  return (
    <Page className="block px-8 py-14">
      <BrowseLoadingUI />
    </Page>
  );
}
