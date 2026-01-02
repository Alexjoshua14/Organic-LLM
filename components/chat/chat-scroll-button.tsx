import { Button } from "@heroui/button";
import { ChevronDown } from "lucide-react";
import { FC } from "react";
import { useStickToBottom } from "use-stick-to-bottom";
import { glass } from "../design-system/primitives";

//TODO: MAKE THIS WORK

export const ChatScrollButton: FC = () => {
  const { isAtBottom, scrollToBottom } = useStickToBottom();

  return (
    !isAtBottom && (
      <Button
        className={`${glass()} backdrop-blur absolute rounded-lg w-14 left-1/2 -tranlsate-x-1/2 bottom-44 z-40`}
        onPress={() => scrollToBottom()}
      >
        <ChevronDown size={24} />
      </Button>
    )
  );
};
