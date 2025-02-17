import { Workflow } from "bee-agent-framework/workflows/workflow";
import { z } from "zod";

const schema = z.object({
  threshold: z.number().min(0).max(1),
  counter: z.number().default(0),
});

const addFlow = new Workflow({ schema }).addStep("run", async (state) => {
  state.counter += 1;
  return Math.random() > 0.5 ? Workflow.SELF : Workflow.END;
});

const subtractFlow = new Workflow({
  schema,
}).addStep("run", async (state) => {
  state.counter -= 1;
  return Math.random() > 0.5 ? Workflow.SELF : Workflow.END;
});

const workflow = new Workflow({
  schema,
})
  .addStep("start", (state) =>
    Math.random() > state.threshold ? "delegateAdd" : "delegateSubtract",
  )
  .addStep("delegateAdd", addFlow.asStep({ next: Workflow.END }))
  .addStep("delegateSubtract", subtractFlow.asStep({ next: Workflow.END }));

const response = await workflow.run({ threshold: 0.5 }).observe((emitter) => {
  emitter.on("start", (data, event) =>
    console.log(`-> step ${data.step}`, event.trace?.parentRunId ? "(nested flow)" : ""),
  );
});
console.info(`Counter:`, response.result);


// Agent Delegation
// import "dotenv/config";
// import { BeeAgent } from "bee-agent-framework/agents/bee/agent";
// import { z } from "zod";
// import { Message, UserMessage } from "bee-agent-framework/backend/message";
// import { WikipediaTool } from "bee-agent-framework/tools/search/wikipedia";
// import { OpenMeteoTool } from "bee-agent-framework/tools/weather/openMeteo";
// import { ReadOnlyMemory } from "bee-agent-framework/memory/base";
// import { UnconstrainedMemory } from "bee-agent-framework/memory/unconstrainedMemory";
// import { Workflow } from "bee-agent-framework/workflows/workflow";
// import { createConsoleReader } from "../helpers/io.js";
// import { WatsonxChatModel } from "bee-agent-framework/adapters/watsonx/backend/chat";
// import { SystemMessage } from "bee-agent-framework/backend/message";

// const schema = z.object({
//   answer: z.instanceof(Message).optional(),
//   memory: z.instanceof(ReadOnlyMemory),
// });

// const workflow = new Workflow({ schema: schema })
//   .addStep("simpleAgent", async (state) => {
//     const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
//     llm.config({
//         parameters: {
//             maxTokens: 1000,
//             temperature: 0.0,
//         },
//     });
//     const simpleAgent = new BeeAgent({
//       llm: llm,
//       tools: [],
//       memory: state.memory,
//     });
//     const answer = await simpleAgent.run({ prompt: null });
//     reader.write("🤖 Simple Agent", answer.result.text);

//     state.answer = answer.result;
//     return "critique";
//   })
//   .addStrictStep("critique", schema.required(), async (state) => {
//     const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
//     llm.config({
//         parameters: {
//             maxTokens: 1000,
//             temperature: 0.0,
//         },
//     });
//     const { object: critiqueResponse } = await llm.createStructure({
//       schema: z.object({ score: z.number().int().min(0).max(100) }),
//       messages: [
//         // new SystemMessage("You are an evaluation assistant who scores the credibility of the last assistant's response. Chitchatting always has a score of 100. If the assistant was unable to answer the user's query, then the score will be 0."),
//         new SystemMessage(`
// You are an evaluation assistant who scores the accuracy, completeness, and factual correctness of the last assistant's response. 
// Give a score between 0 and 100 based on these criteria:

// - 90~100: The response is highly accurate, well-structured, and provides relevant facts. No major factual errors.
// - 75~89: The response is mostly accurate but may have minor factual errors or missing details.
// - 50~74: The response is incomplete, vague, or has moderate factual inaccuracies.
// - 25~49: The response contains major factual errors or lacks necessary details.
// - 0~24: The response is misleading, completely incorrect, or irrelevant to the question.

