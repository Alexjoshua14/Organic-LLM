import { Select, SelectItem } from "@heroui/select";
import { useState } from "react";

type ModelSelectorProps = {
  setSelectedModel: () => void;
};

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
      selectedKeys={[selectedModel]}
      onChange={handleSelectedModelChange}
      className="text-foreground"
      items={availableModels}
    >
      {(model) => <SelectItem>{model.label}</SelectItem>}
    </Select>
  );
};
