import { UIMessage } from "ai";

// Define your custom message type with data part schemas
export type MyUIMessage = UIMessage<
  never, // metadata type
  {
    notification: {
      message: string;
      level: "info" | "warning" | "error";
    };
  } // data parts type
>;
