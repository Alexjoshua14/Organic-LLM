"use server";

import { generateId, UIMessage } from "ai";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";

export async function createChat(): Promise<string> {
  const id = generateId();
  await writeFile(getChatFile(id), "[]");
  return id;
}

export async function loadChat(id: string): Promise<UIMessage[]> {
  if (!existsSync(getChatFile(id))) throw new Error(`Chat ${id} not found`);
  return JSON.parse(await readFile(getChatFile(id), "utf8"));
}

export async function saveChat({
  id,
  messages,
}: {
  id: string;
  messages: UIMessage[];
}): Promise<void> {
  await writeFile(getChatFile(id), JSON.stringify(messages));
}

export async function getChats(): Promise<string[]> {
  const chatDir = path.join(process.cwd(), ".chats");
  const chats = readdirSync(chatDir);
  return chats.map((chat) => chat.replace(".json", ""));
}

function getChatFile(id: string): string {
  const chatDir = path.join(process.cwd(), ".chats");
  if (!existsSync(chatDir)) mkdirSync(chatDir, { recursive: true });
  return path.join(chatDir, `${id}.json`);
}
