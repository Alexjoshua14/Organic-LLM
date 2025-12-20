import { Select, SelectItem } from "@heroui/select";
import { useState } from "react";

import { glass } from "../design-system/primitives";
import { ChatModelType } from "@/lib/schemas/chat";

type ModelSelectorProps = {
  selectedModel: ChatModelType;
  handleModelSelection: (m: ChatModelType) => void;
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, handleModelSelection }) => {
  const availableModels: {
    key: ChatModelType;
    label: string;
  }[] = [
      {
        key: "gpt-5",
        label: "GPT-5",
      },
      {
        key: "gpt-5-mini",
        label: "GPT-5 Mini",
      },
      {
        key: "gpt-5.2",
        label: "GPT-5.2",
      },
      {
        key: "gpt-5-nano",
        label: "GPT-5 Nano",
      },
      {
        key: "gpt-4o",
        label: "GPT-4o",
      },
      {
        key: "gpt-4o-mini",
        label: "GPT-4o Mini",
      },
      {
        key: "gpt-4-turbo",
        label: "GPT-4 Turbo",
      },
    ];

  const handleSelectedModelChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    handleModelSelection(e.target.value as ChatModelType);
  };

  return (
    <div className="sm:w-48">
      <Select
        style={{ minWidth: "12rem" }}
        className={`sm:w-48 lg:sm:w-48 text-foreground ${glass()} rounded-xl`}
        classNames={{
          trigger:
            "!border-white/25 border-t-1 border-x-1.5 border-b-1.5 min-sm:w-48",
          listbox: "min-sm:w-48",
          popoverContent: "min-sm:w-48",
        }}
        items={availableModels}
        selectedKeys={[selectedModel]}
        variant="bordered"
        onChange={handleSelectedModelChange}
      >
        {(model) => <SelectItem>{model.label}</SelectItem>}
      </Select>
    </div>
  );
};
