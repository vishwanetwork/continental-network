// DeepSeek API wrapper (calls via server proxy)

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callDeepSeek(messages: ChatMessage[]): Promise<string> {
  const response = await fetch("/api/deepseek/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
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
      content: `You are a professional video storyboard scriptwriter. Based on the provided product information and knowledge base content, generate a detailed video storyboard script.
Output format is a JSON array, where each element contains:
- sceneNumber: scene number
- duration: suggested duration (e.g. "5s")
- visual: visual description
- narration: voiceover/narration text
- notes: production notes

Please generate a complete script with 5-8 scenes.`,
    },
    {
      role: "user",
      content: `Product info: ${productInfo}\n\nKnowledge base reference: ${knowledgeContext}${style ? `\n\nStyle requirements: ${style}` : ""}`,
    },
  ];

  return callDeepSeek(messages);
}

export async function generateVideoScript(storyboard: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are a video production expert. Based on the storyboard script, generate a detailed video production guide including:
1. Specific shooting/production suggestions for each scene
2. Transition effect suggestions
3. Background music style suggestions
4. Overall pacing guidance
5. Post-production suggestions

Please output in a clear structured format.`,
    },
    {
      role: "user",
      content: `Please generate a video production guide based on the following storyboard script:\n\n${storyboard}`,
    },
  ];

  return callDeepSeek(messages);
}
