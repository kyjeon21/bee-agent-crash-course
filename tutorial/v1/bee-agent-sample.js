import "dotenv/config"
import { BeeAgent } from "bee-agent-framework/agents/bee/agent";
import { WatsonxChatModel } from "bee-agent-framework/adapters/watsonx/backend/chat";
import { TokenMemory } from "bee-agent-framework/memory/tokenMemory";
import { DuckDuckGoSearchTool } from "bee-agent-framework/tools/search/duckDuckGoSearch";
import { OpenMeteoTool } from "bee-agent-framework/tools/weather/openMeteo";

const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
llm.config({
    parameters: {
        maxTokens: 1000,
    },
});

const agent = new BeeAgent({
  llm, // for more explore 'bee-agent-framework/adapters'
  memory: new TokenMemory(), // for more explore 'bee-agent-framework/memory'
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