// Fact-check the response carefully before assigning a score.
// `),
//         state.memory.messages.length > 0 ? state.memory.messages[state.memory.messages.length - 1] : null, // 가장 최근 사용자 질문
//         state.answer,
//       ],
//     });
//     console.log("🔍 Critique Model Response:", critiqueResponse);
//     reader.write("🧠 Score", critiqueResponse.score.toString());

//     return critiqueResponse.score < 75 ? "complexAgent" : Workflow.END;
//   })
//   .addStep("complexAgent", async (state) => {
//     const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
//     llm.config({
//         parameters: {
//             maxTokens: 1000,
//             temperature: 0.0,
//         },
//     });
//     const complexAgent = new BeeAgent({
//       llm: llm,
//       tools: [new WikipediaTool(), new OpenMeteoTool()],
//       memory: state.memory,
//     });
//     const { result } = await complexAgent.run({ prompt: null });
//     reader.write("🤖 Complex Agent", result.text);
//     state.answer = result;
//   })
//   .setStart("simpleAgent");

// const reader = createConsoleReader();
// const memory = new UnconstrainedMemory();

// for await (const { prompt } of reader) {
//   const userMessage = new UserMessage(prompt);
//   await memory.add(userMessage);

//   const response = await workflow.run({
//     memory: memory.asReadOnly(),
//   });
//   await memory.add(response.state.answer!);

//   reader.write("🤖 Final Answer", response.state.answer!.text);
// }


// // Multi-Agent Content Creator
// import "dotenv/config";
// import { z } from "zod";
// import { Workflow } from "bee-agent-framework/workflows/workflow";
// import { BeeAgent } from "bee-agent-framework/agents/bee/agent";
// import { UnconstrainedMemory } from "bee-agent-framework/memory/unconstrainedMemory";
// import { createConsoleReader } from "../helpers/io.js";
// import { Message } from "bee-agent-framework/backend/message";
// import { isEmpty } from "remeda";
// import { LLMTool } from "bee-agent-framework/tools/llm";
// // import { GoogleSearchTool } from "bee-agent-framework/tools/search/googleSearch";
// import { DuckDuckGoSearchTool } from "bee-agent-framework/tools/search/duckDuckGoSearch";
// import { WatsonxChatModel } from "bee-agent-framework/adapters/watsonx/backend/chat";
// import { UserMessage, SystemMessage } from "bee-agent-framework/backend/message";
// const schema = z.object({
//   input: z.string(),
//   output: z.string().optional(),

//   topic: z.string().optional(),
//   notes: z.array(z.string()).default([]),
//   plan: z.string().optional(),
//   draft: z.string().optional(),
// });

// const workflow = new Workflow({
//   schema,
//   outputSchema: schema.required({ output: true }),
// })
//   .addStep("preprocess", async (state) => {
//     const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
//     llm.config({
//         parameters: {
//             maxTokens: 1000,
//             temperature: 0.0,
//         },
//     });

//     const { object: parsed } = await llm.createStructure({
//       schema: schema.pick({ topic: true, notes: true }).or(
//         z.object({
//           error: z
//             .string()
//             .describe("Use when the input query does not make sense or you need clarification."),
//         }),
//       ),
//       messages: [
//         new UserMessage(
//           [
//             "Your task is to rewrite the user query so that it guides the content planner and editor to craft a blog post that perfectly aligns with the user's needs. Notes should be used only if the user complains about something.",
//             "If the user query does ",
//             "",
//             state.topic ? `# Previous Topic\n${state.topic}` : "",
//             !isEmpty(state.notes) ? `# Previous Notes\n${state.notes.join("\n")}` : "",
//             "# User Query",
//             state.input || "empty",
//           ]
//             .filter(Boolean)
//             .join("\n")
//         )
//       ],
//     });

//     if ("error" in parsed) {
//       state.output = parsed.error;
//       return Workflow.END;
//     }

//     // state.notes = parsed.notes ?? [];
//     // state.topic = parsed.topic;
//     if ("notes" in parsed) {
//       state.notes = parsed.notes;
//     } else {
//       state.notes = [];
//     }
    
