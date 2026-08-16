// 认证相关 API 封装
export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getGoogleLoginUrl(): Promise<string> {
  const res = await fetch("/api/auth/google");
  const data = await res.json();
  return data.url;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}
