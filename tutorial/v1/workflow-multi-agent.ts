import "dotenv/config";
import { UnconstrainedMemory } from "bee-agent-framework/memory/unconstrainedMemory";
import { OpenMeteoTool } from "bee-agent-framework/tools/weather/openMeteo";
import { WikipediaTool } from "bee-agent-framework/tools/search/wikipedia";
import { AgentWorkflow } from "bee-agent-framework/workflows/agent";
import { WatsonxChatModel } from "bee-agent-framework/adapters/watsonx/backend/chat";
import {
    SystemMessage,
    AssistantMessage,
    UserMessage,
  } from "bee-agent-framework/backend/core";

const workflow = new AgentWorkflow();

const llm = await WatsonxChatModel.fromName(
  "watsonx:meta-llama/llama-3-3-70b-instruct"
);

llm.config({
  parameters: {
    maxTokens: 1000,
  },
});

workflow.addAgent({
  name: "Researcher",
  instructions: "You are a researcher assistant. Respond only if you can provide a useful answer.",
  tools: [new WikipediaTool()],
  llm: llm,
});

workflow.addAgent({
  name: "WeatherForecaster",
  instructions: "You are a weather assistant. Respond only if you can provide a useful answer.",
  tools: [new OpenMeteoTool()],
  llm: llm,
  execution: { maxIterations: 3 },
});

workflow.addAgent({
  name: "Solver",
  instructions: "Your task is to provide the most useful final answer based on the assistants' responses which all are relevant. Ignore those where assistant do not know.",
  llm: llm,
});

const memory = new UnconstrainedMemory();


await memory.add(
  new UserMessage("What is the capital of France and what is the current weather there?",
    { createdAt: new Date() }
  )
);

const { result } = await workflow.run(memory.messages).observe((emitter) => {
  emitter.on("success", (data) => {
    console.log(`-> ${data.step}`, data.state?.finalAnswer ?? "-");
  });
});

console.log(`Agent 🤖`, result.finalAnswer);
process.exit(0);