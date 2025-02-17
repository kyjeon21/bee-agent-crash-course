import "dotenv/config";
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import { EmbeddingModel } from "bee-agent-framework/backend/embedding";
import {
  BaseAgent,
  BaseAgentRunOptions,
} from "bee-agent-framework/agents/base";
import {
  AssistantMessage,
  Message,
  SystemMessage,
  UserMessage,
} from "bee-agent-framework/backend/message";
import { Emitter } from "bee-agent-framework/emitter/emitter";
import { GetRunContext } from "bee-agent-framework/context";
import { z } from "zod";
import { AgentMeta } from "bee-agent-framework/agents/types";
import { BaseMemory } from "bee-agent-framework/memory/base";
import { UnconstrainedMemory } from "bee-agent-framework/memory/unconstrainedMemory";
import { ChatModel } from "bee-agent-framework/backend/chat";
import { WatsonxChatModel } from "bee-agent-framework/adapters/watsonx/backend/chat";
import { createConsoleReader } from "../../helpers/io.js";


const milvusConfig = {
  address: process.env.MILVUS_ADDRESS,
  username: process.env.MILVUS_USERNAME,
  password: process.env.MILVUS_PASSWORD,
  ssl: process.env.MILVUS_SSL === "true",
};

const COLLECTION_NAME = "hackathon_newsdata_20250215_dev";

interface RunInput {
  message: Message;
}

interface RunOutput {
  message: Message;
  state: {
    thought: string;
    final_answer: string;
    follow_up_needed: boolean;
    evaluation?: { score: number; feedback: string };
  };
}

interface RunOptions extends BaseAgentRunOptions {
  maxRetries?: number;
}

interface AgentInput {
  llm: ChatModel;
  memory: BaseMemory;
  milvusClient: MilvusClient;
  embModel: EmbeddingModel;
}

export class VectorAgent extends BaseAgent<RunInput, RunOutput, RunOptions> {
  public readonly memory: BaseMemory;
  protected readonly model: ChatModel;
  protected readonly milvusClient: MilvusClient;
  protected readonly embModel: EmbeddingModel;
  public emitter = Emitter.root.child({
    namespace: ["agent", "vector"],
    creator: this,
  });

  constructor(input: AgentInput) {
    super();
    this.model = input.llm;
    this.memory = input.memory;
    this.milvusClient = input.milvusClient;
    this.embModel = input.embModel;
  }

  /**
   * 벡터 검색을 수행하고 관련 뉴스 문서를 검색
   */
  private async vectorSearch(query: string) {
    // 1. 입력을 벡터화
    const embedding = await this.embModel.create({ values: [query] });
    const searchVector = embedding.embeddings[0];

    // 2. Milvus에서 검색 실행
    const searchResponse = await this.milvusClient.search({
      collection_name: COLLECTION_NAME,
      vector: searchVector,
      params: { nprobe: 64 },
      limit: 3,
      metric_type: "COSINE",
      output_fields: ["id", "content", "metadata"],
    });

    // 3. 결과 정제 (불필요한 메타데이터 제거)
    return searchResponse.results.map((result) => {
      if (result.metadata) {
        delete result.metadata.dialogue;
        delete result.metadata.split_content;
      }
      return result;
    });
  }

