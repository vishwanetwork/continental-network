// 组织架构类型
export interface Department {
  id: string;
  name: string;
  parentId: string | null;
  description?: string;
  children?: Department[];
  members?: Member[];
}

export interface Member {
  id: string;
  name: string;
  role: string;
  departmentId: string;
  avatar?: string;
  email?: string;
}

// Agent 类型
export interface Agent {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  capabilities: string[];
  status: "active" | "inactive" | "maintenance";
  assignedTo: AgentAssignment[];
  workflows: Workflow[];
}

export type AgentType =
  | "weibo-publisher"
  | "video-generator"
  | "storyboard-generator"
  | "content-writer"
  | "custom";

export interface AgentAssignment {
  targetType: "member" | "department";
  targetId: string;
  targetName: string;
}

// 工作流类型
export interface Workflow {
  id: string;
  name: string;
  agentId: string;
  steps: WorkflowStep[];
  status: "idle" | "running" | "completed" | "failed";
  lastRun?: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: "input" | "ai-process" | "output" | "human-review";
  config: Record<string, unknown>;
  status?: "pending" | "running" | "completed" | "failed";
}

// 知识库类型
export interface KnowledgeBase {
  id: string;
  name: string;
  documents: KBDocument[];
}

export interface KBDocument {
  id: string;
  name: string;
  content: string;
  type: "text" | "pdf" | "url";
  createdAt: string;
}

// 视频分镜头脚本
export interface Storyboard {
  id: string;
  title: string;
  product: string;
  scenes: StoryboardScene[];
  createdAt: string;
  status: "draft" | "final";
}

export interface StoryboardScene {
  sceneNumber: number;
  duration: string;
  visual: string;
  narration: string;
  notes?: string;
}
