import {
    BaseToolOptions,
    BaseToolRunOptions,
    Tool,
    ToolInput,
    JSONToolOutput,
    ToolError,
    ToolEmitter,
  } from "bee-agent-framework/tools/base";
  import { z } from "zod";
  import { createURLParams } from "bee-agent-framework/internals/fetcher";
  import { GetRunContext } from "bee-agent-framework/context";
  import { Callback, Emitter } from "bee-agent-framework/emitter/emitter";
  
  type ToolOptions = BaseToolOptions & { maxResults?: number };
  type ToolRunOptions = BaseToolRunOptions;
  
  export interface OpenLibraryResponse {
    numFound: number;
    start: number;
    numFoundExact: boolean;
    q: string;
    offset: number;
    docs: Record<string, any>[];
  }
  
  export class OpenLibraryToolOutput extends JSONToolOutput<OpenLibraryResponse> {
    isEmpty(): boolean {
      return (
        !this.result ||
        this.result.numFound === 0 ||
        this.result.docs.length === 0
      );
    }
  }
  
  export class OpenLibraryTool extends Tool<
    OpenLibraryToolOutput,
    ToolOptions,
    ToolRunOptions
  > {
    name = "OpenLibrary";
    description =
      "Provides access to a library of books with information about book titles, authors, contributors, publication dates, publisher and isbn.";
  
    inputSchema() {
      return z
        .object({
          title: z.string(),
          author: z.string(),
          isbn: z.string(),
          subject: z.string(),
          place: z.string(),
          person: z.string(),
          publisher: z.string(),
        })
        .partial();
    }
  
    public readonly emitter: ToolEmitter<
      ToolInput<this>,
      OpenLibraryToolOutput,
      {
        beforeFetch: Callback<{ request: { url: string; options: RequestInit } }>;
        afterFetch: Callback<{ data: OpenLibraryResponse }>;
      }
    > = Emitter.root.child({
      namespace: ["tool", "search", "openLibrary"],
      creator: this,
    });
  
    static {
      this.register();
    }
  
    protected async _run(
      input: ToolInput<this>,
      _options: Partial<ToolRunOptions>,
      run: GetRunContext<this>
    ) {
      //   const request = {
      //     url: `https://openlibrary.org?${createURLParams({
      //       searchon: input,
      //     })}`,
      //     options: { signal: run.signal } as RequestInit,
      //   };
  
      const params = createURLParams({
        title: input.title,
        author: input.author,
        isbn: input.isbn,
        subject: input.subject,
        place: input.place,
        person: input.person,
        publisher: input.publisher,
      });
  
      const request = {
        url: `https://openlibrary.org/search.json?${params}`, // ✅ 수정된 부분
        options: { signal: run.signal } as RequestInit,
      };
  
      await run.emitter.emit("beforeFetch", { request });
      const response = await fetch(request.url, request.options);
  
      if (!response.ok) {
        throw new ToolError(
          "Request to Open Library API has failed!",
          [new Error(await response.text())],
          {
            context: { input },
          }
        );
      }
  
      const json: OpenLibraryResponse = await response.json();
      if (this.options.maxResults) {
        json.docs.length = this.options.maxResults;
      }
  
      await run.emitter.emit("afterFetch", { data: json });
      return new OpenLibraryToolOutput(json);
    }
  }
  
  (async () => {
  //   const tool = new OpenLibraryTool();
    const tool = new OpenLibraryTool({ maxResults: 3 });
    const openLibraryOutput = await tool.run({
      title: "The Lord of the Rings",
    });
    console.log(
      `Generated OpenLibrary: ${JSON.stringify(
        openLibraryOutput.result,
        null,
        2
      )}`
    );
  })();
  