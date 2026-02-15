import { Button } from "@heroui/button";
import { CheckIcon, Copy } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

export const ClipboardCopyButton = ({ text }: { text: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.warn("Clipboard write failed:", err);
      toast.error("Failed to copy to clipboard");
    }
  }, [text]);

  return (
    <Button
      className="text-secondary-foreground hover:scale-110 border touch-none"
      isIconOnly
      size="sm"
      variant="ghost"
      onPress={handleCopy}
    >
      {isCopied ? <CheckIcon size={14} /> : <Copy size={12} />}
    </Button>
  );
};
