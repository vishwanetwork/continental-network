// 视频生成 - 通过本地API路由代理Replicate请求（避免CORS）

export interface VideoGenResponse {
  id: string;
  status: string;
  video_url?: string;
  error?: string;
}

// 提交视频生成任务
export async function submitVideoGeneration(prompt: string): Promise<string> {
  const response = await fetch("/api/video/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `视频生成API错误: ${response.status}`);
  }

  const data = await response.json();
  return data.id || "";
}

// 查询视频生成状态
export async function queryVideoStatus(requestId: string): Promise<VideoGenResponse> {
  const response = await fetch("/api/video/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: requestId }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `查询视频状态失败: ${response.status}`);
  }

  const data = await response.json();
  return {
    id: requestId,
    status: data.status === "SUCCESS" ? "Succeed" : data.status === "FAIL" ? "Failed" : "InProgress",
    video_url: data.video_url,
    error: data.error,
  };
}

// 一站式：提交并轮询等待结果
export async function generateVideo(
  prompt: string,
  onProgress?: (status: string) => void
): Promise<string> {
  onProgress?.("提交视频生成任务到智谱...");
  const requestId = await submitVideoGeneration(prompt);

  if (!requestId) throw new Error("未获取到任务ID");

  onProgress?.(`任务已提交 (ID: ${requestId})，等待生成...`);

  // 轮询等待结果（最多10分钟）
  const maxAttempts = 120;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const result = await queryVideoStatus(requestId);
    onProgress?.(`状态: ${result.status} (已等待 ${(i + 1) * 5}秒)`);

    if (result.status === "Succeed") {
      if (result.video_url) return result.video_url;
      throw new Error("视频生成完成但未返回URL");
    }

    if (result.status === "Failed") {
      throw new Error(result.error || "视频生成失败");
    }
  }

  throw new Error("视频生成超时（等待超过10分钟），请稍后重试");
}
