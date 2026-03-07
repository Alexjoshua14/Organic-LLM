import { Button } from "@heroui/button";
import { CheckIcon, Copy } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

function copyViaExecCommand(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok;
}

export const ClipboardCopyButton = ({ text }: { text: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const hasClipboard =
      typeof navigator !== "undefined" && navigator.clipboard?.writeText;

    try {
      if (hasClipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const ok = copyViaExecCommand(text);
        if (!ok) throw new Error("execCommand copy failed");
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.warn("Clipboard write failed:", err);
      try {
        if (copyViaExecCommand(text)) {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
          toast.success("Copied to clipboard");
          return;
        }
      } catch {
        // ignore fallback failure
      }
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
