"use client";

import { useState, useEffect } from "react";
import type { Agent, Department, Member, KnowledgeBase } from "../types";
import {
  getAgents, addAgent, deleteAgent, assignAgent, unassignAgent,
  getDepartments, getMembers, getKnowledgeBases,
} from "../store";
import { generateStoryboard, generateVideoScript } from "../lib/deepseek";
import { generateVideo } from "../lib/video-gen";
import { useCurrentUser } from "./AuthGuard";
import { getVisibleAgentIds } from "./RoomsManager";

// 读取 Rooms 数据判断 agent 可见性 — 已移至 RoomsManager

export default function AgentManager() {
  const currentUser = useCurrentUser();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newAgentForm, setNewAgentForm] = useState({
    name: "", description: "", type: "custom" as Agent["type"], capabilities: "",
  });
  const [assignType, setAssignType] = useState<"member" | "department">("department");
  const [assignTargetId, setAssignTargetId] = useState("");

  // 演示状态
  const [showDemo, setShowDemo] = useState(false);
  const [demoInput, setDemoInput] = useState("");
  const [demoStyle, setDemoStyle] = useState("");
  const [demoKBId, setDemoKBId] = useState("");
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoResult, setDemoResult] = useState("");
  const [demoError, setDemoError] = useState("");
  const [demoProgress, setDemoProgress] = useState("");
  const [demoVideoUrl, setDemoVideoUrl] = useState("");
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);

  const loadData = async () => {
    setLoading(true);
    const [a, d, m] = await Promise.all([getAgents(), getDepartments(), getMembers()]);
    setAgents(a);
    setDepartments(d);
    setMembers(m);
    setKnowledgeBases(getKnowledgeBases());
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const allDeptsFlatList = (): Department[] => {
    const flat: Department[] = [];
    const traverse = (depts: Department[]) => {
      for (const d of depts) { flat.push(d); if (d.children) traverse(d.children); }
    };
    traverse(departments);
    return flat;
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const handleAddAgent = async () => {
    if (!newAgentForm.name.trim()) return;
    const id = `agent-${Date.now()}`;
    await addAgent({
      id,
      name: newAgentForm.name.trim(),
      description: newAgentForm.description.trim(),
      type: newAgentForm.type,
      capabilities: newAgentForm.capabilities.split(",").map((c) => c.trim()).filter(Boolean),
      status: "active",
    });
    setNewAgentForm({ name: "", description: "", type: "custom", capabilities: "" });
    setShowAddAgent(false);
    await loadData();
    setSelectedAgentId(id);
  };

  const handleDeleteAgent = async (agentId: string) => {
    await deleteAgent(agentId);
    if (selectedAgentId === agentId) setSelectedAgentId(null);
    await loadData();
  };

  const handleAssign = async () => {
    if (!selectedAgentId || !assignTargetId) return;
    let targetName = "";
    if (assignType === "department") {
      targetName = allDeptsFlatList().find((d) => d.id === assignTargetId)?.name || "";
    } else {
      targetName = members.find((m) => m.id === assignTargetId)?.name || "";
    }
    await assignAgent(selectedAgentId, assignType, assignTargetId, targetName);
    setShowAssign(false);
    setAssignTargetId("");
    await loadData();
  };

  const handleRemoveAssignment = async (agentId: string, targetId: string) => {
    await unassignAgent(agentId, targetId);
    await loadData();
  };

  const handleRunDemo = async () => {
    if (!selectedAgent || !demoInput.trim()) return;
    setDemoError("");
    setDemoRunning(true);
    setDemoResult("");
    setDemoProgress("");
    setDemoVideoUrl("");
    try {
      let kbContext = "";
      if (demoKBId) {
        const kb = knowledgeBases.find((k) => k.id === demoKBId);
        if (kb) kbContext = kb.documents.map((d) => d.content).join("\n\n");
      }

      if (selectedAgent.type === "video-generator") {
        // 真正生成视频
        setDemoProgress("正在调用视频生成API...");
        const videoUrl = await generateVideo(demoInput, (status) => setDemoProgress(status));
        setDemoVideoUrl(videoUrl);
        setDemoResult("✅ 视频生成完成！");
      } else if (selectedAgent.type === "storyboard-generator") {
        const result = await generateStoryboard(demoInput, kbContext, demoStyle);
        setDemoResult(result);
      } else {
        const result = await generateStoryboard(demoInput, kbContext, demoStyle);
        setDemoResult(result);
      }
    } catch (err: unknown) {
      setDemoError(err instanceof Error ? err.message : "执行失败");
    } finally {
      setDemoRunning(false);
      setDemoProgress("");
    }
  };

  const getAgentTypeLabel = (type: Agent["type"]) => {
    const labels: Record<Agent["type"], string> = {
      "weibo-publisher": "微博发布", "video-generator": "视频生成",
      "storyboard-generator": "分镜头脚本", "content-writer": "内容写作", custom: "自定义",
    };
    return labels[type];
  };

  const getStatusColor = (status: Agent["status"]) => {
    if (status === "active") return "#00ff88";
    if (status === "maintenance") return "#ffaa00";
    return "#ff4444";
  };

  if (loading) return <div className="empty-state">加载中...</div>;

  return (
    <div className="agent-container">
      <div className="agent-header">
        <h2>Agent 管理</h2>
        <button className="btn-primary" onClick={() => setShowAddAgent(true)}>+ 创建 Agent</button>
      </div>

      <div className="agent-content">
        <div className="agent-list">
          <div className="panel-title">Agent 列表</div>
          {(() => {
            const visibility = currentUser ? getVisibleAgentIds(currentUser.email, members) : "all";
            const visibleAgents = visibility === "all" ? agents : agents.filter((a) => visibility.has(a.id));
            return visibleAgents.map((agent) => (
            <div key={agent.id} className={`agent-card ${selectedAgentId === agent.id ? "selected" : ""}`}
              onClick={() => { setSelectedAgentId(agent.id); setShowDemo(false); setDemoResult(""); setDemoInput(""); setDemoStyle(""); setDemoKBId(""); setDemoError(""); }}>
              <div className="agent-card-header">
                <span className="agent-name">{agent.name}</span>
                <span className="agent-status" style={{ color: getStatusColor(agent.status) }}>●</span>
              </div>
              <div className="agent-card-meta">
                <span className="agent-type-badge">{getAgentTypeLabel(agent.type)}</span>
                <span className="agent-assign-count">{agent.assignedTo.length} 个分配</span>
              </div>
            </div>
          ));
          })()}
          {agents.length === 0 && <div className="empty-state">暂无 Agent，点击上方按钮创建</div>}
        </div>

        <div className="agent-detail">
          {selectedAgent ? (
            <>
              <div className="agent-detail-header">
                <h3>{selectedAgent.name}</h3>
                <div className="agent-detail-actions">
                  <button className="btn-secondary" onClick={() => setShowAssign(true)}>关联组织</button>
                  <button className="btn-secondary" onClick={() => setShowDemo(!showDemo)}>
                    {showDemo ? "收起演示" : "⚡ 试用"}
                  </button>
                  <button className="btn-danger" onClick={() => handleDeleteAgent(selectedAgent.id)}>删除</button>
                </div>
              </div>

              <div className="agent-detail-section">
                <div className="detail-label">描述</div>
                <div className="detail-value">{selectedAgent.description}</div>
              </div>
              <div className="agent-detail-section">
                <div className="detail-label">类型</div>
                <div className="detail-value">{getAgentTypeLabel(selectedAgent.type)}</div>
              </div>
              <div className="agent-detail-section">
                <div className="detail-label">能力</div>
                <div className="capability-tags">
                  {selectedAgent.capabilities.map((cap) => (<span key={cap} className="capability-tag">{cap}</span>))}
                </div>
              </div>
              <div className="agent-detail-section">
                <div className="detail-label">关联组织架构</div>
                <div className="assignment-list">
                  {selectedAgent.assignedTo.map((assign) => (
                    <div key={assign.targetId} className="assignment-item">
                      <span className="assignment-icon">{assign.targetType === "department" ? "🏢" : "👤"}</span>
                      <span className="assignment-name">{assign.targetName}</span>
                      <span className="assignment-type">{assign.targetType === "department" ? "部门" : "个人"}</span>
                      <button className="assignment-remove" onClick={() => handleRemoveAssignment(selectedAgent.id, assign.targetId)}>×</button>
                    </div>
                  ))}
                  {selectedAgent.assignedTo.length === 0 && <div className="empty-state">未关联任何组织，点击"关联组织"按钮添加</div>}
                </div>
              </div>

              {showDemo && (
                <div className="agent-demo-section">
                  <div className="detail-label">⚡ 工作流演示</div>
                  {demoError && <div className="error-banner">{demoError}</div>}
                  <div className="form-group">
                    <label>{selectedAgent.type === "video-generator" ? "视频描述（将直接生成视频）" : "产品/主题描述"}</label>
                    <textarea value={demoInput} onChange={(e) => setDemoInput(e.target.value)}
                      placeholder={selectedAgent.type === "video-generator" ? "描述你要生成的视频画面，例如：一个科技感的蓝色粒子汇聚成AI平台Logo..." : "描述产品或主题..."} rows={4} />
                  </div>
                  {selectedAgent.type !== "video-generator" && (
                    <>
                      <div className="form-group">
                        <label>知识库（可选）</label>
                        <select value={demoKBId} onChange={(e) => setDemoKBId(e.target.value)}>
                          <option value="">不使用</option>
                          {knowledgeBases.map((kb) => (<option key={kb.id} value={kb.id}>{kb.name}</option>))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>风格（可选）</label>
                        <input value={demoStyle} onChange={(e) => setDemoStyle(e.target.value)} placeholder="科技感、简洁..." />
                      </div>
                    </>
                  )}
                  <button className="btn-primary" onClick={handleRunDemo} disabled={demoRunning}>
                    {demoRunning ? "⏳ 执行中..." : selectedAgent.type === "video-generator" ? "🎬 生成视频" : "▶ 执行工作流"}
                  </button>
                  {demoProgress && <div className="demo-progress">⏳ {demoProgress}</div>}
                  {demoVideoUrl && (
                    <div className="video-result" style={{ marginTop: 16 }}>
                      <div className="result-header">🎬 生成的视频</div>
                      <video controls src={demoVideoUrl} style={{ width: "100%", maxHeight: 400, marginTop: 8, borderRadius: 4 }} />
                      <a href={demoVideoUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ marginTop: 8, display: "inline-block" }}>
                        下载视频
                      </a>
                    </div>
                  )}
                  {demoResult && !demoVideoUrl && (
                    <div className="workflow-result" style={{ marginTop: 16 }}>
                      <div className="result-header">执行结果</div>
                      <pre className="result-content">{demoResult}</pre>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">← 选择一个 Agent 查看详情</div>
          )}
        </div>
      </div>

      {showAddAgent && (
        <div className="modal-overlay" onClick={() => setShowAddAgent(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>创建 Agent</h3>
            <div className="form-group"><label>名称</label><input value={newAgentForm.name} onChange={(e) => setNewAgentForm({ ...newAgentForm, name: e.target.value })} placeholder="Agent 名称" /></div>
            <div className="form-group"><label>描述</label><input value={newAgentForm.description} onChange={(e) => setNewAgentForm({ ...newAgentForm, description: e.target.value })} placeholder="Agent 描述" /></div>
            <div className="form-group"><label>类型</label>
              <select value={newAgentForm.type} onChange={(e) => setNewAgentForm({ ...newAgentForm, type: e.target.value as Agent["type"] })}>
                <option value="storyboard-generator">分镜头脚本生成</option>
                <option value="video-generator">视频生成</option>
                <option value="weibo-publisher">微博发布</option>
                <option value="content-writer">内容写作</option>
                <option value="custom">自定义</option>
              </select>
            </div>
            <div className="form-group"><label>能力（逗号分隔）</label><input value={newAgentForm.capabilities} onChange={(e) => setNewAgentForm({ ...newAgentForm, capabilities: e.target.value })} placeholder="知识库检索, 内容生成, ..." /></div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddAgent(false)}>取消</button>
              <button className="btn-primary" onClick={handleAddAgent}>创建</button>
            </div>
          </div>
        </div>
      )}

      {showAssign && (
        <div className="modal-overlay" onClick={() => setShowAssign(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>关联到组织架构</h3>
            <div className="form-group"><label>关联类型</label>
              <select value={assignType} onChange={(e) => { setAssignType(e.target.value as "member" | "department"); setAssignTargetId(""); }}>
                <option value="department">部门</option>
                <option value="member">个人</option>
              </select>
            </div>
            <div className="form-group"><label>{assignType === "department" ? "选择部门" : "选择成员"}</label>
              <select value={assignTargetId} onChange={(e) => setAssignTargetId(e.target.value)}>
                <option value="">请选择</option>
                {assignType === "department"
                  ? allDeptsFlatList().map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))
                  : members.map((m) => (<option key={m.id} value={m.id}>{m.name} ({m.role})</option>))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAssign(false)}>取消</button>
              <button className="btn-primary" onClick={handleAssign}>确认关联</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
