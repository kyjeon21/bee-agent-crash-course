import "dotenv/config";
import { z } from "zod";
import { Workflow } from "bee-agent-framework/workflows/workflow";
import { BeeAgent } from "bee-agent-framework/agents/bee/agent";
import { UnconstrainedMemory } from "bee-agent-framework/memory/unconstrainedMemory";
import { createConsoleReader } from "../../helpers/io.js";
import { Message } from "bee-agent-framework/backend/message";
import { isEmpty } from "remeda";
import { LLMTool } from "bee-agent-framework/tools/llm";
// import { GoogleSearchTool } from "bee-agent-framework/tools/search/googleSearch";
import { DuckDuckGoSearchTool } from "bee-agent-framework/tools/search/duckDuckGoSearch";
import { WatsonxChatModel } from "bee-agent-framework/adapters/watsonx/backend/chat";
import { UserMessage, SystemMessage } from "bee-agent-framework/backend/message";
const schema = z.object({
  input: z.string(),
  output: z.string().optional(),

  topic: z.string().optional(),
  notes: z.array(z.string()).default([]),
  plan: z.string().optional(),
  draft: z.string().optional(),
});

const workflow = new Workflow({
  schema,
  outputSchema: schema.required({ output: true }),
})
  .addStep("preprocess", async (state) => {
    const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
    llm.config({
        parameters: {
            maxTokens: 1000,
            temperature: 0.0,
        },
    });

    const { object: parsed } = await llm.createStructure({
      schema: schema.pick({ topic: true, notes: true }).or(
        z.object({
          error: z
            .string()
            .describe("Use when the input query does not make sense or you need clarification."),
        }),
      ),
      messages: [
        new UserMessage(
          [
            "Your task is to rewrite the user query so that it guides the content planner and editor to craft a blog post that perfectly aligns with the user's needs. Notes should be used only if the user complains about something.",
            "If the user query does ",
            "",
            state.topic ? `# Previous Topic\n${state.topic}` : "",
            !isEmpty(state.notes) ? `# Previous Notes\n${state.notes.join("\n")}` : "",
            "# User Query",
            state.input || "empty",
          ]
            .filter(Boolean)
            .join("\n")
        )
      ],
    });

    if ("error" in parsed) {
      state.output = parsed.error;
      return Workflow.END;
    }

    // state.notes = parsed.notes ?? [];
    // state.topic = parsed.topic;
    if ("notes" in parsed) {
      state.notes = parsed.notes;
    } else {
      state.notes = [];
    }
    
    if ("topic" in parsed) {
      state.topic = parsed.topic;
    }
    

  })
  .addStrictStep("planner", schema.required({ topic: true }), async (state) => {
    const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
    llm.config({
        parameters: {
            maxTokens: 1000,
            temperature: 0.0,
        },
    });
    const agent = new BeeAgent({
      llm,
      memory: new UnconstrainedMemory(),
      tools: [new DuckDuckGoSearchTool(), new LLMTool({ llm })],
    });

    agent.emitter.on("update", (data) => {
      console.info(data.update);
    });

    const { result } = await agent.run({
      prompt: [
        `You are a Content Planner. Your task is to write a content plan for "${state.topic}" topic in Markdown format.`,
        ``,
        `# Objectives`,
        `1. Prioritize the latest trends, key players, and noteworthy news.`,
        `2. Identify the target audience, considering their interests and pain points.`,
        `3. Develop a detailed content outline including introduction, key points, and a call to action.`,
        `4. Include SEO keywords and relevant sources.`,
        ``,
        ...[!isEmpty(state.notes) && ["# Notes", ...state.notes, ""]],
        `Provide a structured output that covers the mentioned sections.`,
      ].join("\n"),
    });

    state.plan = result.text;
  })
  .addStrictStep("writer", schema.required({ plan: true }), async (state) => {
    const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
    llm.config({
        parameters: {
            maxTokens: 1000,
            temperature: 0.0,
        },
    });
    const output = await llm.create({
      messages: [
        new SystemMessage(
          [
            `You are a Content Writer. Your task is to write a compelling blog post based on the provided context.`,
            "",
            `# Context`,
            `${state.plan}`,
            "",
            `# Objectives`,
            `- An engaging introduction`,
            `- Insightful body paragraphs (2-3 per section)`,
            `- Properly named sections/subtitles`,
            `- A summarizing conclusion`,
            `- Format: Markdown`,
            "",
            !isEmpty(state.notes) ? `# Notes\n${state.notes.join("\n")}\n` : "",
            `Ensure the content flows naturally, incorporates SEO keywords, and is well-structured.`,
          ]
            .filter(Boolean)
            .join("\n")
        )        
      ],
    });

    state.draft = output.getTextContent();
  })
  .addStrictStep("editor", schema.required({ draft: true }), async (state) => {
    const llm = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
    llm.config({
        parameters: {
            maxTokens: 1000,
            temperature: 0.0,
        },
    });
    const output = await llm.create({
      messages: [
        new SystemMessage(`You are an Editor. Your task is to transform the following draft blog post to a final version.

# Draft
${state.draft}

# Objectives
- Fix Grammatical errors
- Journalistic best practices

${!isEmpty(state.notes) ? `# Notes\n${state.notes.join("\n")}\n` : ""}

IMPORTANT: The final version must not contain any editor's comments.`),
      ],
    });

    state.output = output.getTextContent();
  });

let lastResult = {} as Workflow.output<typeof workflow>;
const reader = createConsoleReader();
for await (const { prompt } of reader) {
  const { result } = await workflow
    .run({
      input: prompt,
      notes: lastResult?.notes,
      topic: lastResult?.topic,
    })
    .observe((emitter) => {
      emitter.on("start", ({ step, run }) => {
        reader.write(`-> ▶️ ${step}`, JSON.stringify(run.state).substring(0, 200).concat("..."));
      });
    });

  lastResult = result;
  reader.write("🤖 Answer", lastResult.output);
}
// "클라우드 네이티브 애플리케이션의 보안 위험과 해결 방법"이라는 주제로 심층 분석 블로그를 작성해줘.