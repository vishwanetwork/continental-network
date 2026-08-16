// API 调用封装 — 数据只从数据库读取，无 fallback
import type { Department, Member, Agent, KnowledgeBase } from "../types";

const API_BASE = "/api";

async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const res = await fetch(url, { ...options, signal: controller.signal });
  clearTimeout(timeout);
  return res;
}

// ============ 部门 ============
export async function getDepartments(): Promise<Department[]> {
  try {
    const res = await apiFetch(`${API_BASE}/departments`);
    if (!res.ok) return [];
    const rows = await res.json();
    return buildDeptTree(rows);
  } catch {
    return [];
  }
}

function buildDeptTree(rows: Array<{ id: string; name: string; parent_id?: string | null; parentId?: string | null; description?: string | null }>): Department[] {
  const map = new Map<string, Department>();
  const roots: Department[] = [];

  for (const row of rows) {
    const parentId = row.parent_id ?? row.parentId ?? null;
    map.set(row.id, {
      id: row.id,
      name: row.name,
      parentId,
      description: row.description || undefined,
      children: [],
    });
  }

  for (const dept of map.values()) {
    if (dept.parentId && map.has(dept.parentId)) {
      map.get(dept.parentId)!.children!.push(dept);
    } else {
      roots.push(dept);
    }
  }

  return roots;
}

export async function addDepartment(dept: { id: string; name: string; parentId: string | null; description?: string }): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dept),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateDepartment(id: string, name: string, description?: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/departments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, description }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteDepartment(id: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/departments?id=${id}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

// ============ 成员 ============
export async function getMembers(): Promise<Member[]> {
  try {
    const res = await apiFetch(`${API_BASE}/members`);
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map((r: { id: string; name: string; role: string; department_id?: string; departmentId?: string; email?: string }) => ({
      id: r.id, name: r.name, role: r.role, departmentId: r.department_id ?? r.departmentId, email: r.email,
    }));
  } catch {
    return [];
  }
}

export async function addMember(member: { id: string; name: string; role: string; departmentId: string; email?: string }): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(member),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteMember(id: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/members?id=${id}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

// ============ Agent ============
export async function getAgents(): Promise<Agent[]> {
  try {
    const res = await apiFetch(`${API_BASE}/agents`);
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id, name: r.name, description: r.description, type: r.type,
      capabilities: r.capabilities || [], status: r.status || "active",
      assignedTo: r.assignedTo || [], workflows: [],
    }));
  } catch {
    return [];
  }
}

export async function addAgent(agent: { id: string; name: string; description: string; type: string; capabilities: string[]; status: string }): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agent),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteAgent(id: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/agents?id=${id}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function assignAgent(agentId: string, targetType: string, targetId: string, targetName: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/agents/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, targetType, targetId, targetName }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function unassignAgent(agentId: string, targetId: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/agents/assign?agentId=${agentId}&targetId=${targetId}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

// ============ 知识库 ============
export function getKnowledgeBases(): KnowledgeBase[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem("continental_kb");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveKnowledgeBases(kbs: KnowledgeBase[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("continental_kb", JSON.stringify(kbs));
}