  /**
   * 실행 로직 (_run)
   */
  protected async _run(
    input: RunInput,
    options: RunOptions & { iteration?: number },
    run: GetRunContext<this>
  ): Promise<RunOutput> {
    // 기본적으로 최대 반복 횟수를 3으로 설정
    const iteration = options.iteration ?? 1;
    if (iteration > 3) {
      const summaryResponse = await this.model.createStructure({
        schema: z.object({
          summary: z.string().describe("A summary of the responses generated so far and an indication that 3 iterations have been reached"),
        }),
        messages: [
          new SystemMessage(`
    Output ONLY in JSON format. Your response must strictly follow this format:
    {
      "summary": "Your summary message in English."
    }
    Do NOT include any additional text, explanations, or markdown formatting.
          `),
          new UserMessage(
            `We have reached 3 iterations. Please provide a concise summary of the responses so far and note that the maximum iteration count has been reached.`
          ),
        ],
        maxRetries: 1,
      });
    
      const summaryOutput = summaryResponse.object as { summary: string };
    
      // Return the summary as the final response
      const resultMessage = new AssistantMessage(summaryOutput.summary);
      await this.memory.add(resultMessage);
    
      return {
        message: resultMessage,
        state: {
          thought: "Reached the maximum iteration count (3).",
          final_answer: summaryOutput.summary,
          follow_up_needed: false,
          evaluation: { score: 0, feedback: "Iteration limit reached." },
        },
      };
    }

    // 사용자 입력에서 queryText 추출
    const userQuery = (input.message as UserMessage).content as any;
    const queryText =
      typeof userQuery === "string"
        ? userQuery
        : typeof userQuery === "object" &&
          userQuery !== null &&
          "text" in userQuery
        ? (userQuery.text as string)
        : Array.isArray(userQuery)
        ? userQuery
            .map((part) =>
              typeof part === "string"
                ? part
                : typeof part === "object" && part !== null && "text" in part
                ? (part.text as string)
                : JSON.stringify(part)
            )
            .join(" ")
        : JSON.stringify(userQuery);
    console.log("📝 Processed Query:", queryText);

    const searchResults = await this.vectorSearch(queryText);
    console.log(
      "🔍 Milvus Search Results:",
      JSON.stringify(searchResults, null, 2)
    );

    // 검색 결과를 기반으로 답변 생성
    const response = await this.model.createStructure({
      schema: z.object({
        thought: z.string().describe("검색 결과를 기반으로 한 생각"),
        final_answer: z.string().describe("최종 답변"),
        follow_up_needed: z.boolean().describe("추가 검색 필요 여부"),
      }),
      messages: [
        new SystemMessage(`
Output ONLY in JSON format. Your response must strictly follow this format:
{
  "thought": "Your thought process based on the search results",
  "final_answer": "Your final answer",
  "follow_up_needed": true or false
}
Do NOT include any additional text, explanations, or markdown formatting.
        `),
        new UserMessage(
          `User Query: "${queryText}"\n\nRelevant Documents:\n${JSON.stringify(
            searchResults,
            null,
            2
          )}`
        ),
      ],
      maxRetries: options?.maxRetries,
      abortSignal: run.signal,
    });

    // 중간 결과 출력
    console.log("💬 생성된 답변 응답:", response);

    const output = response.object as {
      thought: string;
      final_answer: string;
      follow_up_needed: boolean;
    };

    // 평가 단계: LLM을 사용하여 답변 평가 (0-100 점과 피드백 설명 생성)
    const evaluation = await this.model.createStructure({
      schema: z.object({
        score: z.number().int().min(0).max(100),
        feedback: z.string(),
      }),
      messages: [
        new SystemMessage(`
Strictly adhere to the following rules:
1. Output must be a SINGLE JSON object.
2. The response must start with '{' and end with '}'.
3. Only include the keys "score" and "feedback" in the specified order.
4. "feedback" must be concise (max 100 characters).
5. Do NOT add any additional text, comments, or markdown.

Scoring Guidelines:
- Assign a score between 0-100. If the response is not perfect, do not give more than 95.
- If the answer is logical but has room for improvement, assign a score between 60-90.
- If there are factual inaccuracies, assign a score below 60.
- Only provide 95+ for truly flawless responses.

You are a STRICT evaluator. If any part of the response is lacking, assign a lower score.
        `),
        new UserMessage(`Query: "${queryText}"`),
        new UserMessage(`Answer: "${output.final_answer}"`),
      ],
    });

    const evalResult = evaluation.object as { score: number; feedback: string };
    console.log("📊 평가 결과:", evalResult);

    // 평가 점수가 80 이상이면 최종 답변을 반환
    if (evalResult.score >= 95) {
      const resultMessage = new AssistantMessage(output.final_answer);
      await this.memory.add(resultMessage);
      return {
        message: resultMessage,
        state: {
          ...output,
          evaluation: evalResult,
        },
      };
    } else {
      const maxFeedbackLength = 100;
      const shortFeedback =
        evalResult.feedback.length > maxFeedbackLength
          ? evalResult.feedback.slice(0, maxFeedbackLength) + "..."
          : evalResult.feedback;

      // LLM을 호출해서 새 질의를 생성
      const refinementResponse = await this.model.createStructure({
        schema: z.object({
          refined_query: z.string(),
        }),
        messages: [
          new SystemMessage(`
Output must be a SINGLE JSON object only.
{
  "refined_query": "Revised search query"
}
Do NOT include any additional text, comments, paragraphs, or markdown formatting.
    `),
          new UserMessage(`Feedback: ${shortFeedback}`),
          new UserMessage(`Original Answer: ${output.final_answer}`),
        ],
        maxRetries: 2,
        abortSignal: run.signal,
      });

      const refinedOutput = refinementResponse.object as {
        refined_query: string;
      };
      const refinedQuery = refinedOutput.refined_query;
      console.log("🔄 생성된 재작성 질의:", refinedQuery);

      // 재귀 호출 전에 메모리를 클리어하여 히스토리 누적을 방지합니다.
      // if (typeof this.memory.clear === "function") {
      //   await this.memory.clear();
      // }

      // 재귀 호출 시 iteration 증가
      return this._run(
        { message: new UserMessage(refinedQuery) },
        { ...options, iteration: iteration + 1 },
        run
      );
    }
  }

