import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { RabbitHoleNodeCreationApproval } from "@/components/rabbit-holes/RabbitHoleNodeCreationApproval";

describe("RabbitHoleNodeCreationApproval", () => {
  test("renders nothing without pending approval", () => {
    const html = renderToStaticMarkup(
      <RabbitHoleNodeCreationApproval
        addToolApprovalResponse={() => undefined}
        messages={[]}
        session={null}
      />
    );

    expect(html).toBe("");
  });
});
