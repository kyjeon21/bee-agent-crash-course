import "dotenv/config";
import readline from "readline/promises";
import {
  SystemMessage,
  AssistantMessage,
  UserMessage,
} from "bee-agent-framework/backend/core";
import { SlidingCache } from "bee-agent-framework/cache/slidingCache";
import { WatsonxChatModel } from "bee-agent-framework/adapters/watsonx/backend/chat";
import { createConsoleReader } from "../../helpers/io.js";

// Instantiate the WatsonxChatModel
const model = await WatsonxChatModel.fromName(
  "watsonx:meta-llama/llama-3-3-70b-instruct"
);

// Configure model parameters & caching
model.config({
  parameters: {
    maxTokens: 1000,
    temperature: 0.0,
  },
  cache: new SlidingCache({
    size: 25,
  }),
});

// Store conversation history if multi-turn is desired
const messageHistory: (SystemMessage | UserMessage | AssistantMessage)[] = [
  new SystemMessage(
    `You always answer the questions with markdown formatting using GitHub syntax. The markdown formatting you support: headings, bold, italic, links, tables, lists, code blocks, and blockquotes. You must omit that you answer the questions with markdown.

Any HTML tags must be wrapped in block quotes, for example \`\`\`<html>\`\`\`. You will be penalized for not rendering code in block quotes.

When returning code blocks, specify language.

You are a helpful, respectful and honest assistant. Always answer as helpfully as possible, while being safe. 

Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.

If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.`
  ),
];

// Create console reader instance
const reader = createConsoleReader();

for await (const { prompt } of reader) {
  const userMessage = new UserMessage(prompt);
  messageHistory.push(userMessage);

  const response = await model.create({
    messages: messageHistory,
  });

  const assistantResponse: string = response.getTextContent();
  messageHistory.push(new AssistantMessage(assistantResponse));

  reader.write("🤖 Answer", assistantResponse ?? "No response available.");
}
