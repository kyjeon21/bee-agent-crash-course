import "dotenv/config";
import { WatsonXChatLLM } from "bee-agent-framework/adapters/watsonx/chat";
import { BaseMessage, Role } from "bee-agent-framework/llms/primitives/message";

// Add readline for terminal input
import readline from "readline/promises";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const config = {
    streaming: true,    // true = Streaming mode, false = Standard mode
    multiTurn: true,   // true = Multi-turn support (maintains conversation context), false = Single-turn
};

const llm = WatsonXChatLLM.fromPreset("meta-llama/llama-3-3-70b-instruct", {
    apiKey: process.env.WATSONX_API_KEY,
    projectId: process.env.WATSONX_PROJECT_ID,
    region: process.env.WATSONX_REGION || "us-south", // Set default value
    parameters: {
        decoding_method: "greedy",
        max_new_tokens: 1000, // Adjust reponse length
    },
});

const messageHistory = [
    BaseMessage.of({
        role: Role.SYSTEM,
        text: `You always answer the questions with markdown formatting using GitHub syntax. The markdown formatting you support: headings, bold, italic, links, tables, lists, code blocks, and blockquotes. You must omit that you answer the questions with markdown.

Any HTML tags must be wrapped in block quotes, for example \`\`\`<html>\`\`\`. You will be penalized for not rendering code in block quotes.

When returning code blocks, specify language.

You are a helpful, respectful and honest assistant. Always answer as helpfully as possible, while being safe. 

Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.

If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.`
    })
];

const processMessage = async (message) => {
    // 🎯 If multi-turn mode is enabled, add user message to history
    const userMessage = BaseMessage.of({ role: Role.USER, text: message });
    if (config.multiTurn) messageHistory.push(userMessage);

    if (config.streaming) {
        // 🔹 Execute in streaming mode
        process.stdout.write("Assistant: ");
        let assistantResponse = "";

        for await (const chunk of llm.stream(config.multiTurn ? messageHistory : [userMessage])) {
            const textChunk = chunk.getTextContent();
            process.stdout.write(textChunk);
            assistantResponse += textChunk;
        }

        process.stdout.write("\n\n");

        // 🔹 If multi-turn mode is enabled, add assistant response to history
        if (config.multiTurn) {
            messageHistory.push(BaseMessage.of({ role: Role.ASSISTANT, text: assistantResponse }));
        }

    } else {
        // 🔹 Execute in non-streaming mode
        const response = await llm.generate(config.multiTurn ? messageHistory : [userMessage]);
        const assistantResponse = response.getTextContent();
        
        console.log("Assistant:", assistantResponse);

        // 🔹 If multi-turn mode is enabled, add assistant response to history
        if (config.multiTurn) {
            messageHistory.push(BaseMessage.of({ role: Role.ASSISTANT, text: assistantResponse }));
        }
    }
};



const startChat = async () => {
    while (true) {
        const message = await rl.question("You: ");

        if (message.toLowerCase() === "bye") {
            console.log("Assistant: Goodbye!");
            rl.close();
            break;
        }

        await processMessage(message);
    }
};

console.log('Start chatting (type "bye" to exit)');
startChat();