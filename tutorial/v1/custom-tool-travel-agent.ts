import "dotenv/config";
import {
  BaseToolOptions,
  BaseToolRunOptions,
  JSONToolOutput,
  Tool,
  ToolInput,
} from "bee-agent-framework/tools/base";
import {
  SystemMessage,
  AssistantMessage,
  UserMessage,
} from "bee-agent-framework/backend/core";
import { RunContext } from "bee-agent-framework/context";
// import { WatsonXLLM } from "bee-agent-framework/adapters/watsonx/llm";
import { WatsonxChatModel } from "bee-agent-framework/adapters/watsonx/backend/chat";
import { z } from "zod";
import { ToolEvents } from "bee-agent-framework/tools/base";
import { Emitter } from "bee-agent-framework/emitter/emitter";

type ToolOptions = BaseToolOptions;
type ToolRunOptions = BaseToolRunOptions;

interface TravelAgentToolResponse {
  rank: number;
  city: string;
  country: string;
  reason_to_travel: string;
  main_interests_covered: string;
}

export class TravelTool extends Tool<
  JSONToolOutput<TravelAgentToolResponse>,
  ToolOptions,
  ToolRunOptions
> {
  name = "TravelAgent";
  description = `Provides a list of vacation options to visit it answers with the reasons to travel to a city.`;

  emitter = new Emitter<
    ToolEvents<this, JSONToolOutput<TravelAgentToolResponse>>
  >(); 

  inputSchema() {
    return z.object({
      question_input: z.string().describe("Question of the traveler."),
    });
  }

  static {
    this.register();
  }

  protected async _run(
    { question_input: question, ...input }: ToolInput<this>,
    _options: BaseToolRunOptions | undefined,
    run: RunContext<this>
  ) {
    const llm = await WatsonxChatModel.fromName(
      "watsonx:meta-llama/llama-3-3-70b-instruct"
    );

    llm.config({
      parameters: {
        maxTokens: 1000,
      },
    });

    let prompt = `# Role
You are a travel agent and you provide the best suggestions related to vacation trips.

# Instructions
You must answer in a JSON list format that contains the following information.
You must provide only two entries in the list at the moment.

[{
  "rank": NUMBER,
  "city": TEXT,
  "country": TEXT,
  "reason_to_travel": TEXT,
  "main_interests_covered": TEXT
}]

Now answer the following question: ${question}`;
    const userMessage = new UserMessage(prompt);

    console.log("Log:\nFormatted prompt:\n" + prompt + "\n");

    try {
      const response = await llm.create({ messages: [userMessage] });
      console.log("LLM result:", response.getTextContent());

      const data: TravelAgentToolResponse = JSON.parse(
        response.getTextContent()
      );

      return new JSONToolOutput(data);
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  }
}

// 아래부터 바로 실행할 수 있도록 추가하는 코드입니다.
async function main() {
  // TravelAgentTool 인스턴스 생성
  const travelAgent = new TravelTool();

  // 사용자 입력 설정
  const input: ToolInput<typeof travelAgent> = {
    question_input: "Where should I travel this summer for adventure?",
  };

  console.log("Executing Travel Agent Tool...");

  try {
    // 실행 및 결과 출력
    const result = await travelAgent.run(input, {});
    console.log("Travel Agent Response:\n", result);
  } catch (error) {
    console.error("Error running Travel Agent:", error);
  }
}

// 실행
main();
