import { Select, SelectItem } from "@heroui/select";
import { useState } from "react";
import { glass } from "../design-system/primitives";

type ModelSelectorProps = {};

export const ModelSelector: React.FC<ModelSelectorProps> = () => {
  const availableModels: {
    key: string;
    label: string;
  }[] = [
      {
        key: "gpt-5",
        label: "GPT-5",
      },
      {
        key: "Claude 4 Sonnet",
        label: "Claude 4 Sonnet",
      },
      {
        key: "Kimi v4",
        label: "Kimi v4",
      },
      {
        key: "Gemini 2.5 Flash",
        label: "Gemini 2.5 Flash",
      },
      {
        key: "Gemini 2.5 Pro",
        label: "Gemini 2.5 Pro",
      },
      {
        key: "Gemini Imagen 4",
        label: "Gemini Imagen 4",
      },
    ];

  const [selectedModel, setSelectedModel] = useState<string>(
    availableModels[0].key,
  );

  const handleSelectedModelChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setSelectedModel(e.target.value);
  };

  return (
    <Select
      className={`w-20 sm:w-24 lg:w-32 text-foreground ${glass()} rounded-xl`}
      items={availableModels}
      selectedKeys={[selectedModel]}
      onChange={handleSelectedModelChange}
      variant="bordered"
      classNames={{
        trigger: "!border-white/25 border-t-1 border-x-1.5 border-b-1.5",
      }}
    >
      {(model) => <SelectItem>{model.label}</SelectItem>}
    </Select>
  );
};
