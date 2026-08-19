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
      let errorMsg = `Query status failed: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error?.message || errorJson.message || errorMsg;
      } catch {
        errorMsg += ` - ${errorText}`;
      }
      return Response.json({ error: errorMsg }, { status: 500 });
    }

    const data = await response.json();

    // Zhipu async result format: task_status is SUCCESS/PROCESSING/FAIL
    let videoUrl: string | undefined;
    if (data.task_status === "SUCCESS") {
      // Video result is in video_result
      const results = data.video_result || data.data?.video_result;
      if (results && results.length > 0) {
        videoUrl = results[0].url;
      }
    }

    return Response.json({
      id,
      status: data.task_status,
      video_url: videoUrl,
      error: data.task_status === "FAIL" ? (data.message || "Generation failed") : undefined,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Query failed" }, { status: 500 });
  }
}
