import { Button } from "@heroui/button";
import { ChevronDown } from "lucide-react";
import { FC } from "react";
import { useStickToBottom } from "use-stick-to-bottom";

//TODO: MAKE THIS WORK

export const ChatScrollButton: FC = () => {
  const { isAtBottom, scrollToBottom } = useStickToBottom();

  return (
    !isAtBottom && (
      <Button
        className="absolute text-4xl rounded-lg left-1/2 -tranlsate-x-1/2 bottom-36"
        onPress={() => scrollToBottom()}
      >
        <ChevronDown size={24} />
      </Button>
    )
  );
};
