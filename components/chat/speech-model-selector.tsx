"use client";

import { Select, SelectItem } from "@heroui/select";
import { glass } from "../design-system/primitives";

type SpeechModel = {
  key: string;
  label: string;
  provider: string;
};

type SpeechModelSelectorProps = {
  selectedModel: string;
  onModelChange: (model: string) => void;
  className?: string;
};

export const SpeechModelSelector: React.FC<SpeechModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  className = "",
}) => {
  const availableModels: SpeechModel[] = [
    {
      key: "gpt-4o-mini-tts",
      label: "GPT-4o Mini TTS",
      provider: "OpenAI",
    },
    {
      key: "eleven_multilingual_v2",
      label: "ElevenLabs Multilingual v2",
      provider: "ElevenLabs",
    },
    {
      key: "eleven_flash_v2_5",
      label: "ElevenLabs Flash v2.5",
      provider: "ElevenLabs",
    },
    {
      key: "eleven_v3",
      label: "ElevenLabs v3",
      provider: "ElevenLabs",
    },
  ];

  const handleSelectedModelChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    onModelChange(e.target.value);
  };

  return (
    <Select
      className={`w-48 sm:w-56 lg:w-64 text-foreground ${glass()} rounded-xl ${className}`}
      classNames={{
        trigger: "!border-white/25 border-t-1 border-x-1.5 border-b-1.5",
        value: "text-sm",
      }}
      items={availableModels}
      label="Speech Model"
      selectedKeys={[selectedModel]}
      variant="bordered"
      onChange={handleSelectedModelChange}
    >
      {(model) => (
        <SelectItem key={model.key} textValue={model.label}>
          <div className="flex flex-col">
            <span className="text-sm">{model.label}</span>
            <span className="text-xs text-muted-foreground">
              {model.provider}
            </span>
          </div>
        </SelectItem>
      )}
    </Select>
  );
};