  public get meta(): AgentMeta {
    return {
      name: "VectorAgent",
      description:
        "An AI agent that performs vector search and iteratively refines queries.",
      tools: [],
    };
  }

  createSnapshot() {
    return {
      ...super.createSnapshot(),
      emitter: this.emitter,
      memory: this.memory,
    };
  }

  loadSnapshot(snapshot: ReturnType<typeof this.createSnapshot>) {
    Object.assign(this, snapshot);
  }
}

/**
 * 에이전트 실행
 */
// (async () => {
//   const milvusClient = new MilvusClient(milvusConfig);
//   await milvusClient.connectPromise;
//   console.log("✅ Connected to Milvus successfully.");

//   const embeddingModel = await EmbeddingModel.fromName(
//     "watsonx:intfloat/multilingual-e5-large"
//   );

//   const model = await WatsonxChatModel.fromName(
//     "watsonx:meta-llama/llama-3-3-70b-instruct"
//   );

//   // LLM 모델 설정
//   model.config({
//     parameters: {
//       maxTokens: 9000,
//       temperature: 0.0,
//     },
//   });

//   // 에이전트 생성
//   const vectorAgent = new VectorAgent({
//     llm: model,
//     memory: new UnconstrainedMemory(),
//     milvusClient: milvusClient,
//     embModel: embeddingModel,
//   });

//   // 실행 테스트
//   const response = await vectorAgent.run(
//     {
//       message: new UserMessage(
//         "What is the main topic of the article 'Philadelphia Preps for Pricey Winter Season?'"
//       ),
//     },
//     { maxRetries: 3 }
//   );

//   console.log("🤖 Final Response:", response.state);
// })();


(async () => {
  const milvusClient = new MilvusClient(milvusConfig);
  await milvusClient.connectPromise;
  console.log("✅ Connected to Milvus successfully.");

  const embeddingModel = await EmbeddingModel.fromName("watsonx:intfloat/multilingual-e5-large");
  const model = await WatsonxChatModel.fromName("watsonx:meta-llama/llama-3-3-70b-instruct");
  model.config({ parameters: { maxTokens: 9000, temperature: 0.0 } });

  const vectorAgent = new VectorAgent({
    llm: model,
    memory: new UnconstrainedMemory(),
    milvusClient: milvusClient,
    embModel: embeddingModel,
  });

  let lastResult: { final_answer?: string } = {}; // 타입을 명확히 지정
  const reader = createConsoleReader();

  for await (const { prompt } of reader) {
    const response = await vectorAgent.run(
      { message: new UserMessage(prompt) },
      { maxRetries: 3 }
    );

    lastResult = response.state || {}; // 만약 state가 undefined이면 빈 객체 할당
    reader.write("🤖 Answer", lastResult.final_answer ?? "No response available.");
  }
})();
