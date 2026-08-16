const ZHIPU_API_KEY = "d489701e4336444ebb9395768ffdd99f.h39snDknPHTUvV7B";
const ZHIPU_BASE = "https://open.bigmodel.cn/api/paas/v4";

export async function POST(request: Request) {
  try {
    const { id } = (await request.json()) as { id?: string };
    if (!id?.trim()) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const response = await fetch(`${ZHIPU_BASE}/async-result/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ZHIPU_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `查询状态失败: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error?.message || errorJson.message || errorMsg;
      } catch {
        errorMsg += ` - ${errorText}`;
      }
      return Response.json({ error: errorMsg }, { status: 500 });
    }

    const data = await response.json();

    // 智谱异步结果格式：task_status 为 SUCCESS/PROCESSING/FAIL
    let videoUrl: string | undefined;
    if (data.task_status === "SUCCESS") {
      // 视频结果在 video_result 中
      const results = data.video_result || data.data?.video_result;
      if (results && results.length > 0) {
        videoUrl = results[0].url;
      }
    }

    return Response.json({
      id,
      status: data.task_status,
      video_url: videoUrl,
      error: data.task_status === "FAIL" ? (data.message || "生成失败") : undefined,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "查询失败" }, { status: 500 });
  }
}
