import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";

import {
  PromptInput,
  PromptInputTextarea,
} from "@/components/third-party/ai-elements/prompt-input";
import { render } from "../helpers/render";

const originalMatchMediaDescriptor = Object.getOwnPropertyDescriptor(window, "matchMedia");

afterEach(() => {
  cleanup();

  if (originalMatchMediaDescriptor) {
    Object.defineProperty(window, "matchMedia", originalMatchMediaDescriptor);
  } else {
    delete (window as Partial<Window>).matchMedia;
  }
});

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      matches: true,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

function ResetAwareModelSelect() {
  const [model, setModel] = useState("auto");
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const form = ref.current?.form;

    if (!form) return;
    const handleReset = () => setModel("auto");

    form.addEventListener("reset", handleReset);

    return () => form.removeEventListener("reset", handleReset);
  }, []);

  return (
    <select
      ref={ref}
      aria-label="Model"
      value={model}
      onChange={(event) => setModel(event.currentTarget.value)}
    >
      <option value="auto">Auto</option>
      <option value="sol">Sol</option>
    </select>
  );
}

function PromptWithModelSelect() {
  return (
    <PromptInput onSubmit={() => undefined}>
      <PromptInputTextarea defaultValue="hello" />
      <ResetAwareModelSelect />
      <button type="submit">Send</button>
    </PromptInput>
  );
}

describe("PromptInput form submission", () => {
  test("keeps controlled select values after sending", async () => {
    const { getByRole } = render(<PromptWithModelSelect />);
    const modelSelect = getByRole("combobox", { name: "Model" });

    fireEvent.change(modelSelect, { target: { value: "sol" } });
    expect((modelSelect as HTMLSelectElement).value).toBe("sol");

    fireEvent.submit(modelSelect.closest("form")!);

    await waitFor(() => expect((modelSelect as HTMLSelectElement).value).toBe("sol"));
  });
});
