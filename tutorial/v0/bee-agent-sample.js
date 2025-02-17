import "dotenv/config";
import { BeeAgent } from "bee-agent-framework/agents/bee/agent";
import { WatsonXChatLLM } from "bee-agent-framework/adapters/watsonx/chat";
import { TokenMemory } from "bee-agent-framework/memory/tokenMemory";
import { DuckDuckGoSearchTool } from "bee-agent-framework/tools/search/duckDuckGoSearch";
import { OpenMeteoTool } from "bee-agent-framework/tools/weather/openMeteo";

const llm = WatsonXChatLLM.fromPreset("meta-llama/llama-3-3-70b-instruct", {
    apiKey: process.env.WATSONX_API_KEY,
    projectId: process.env.WATSONX_PROJECT_ID,
    region: process.env.WATSONX_REGION || "us-south", // Set default value
    parameters: {
        decoding_method: "greedy",
        max_new_tokens: 1000, // Adjust reponse length
    },
});

const agent = new BeeAgent({
  llm, // for more explore 'bee-agent-framework/adapters'
  memory: new TokenMemory({ llm }), // for more explore 'bee-agent-framework/memory'
  tools: [new DuckDuckGoSearchTool(), new OpenMeteoTool()], // for more explore 'bee-agent-framework/tools'
});

const response = await agent
  .run({ prompt: "What's the current weather in Las Vegas?" })
  .observe((emitter) => {
    emitter.on("update", async ({ data, update, meta }) => {
      console.log(`Agent (${update.key}) 🤖 : `, update.value);
    });
  });

console.log(`Agent 🤖 : `, response.result.text);