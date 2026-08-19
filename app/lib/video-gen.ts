// Video generation - proxy requests via local API route (avoid CORS)

export interface VideoGenResponse {
  id: string;
  status: string;
  video_url?: string;
  error?: string;
}

// Submit video generation task
export async function submitVideoGeneration(prompt: string): Promise<string> {
  const response = await fetch("/api/video/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Video generation API error: ${response.status}`);
  }

  const data = await response.json();
  return data.id || "";
}

// Query video generation status
export async function queryVideoStatus(requestId: string): Promise<VideoGenResponse> {
  const response = await fetch("/api/video/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: requestId }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Video status query failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    id: requestId,
    status: data.status === "SUCCESS" ? "Succeed" : data.status === "FAIL" ? "Failed" : "InProgress",
    video_url: data.video_url,
    error: data.error,
  };
}

// All-in-one: submit and poll for result
export async function generateVideo(
  prompt: string,
  onProgress?: (status: string) => void
): Promise<string> {
  onProgress?.("Submitting video generation task...");
  const requestId = await submitVideoGeneration(prompt);

  if (!requestId) throw new Error("Failed to get task ID");

  onProgress?.(`Task submitted (ID: ${requestId}), waiting...`);

  // Poll for result (max 10 minutes)
  const maxAttempts = 120;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const result = await queryVideoStatus(requestId);
    onProgress?.(`Status: ${result.status} (waited ${(i + 1) * 5}s)`);

    if (result.status === "Succeed") {
      if (result.video_url) return result.video_url;
      throw new Error("Video generation completed but no URL returned");
    }

    if (result.status === "Failed") {
      throw new Error(result.error || "Video generation failed");
    }
  }

  throw new Error("Video generation timed out (over 10 minutes), please try again later");
}
