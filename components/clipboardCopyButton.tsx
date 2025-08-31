import { Button } from "@heroui/button";
import { CheckIcon, ClipboardCopyIcon, Copy } from "lucide-react";
import { useState } from "react";


export const ClipboardCopyButton = ({ text }: { text: string }) => {
  const [isCopied, setIsCopied] = useState(false);


  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <Button size="sm" variant="ghost" isIconOnly onPress={() => {
      handleCopy();
    }}
    >
      {isCopied ? <CheckIcon size={14} /> : <Copy size={12} />}
    </Button>
  );
};