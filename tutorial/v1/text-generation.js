import "dotenv/config";
import readline from "readline/promises";
import {
  SystemMessage,
  AssistantMessage,
  UserMessage,
} from "bee-agent-framework/backend/core";
import { SlidingCache } from "bee-agent-framework/cache/slidingCache";
import { WatsonxChatModel } from "bee-agent-framework/adapters/watsonx/backend/chat";

// Create terminal interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Simple config to toggle streaming & multi-turn
const config = {
  streaming: true, // true = Streaming mode, false = Standard mode
  multiTurn: true, // true = Multi-turn support, false = Single-turn
};

// Instantiate the WatsonxChatModel
const model = await WatsonxChatModel.fromName(
  "watsonx:meta-llama/llama-3-3-70b-instruct"
);

// Configure model parameters & caching
model.config({
  parameters: {
    maxTokens: 1000,
    temperature: 0.0,
    // topP: 1,
    // frequencyPenalty: 0 ,//1.1,
    // presencePenalty: 0, //1,
    // n: 1,
  },
    cache: new SlidingCache({
      size: 25,
    }),
});

// Store conversation history if multi-turn is desired
const messageHistory = [
  new SystemMessage(
    `You always answer the questions with markdown formatting using GitHub syntax. The markdown formatting you support: headings, bold, italic, links, tables, lists, code blocks, and blockquotes. You must omit that you answer the questions with markdown.

Any HTML tags must be wrapped in block quotes, for example \`\`\`<html>\`\`\`. You will be penalized for not rendering code in block quotes.

When returning code blocks, specify language.

You are a helpful, respectful and honest assistant. Always answer as helpfully as possible, while being safe. 

Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.

If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.`
  ),
];

/**
 * Process user input & get model’s response
 */
const processMessage = async (userText) => {
  const userMessage = new UserMessage(userText);

  // Multi-turn: push user message into conversation history
  if (config.multiTurn) {
    messageHistory.push(userMessage);
  }

  if (config.streaming) {
    // --- Streaming mode ---
    process.stdout.write("Assistant: ");

    let assistantResponse = "";

    // Initiate the stream request and listen for new tokens
    await model
      .create({
        messages: config.multiTurn ? messageHistory : [userMessage], // for single-turn, just this user message
        stream: true,
      })
      .observe((emitter) => {
        // Fires for each incremental token
        emitter.on("newToken", ({ value }) => {
          const tokenText = value.getTextContent();
          //   const tokenText = value.getTextContent().replace(/\r/g, "");
          process.stdout.write(tokenText);
          assistantResponse += tokenText;
        });
        // Called once the stream is done
        // emitter.on("success", () => {
        //   console.log("success 이벤트 호출됨");
        //   process.stdout.write("\n\n");
        // });
        emitter.on("finish", () => {
        //   console.log("finish 이벤트 호출됨");
          process.stdout.write("\n");
          //   console.log(assistantResponse);
        });
      });

    // If multi-turn, store the assistant response
    if (config.multiTurn) {
      messageHistory.push(new AssistantMessage(assistantResponse));
    }
  } else {
    // --- Non-streaming mode ---
    const response = await model.create({
      messages: config.multiTurn ? messageHistory : [userMessage],
    });

    const assistantResponse = response.getTextContent();
    console.log("Assistant:", assistantResponse);

    if (config.multiTurn) {
      messageHistory.push(new AssistantMessage(assistantResponse));
    }
  }
};

/**
 * Start the interactive chat loop
 */
const startChat = async () => {
  console.log('Start chatting (type "bye" to exit)');

  while (true) {
    const userInput = await rl.question("You: ");

    // Basic exit condition
    if (userInput.toLowerCase() === "bye") {
      console.log("Assistant: Goodbye!");
      rl.close();
      break;
    }

    // Send message to the model
    await processMessage(userInput);
  }
};

startChat();
