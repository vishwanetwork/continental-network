// DeepSeek API 调用封装
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_API_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || "";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callDeepSeek(messages: ChatMessage[]): Promise<string> {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

export async function generateStoryboard(
  productInfo: string,
  knowledgeContext: string,
  style?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是一个专业的视频分镜头脚本编剧。根据提供的产品信息和知识库内容，生成详细的视频分镜头脚本。
输出格式为JSON数组，每个元素包含：
- sceneNumber: 镜头编号
- duration: 建议时长（如 "5s"）
- visual: 画面描述
- narration: 旁白/配音文案
- notes: 制作备注

请生成5-8个镜头的完整脚本。`,
    },
    {
      role: "user",
      content: `产品信息：${productInfo}\n\n知识库参考：${knowledgeContext}${style ? `\n\n风格要求：${style}` : ""}`,
    },
  ];

  return callDeepSeek(messages);
}

export async function generateVideoScript(storyboard: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是一个视频制作指导专家。根据分镜头脚本，生成详细的视频制作指南，包括：
1. 每个镜头的具体拍摄/制作建议
2. 转场效果建议
3. 配乐风格建议
4. 整体节奏把控建议
5. 后期处理建议

请用清晰的结构化格式输出。`,
    },
    {
      role: "user",
      content: `请根据以下分镜头脚本生成视频制作指南：\n\n${storyboard}`,
    },
  ];

  return callDeepSeek(messages);
}