//     if ("topic" in parsed) {
//       state.topic = parsed.topic;
//     }
    

//   })
//   .addStrictStep("planner", schema.required({ topic: true }), async (state) => {
//     const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
//     llm.config({
//         parameters: {
//             maxTokens: 1000,
//             temperature: 0.0,
//         },
//     });
//     const agent = new BeeAgent({
//       llm,
//       memory: new UnconstrainedMemory(),
//       tools: [new DuckDuckGoSearchTool(), new LLMTool({ llm })],
//     });

//     agent.emitter.on("update", (data) => {
//       console.info(data.update);
//     });

//     const { result } = await agent.run({
//       prompt: [
//         `You are a Content Planner. Your task is to write a content plan for "${state.topic}" topic in Markdown format.`,
//         ``,
//         `# Objectives`,
//         `1. Prioritize the latest trends, key players, and noteworthy news.`,
//         `2. Identify the target audience, considering their interests and pain points.`,
//         `3. Develop a detailed content outline including introduction, key points, and a call to action.`,
//         `4. Include SEO keywords and relevant sources.`,
//         ``,
//         ...[!isEmpty(state.notes) && ["# Notes", ...state.notes, ""]],
//         `Provide a structured output that covers the mentioned sections.`,
//       ].join("\n"),
//     });

//     state.plan = result.text;
//   })
//   .addStrictStep("writer", schema.required({ plan: true }), async (state) => {
//     const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
//     llm.config({
//         parameters: {
//             maxTokens: 1000,
//             temperature: 0.0,
//         },
//     });
//     const output = await llm.create({
//       messages: [
//         new SystemMessage(
//           [
//             `You are a Content Writer. Your task is to write a compelling blog post based on the provided context.`,
//             "",
//             `# Context`,
//             `${state.plan}`,
//             "",
//             `# Objectives`,
//             `- An engaging introduction`,
//             `- Insightful body paragraphs (2-3 per section)`,
//             `- Properly named sections/subtitles`,
//             `- A summarizing conclusion`,
//             `- Format: Markdown`,
//             "",
//             !isEmpty(state.notes) ? `# Notes\n${state.notes.join("\n")}\n` : "",
//             `Ensure the content flows naturally, incorporates SEO keywords, and is well-structured.`,
//           ]
//             .filter(Boolean)
//             .join("\n")
//         )        
//       ],
//     });

//     state.draft = output.getTextContent();
//   })
//   .addStrictStep("editor", schema.required({ draft: true }), async (state) => {
//     const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
//     llm.config({
//         parameters: {
//             maxTokens: 1000,
//             temperature: 0.0,
//         },
//     });
//     const output = await llm.create({
//       messages: [
//         new SystemMessage(`You are an Editor. Your task is to transform the following draft blog post to a final version.

// # Draft
// ${state.draft}

// # Objectives
// - Fix Grammatical errors
// - Journalistic best practices

// ${!isEmpty(state.notes) ? `# Notes\n${state.notes.join("\n")}\n` : ""}

// IMPORTANT: The final version must not contain any editor's comments.`),
//       ],
//     });

//     state.output = output.getTextContent();
//   });

// let lastResult = {} as Workflow.output<typeof workflow>;
// const reader = createConsoleReader();
// for await (const { prompt } of reader) {
//   const { result } = await workflow
//     .run({
//       input: prompt,
//       notes: lastResult?.notes,
//       topic: lastResult?.topic,
//     })
//     .observe((emitter) => {
//       emitter.on("start", ({ step, run }) => {
//         reader.write(`-> ▶️ ${step}`, JSON.stringify(run.state).substring(0, 200).concat("..."));
//       });
//     });

//   lastResult = result;
//   reader.write("🤖 Answer", lastResult.output);
// }
// // "클라우드 네이티브 애플리케이션의 보안 위험과 해결 방법"이라는 주제로 심층 분석 블로그를 작성해줘.