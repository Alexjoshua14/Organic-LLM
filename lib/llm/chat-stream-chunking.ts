/** Every match consumes text, including blank lines; smoothStream rejects empty matches. */
export const CHAT_STREAM_CHUNKING = /(```[\s\S]*?```|^#{1,6}\s.*$|[^\n]+(?:\n|$)|\n)/gm;
