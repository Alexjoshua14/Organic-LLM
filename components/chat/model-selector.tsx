import type { SharedSelection } from "@heroui/system";

import { Select, SelectItem } from "@heroui/select";

import { glass } from "../design-system/primitives";

import { ModelZdrIndicator } from "./model-zdr-indicator";

import { ChatModels, ChatModel } from "@/lib/schemas/chat";

type ModelSelectorProps = {
  selectedModel: ChatModel;
  handleModelSelection: (m: ChatModel) => void;
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  handleModelSelection,
}) => {
  // heroui/select expects the keys to be strings, using the id field of ChatModel as primary key
  // When the value is changed, call the parent with the full model object.
  const handleSelectedModelChange = (keys: SharedSelection) => {
    // Handle both string and Set<string> cases
    const selectedId = typeof keys === "string" ? keys : Array.from(keys)[0];
    const foundModel = ChatModels.find((m) => m.id === selectedId);

    if (foundModel) {
      handleModelSelection(foundModel);
    }
  };

  return (
    <div className="sm:w-48">
      <Select
        disallowEmptySelection
        className={`sm:w-48 lg:sm:w-48 text-foreground ${glass()} rounded-xl`}
        classNames={{
          trigger: "!border-white/25 border-t-1 border-x-1.5 border-b-1.5 min-sm:w-48",
          listbox: "min-sm:w-48",
          popoverContent: "min-sm:w-48",
        }}
        items={ChatModels}
        selectedKeys={selectedModel ? [selectedModel.id] : []}
        style={{ minWidth: "12rem" }}
        variant="bordered"
        onSelectionChange={handleSelectedModelChange}
      >
        {(model) => (
          <SelectItem key={model.id} textValue={model.name}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{model.name}</span>
              {model.supportsZeroDataRetention && <ModelZdrIndicator />}
            </span>
          </SelectItem>
        )}
      </Select>
    </div>
  );
};
