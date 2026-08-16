const ZHIPU_API_KEY = "d489701e4336444ebb9395768ffdd99f.h39snDknPHTUvV7B";
const ZHIPU_BASE = "https://open.bigmodel.cn/api/paas/v4";

export async function POST(request: Request) {
  try {
    const { prompt } = (await request.json()) as { prompt?: string };
    if (!prompt?.trim()) {
      return Response.json({ error: "prompt is required" }, { status: 400 });
    }

    const response = await fetch(`${ZHIPU_BASE}/videos/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: "cogvideox-3",
        prompt: prompt.trim(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `智谱API错误: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error?.message || errorJson.message || errorMsg;
      } catch {
        errorMsg += ` - ${errorText}`;
      }
      return Response.json({ error: errorMsg }, { status: 500 });
    }

    const data = await response.json();
    // 智谱返回 task_id 用于异步查询
    const taskId = data.id || data.task_id || "";
    return Response.json({ id: taskId });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "提交失败" }, { status: 500 });
  }
}
