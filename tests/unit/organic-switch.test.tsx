import { afterEach, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { createRef } from "react";

import { Switch } from "@/components/design-system/switch";
import { Switch as RadixSwitch } from "@/components/third-party/ui/switch";
import { render } from "../helpers/render";

afterEach(cleanup);

test("Organic Switch preserves controlled state, callbacks, form values, and input refs", async () => {
  const onChange = mock(() => {});
  const ref = createRef<HTMLInputElement>();
  const view = render(
    <Switch
      aria-label="Memory"
      isSelected={false}
      name="memory"
      ref={ref}
      value="enabled"
      onValueChange={onChange}
    />
  );
  const input = view.getByRole("switch", { name: "Memory" }) as HTMLInputElement;
  expect(ref.current).toBe(input);
  expect(input.checked).toBe(false);
  expect(input.name).toBe("memory");
  expect(input.value).toBe("enabled");
  await act(async () => fireEvent.click(input));
  expect(onChange).toHaveBeenCalledWith(true);
  view.rerender(
    <Switch aria-label="Memory" isSelected name="memory" ref={ref} onValueChange={onChange} />
  );
  expect(input.checked).toBe(true);
});

test("disabled switches in either API reject interaction", async () => {
  const onHeroChange = mock(() => {});
  const onRadixChange = mock(() => {});
  const view = render(
    <>
      <Switch
        aria-label="Hero disabled"
        isDisabled
        isSelected={false}
        onValueChange={onHeroChange}
      />
      <RadixSwitch
        aria-label="Radix disabled"
        checked={false}
        disabled
        onCheckedChange={onRadixChange}
      />
    </>
  );
  await act(async () => {
    (view.getByRole("switch", { name: "Hero disabled" }) as HTMLInputElement).click();
    (view.getByRole("switch", { name: "Radix disabled" }) as HTMLButtonElement).click();
  });
  expect(onHeroChange).not.toHaveBeenCalled();
  expect(onRadixChange).not.toHaveBeenCalled();
});

test("the existing Radix entry point keeps its checked callback, label, and button ref", async () => {
  const onChange = mock(() => {});
  const ref = createRef<HTMLButtonElement>();
  const view = render(
    <RadixSwitch aria-label="Include time" checked={false} ref={ref} onCheckedChange={onChange} />
  );
  const button = view.getByRole("switch", { name: "Include time" });
  expect(ref.current).toBe(button as HTMLButtonElement);
  await act(async () => fireEvent.click(button));
  expect(onChange).toHaveBeenCalledWith(true);
  view.rerender(
    <RadixSwitch aria-label="Include time" checked ref={ref} onCheckedChange={onChange} />
  );
  expect(button.getAttribute("aria-checked")).toBe("true");
});
