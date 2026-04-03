const OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

interface OpenAiStructuredOutputRequest {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  model?: string;
}

interface OpenAiResponsesApiResponse {
  output_text?: string;
  output?: OpenAiResponseOutputItem[];
}

interface OpenAiResponseOutputItem {
  type?: string;
  content?: OpenAiResponseContentItem[];
}

interface OpenAiResponseContentItem {
  type?: string;
  text?: string;
  refusal?: string;
}

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getOpenAiModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export async function createStructuredOpenAiResponse<T>(
  request: OpenAiStructuredOutputRequest,
): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for real AI prediction.");
  }

  const response = await fetch(OPENAI_RESPONSES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model ?? getOpenAiModel(),
      instructions: request.systemPrompt,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: request.userPrompt,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: request.schemaName,
          schema: request.schema,
          strict: true,
        },
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `OpenAI Responses API failed with status ${response.status}: ${errorText}`,
    );
  }

  const payload = (await response.json()) as OpenAiResponsesApiResponse;
  const refusal = extractRefusal(payload);

  if (refusal) {
    throw new Error(`OpenAI refused prediction output: ${refusal}`);
  }

  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new Error("OpenAI response did not include structured output text.");
  }

  return JSON.parse(outputText) as T;
}

function extractOutputText(response: OpenAiResponsesApiResponse) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    if (item.type !== "message") {
      continue;
    }

    for (const contentItem of item.content ?? []) {
      if (
        contentItem.type === "output_text" &&
        typeof contentItem.text === "string" &&
        contentItem.text.trim()
      ) {
        return contentItem.text;
      }
    }
  }

  return null;
}

function extractRefusal(response: OpenAiResponsesApiResponse) {
  for (const item of response.output ?? []) {
    if (item.type !== "message") {
      continue;
    }

    for (const contentItem of item.content ?? []) {
      if (
        contentItem.type === "refusal" &&
        typeof contentItem.refusal === "string" &&
        contentItem.refusal.trim()
      ) {
        return contentItem.refusal;
      }
    }
  }

  return null;
}
