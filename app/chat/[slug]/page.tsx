import { ChatInput } from "@/components/chat/chat-input";
import { ChatThread } from "@/components/chat/chat-thread";
import Page from "@/components/page";
import { title, subtitle, page } from "@/components/primitives";
import { UIMessage } from "ai";

export default async function Chat({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: chatId } = await params;

  return (
    <Page>
      <div className="h-full flex flex-col overflow-hidden items-center">
        {/*<div className="absolute top-0 w-full inline-block text-center justify-center p-4 bg-white/5 backdrop-blur-xl shadow">
          <span className={title()}>Welcome Chat ;)</span>
          <span className={subtitle()}>Chat ID: {chatId}</span>
        </div>*/}
        <div className="h-full">
          <ChatThread messages={sampleMessages} />
        </div>
        <ChatInput />
      </div>
    </Page>
  );
}

const sampleMessages: UIMessage[] = [
  {
    id: "1",
    role: "user",
    parts: [
      {
        type: "text",
        text: "How does AI work?",
      },
    ],
  },
  {
    id: "2",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "That's a fantastic question, and one that's at the heart of a lot of exciting developments today!",
      },
      {
        type: "text",
        text: "AI, or **Artificial Intelligence**, isn't a single thing, but rather a collection of techniques and technologies that allow computers to perform tasks that typically require human intelligence.",
      },
      {
        type: "text",
        text: "At a very high level, AI works by taking in a lot of data, finding patterns in that data, and then using those patterns to make decisions, predictions, or generate new information.",
      },
      {
        type: "text",
        text: "## Core Concepts",
      },
      {
        type: "text",
        text: "### 1. Data, Data, Data!",
      },
      {
        type: "text",
        text: "AI models learn from data — images, text, numbers, sounds, sensor readings, etc. The more relevant and diverse the data, the better the AI can learn.\n\nThink of it like a student preparing for an exam: the more diverse practice problems they get, the better prepared they’ll be.",
      },
      {
        type: "text",
        text: "### 2. Algorithms: The Brains of the Operation",
      },
      {
        type: "text",
        text: "Algorithms are sets of rules or instructions that a computer follows to solve a problem. In AI, these algorithms are designed to learn from data. Common approaches include:\n\n- **Machine Learning (ML):** Systems learn from data without being explicitly programmed. Like teaching a child animals by showing them examples instead of precise rules.\n- **Deep Learning (DL):** Neural networks with many layers, inspired by the brain. These excel at image recognition, natural language, and speech because they capture very complex patterns.",
      },
      {
        type: "text",
        text: "### 3. Training: Learning from Experience",
      },
      {
        type: "text",
        text: "The process of learning from data is called *training*. Main styles include:\n\n- **Supervised Learning:** Learn with labeled data (e.g., images labeled 'cat' or 'dog').\n- **Unsupervised Learning:** Discover hidden structure in unlabeled data (like clustering toys without labels).\n- **Reinforcement Learning:** Learn through trial and error, receiving rewards for good actions (think dog training with treats).",
      },
      {
        type: "text",
        text: "### 4. Prediction / Inference: Putting Knowledge to Use",
      },
      {
        type: "text",
        text: "Once trained, models can be applied to new data:\n\n- An image recognition model can identify a cat in a new picture.\n- A natural language model can translate text or answer questions.\n- A recommendation engine can suggest products you might like.",
      },
      {
        type: "text",
        text: "### Key Components in Action",
      },
      {
        type: "text",
        text: "- **Natural Language Processing (NLP):** Understand and generate human language (chatbots, translation, sentiment analysis).\n- **Computer Vision:** Interpret images and video (facial recognition, self-driving cars, medical scans).\n- **Robotics:** AI powers robots to perceive, plan, and act in the real world.",
      },
      {
        type: "text",
        text: "## In Essence",
      },
      {
        type: "text",
        text: "1. Ingest massive amounts of data.\n2. Use algorithms to find patterns during training.\n3. Apply learned patterns to new data for predictions and decisions.",
      },
      {
        type: "text",
        text: "The field of AI is constantly evolving, with new techniques and applications emerging all the time. It’s a truly fascinating area!",
      },
    ],
  },
];
