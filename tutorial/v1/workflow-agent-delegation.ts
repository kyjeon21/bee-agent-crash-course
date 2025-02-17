import "dotenv/config";
import { BeeAgent } from "bee-agent-framework/agents/bee/agent";
import { z } from "zod";
import { Message, UserMessage } from "bee-agent-framework/backend/message";
import { WikipediaTool } from "bee-agent-framework/tools/search/wikipedia";
import { OpenMeteoTool } from "bee-agent-framework/tools/weather/openMeteo";
import { ReadOnlyMemory } from "bee-agent-framework/memory/base";
import { UnconstrainedMemory } from "bee-agent-framework/memory/unconstrainedMemory";
import { Workflow } from "bee-agent-framework/workflows/workflow";
import { createConsoleReader } from "../../helpers/io.js";
import { WatsonxChatModel } from "bee-agent-framework/adapters/watsonx/backend/chat";
import { SystemMessage } from "bee-agent-framework/backend/message";
import { DuckDuckGoSearchTool } from "bee-agent-framework/tools/search/duckDuckGoSearch";

const schema = z.object({
  answer: z.instanceof(Message).optional(),
  memory: z.instanceof(ReadOnlyMemory),
});

const workflow = new Workflow({ schema: schema })
  .addStep("simpleAgent", async (state) => {
    const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
    llm.config({
        parameters: {
            maxTokens: 1000,
            temperature: 0.0,
        },
    });
    const simpleAgent = new BeeAgent({
      llm: llm,
      tools: [],
      memory: state.memory,
    });
    const answer = await simpleAgent.run({ prompt: null });
    reader.write("🤖 Simple Agent", answer.result.text);

    state.answer = answer.result;
    return "critique";
  })
  .addStrictStep("critique", schema.required(), async (state) => {
    const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
    llm.config({
        parameters: {
            maxTokens: 1000,
            temperature: 0.0,
        },
    });
    const { object: critiqueResponse } = await llm.createStructure({
      schema: z.object({ score: z.number().int().min(0).max(100) }),
      messages: [
        // new SystemMessage("You are an evaluation assistant who scores the credibility of the last assistant's response. Chitchatting always has a score of 100. If the assistant was unable to answer the user's query, then the score will be 0."),
        new SystemMessage(`
You are an evaluation assistant who scores the accuracy, completeness, and factual correctness of the last assistant's response. 
Give a score between 0 and 100 based on these criteria:

- 90~100: The response is highly accurate, well-structured, and provides relevant facts. No major factual errors.
- 75~89: The response is mostly accurate but may have minor factual errors or missing details.
- 50~74: The response is incomplete, vague, or has moderate factual inaccuracies.
- 25~49: The response contains major factual errors or lacks necessary details.
- 0~24: The response is misleading, completely incorrect, or irrelevant to the question.

Fact-check the response carefully before assigning a score.
`),
        state.memory.messages.length > 0 ? state.memory.messages[state.memory.messages.length - 1] : null, // 가장 최근 사용자 질문
        state.answer,
      ],
    });
    console.log("🔍 Critique Model Response:", critiqueResponse);
    reader.write("🧠 Score", critiqueResponse.score.toString());

    return critiqueResponse.score < 80 ? "complexAgent" : Workflow.END;
  })
  .addStep("complexAgent", async (state) => {
    const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
    llm.config({
        parameters: {
            maxTokens: 1000,
            temperature: 0.0,
        },
    });
    const complexAgent = new BeeAgent({
      llm: llm,
      tools: [new WikipediaTool(), new OpenMeteoTool(), new DuckDuckGoSearchTool()],
      memory: state.memory,
    });
    const { result } = await complexAgent.run({ prompt: null });
    reader.write("🤖 Complex Agent", result.text);
    state.answer = result;
  })
  .setStart("simpleAgent");

const reader = createConsoleReader();
const memory = new UnconstrainedMemory();

for await (const { prompt } of reader) {
  const userMessage = new UserMessage(prompt);
  await memory.add(userMessage);

  const response = await workflow.run({
    memory: memory.asReadOnly(),
  });
  await memory.add(response.state.answer!);

  reader.write("🤖 Final Answer", response.state.answer!.text);
}
