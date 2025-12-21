import { Select, SelectItem } from "@heroui/select";
import type { SharedSelection } from "@heroui/system";

import { glass } from "../design-system/primitives";
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
        style={{ minWidth: "12rem" }}
        className={`sm:w-48 lg:sm:w-48 text-foreground ${glass()} rounded-xl`}
        classNames={{
          trigger:
            "!border-white/25 border-t-1 border-x-1.5 border-b-1.5 min-sm:w-48",
          listbox: "min-sm:w-48",
          popoverContent: "min-sm:w-48",
        }}
        items={ChatModels}
        selectedKeys={selectedModel ? [selectedModel.id] : []}
        variant="bordered"
        onSelectionChange={handleSelectedModelChange}
        disallowEmptySelection
      >
        {(model) => <SelectItem key={model.id} textValue={model.name}>{model.name}</SelectItem>}
      </Select>
    </div>
  );
};
