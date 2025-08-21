import { Select, SelectItem } from "@heroui/select";

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

  return (
    <Select className="text-foreground" items={availableModels}>
      {(model) => <SelectItem>{model.label}</SelectItem>}
    </Select>
  );
};
