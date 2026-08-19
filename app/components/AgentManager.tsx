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

// Agent visibility logic — moved to RoomsManager

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

  // Demo state
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

  const [confirmDeleteAgent, setConfirmDeleteAgent] = useState<string | null>(null);
  const [operating, setOperating] = useState(false);

  const loadData = async () => {
    const [a, d, m] = await Promise.all([getAgents(), getDepartments(), getMembers()]);
    setAgents(a);
    setDepartments(d);
    // Only keep members that belong to an existing department
    const deptIds = new Set<string>();
    const collectIds = (depts: Department[]) => {
      for (const dept of depts) { deptIds.add(dept.id); if (dept.children) collectIds(dept.children); }
    };
    collectIds(d);
    setMembers(m.filter((member) => deptIds.has(member.departmentId)));
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
    setOperating(true);
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
    setOperating(false);
  };

  const handleDeleteAgent = async (agentId: string) => {
    setOperating(true);
    await deleteAgent(agentId);
    if (selectedAgentId === agentId) setSelectedAgentId(null);
    setConfirmDeleteAgent(null);
    await loadData();
    setOperating(false);
  };

  const handleAssign = async () => {
    if (!selectedAgentId || !assignTargetId) return;
    setOperating(true);
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
    setOperating(false);
  };

  const handleRemoveAssignment = async (agentId: string, targetId: string) => {
    setOperating(true);
    await unassignAgent(agentId, targetId);
    await loadData();
    setOperating(false);
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
        // Direct video generation from prompt
        setDemoProgress("Calling video generation API...");
        const videoUrl = await generateVideo(demoInput, (status) => setDemoProgress(status));
        setDemoVideoUrl(videoUrl);
        setDemoResult("✅ Video generation complete!");
      } else if (selectedAgent.type === "storyboard-generator") {
        // Generate storyboard script only (no video)
        setDemoProgress("Generating storyboard script...");
        const storyboard = await generateStoryboard(demoInput, kbContext, demoStyle);
        setDemoResult(storyboard);
      } else {
        // All other types: generate video directly
        setDemoProgress("Generating video...");
        const videoUrl = await generateVideo(demoInput, (status) => setDemoProgress(status));
        setDemoVideoUrl(videoUrl);
        setDemoResult("✅ Video generation complete!");
      }
    } catch (err: unknown) {
      setDemoError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setDemoRunning(false);
      setDemoProgress("");
    }
  };

  const getAgentTypeLabel = (type: Agent["type"]) => {
    const labels: Record<Agent["type"], string> = {
      "weibo-publisher": "Weibo Publisher", "video-generator": "Video Generator",
      "storyboard-generator": "Storyboard", "content-writer": "Content Writer", custom: "Custom",
    };
    return labels[type];
  };

  const getStatusColor = (status: Agent["status"]) => {
    if (status === "active") return "#00ff88";
    if (status === "maintenance") return "#ffaa00";
    return "#ff4444";
  };

  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /></div>;

  return (
    <div className="agent-container">
      {operating && <div className="loading-overlay"><div className="loading-spinner" /></div>}
      <div className="agent-header">
        <h2>Agent Management</h2>
        <button className="btn-primary" onClick={() => setShowAddAgent(true)}>+ Create Agent</button>
      </div>

      <div className="agent-content">
        <div className="agent-list">
          <div className="panel-title">Agent List</div>
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
                <span className="agent-assign-count">{agent.assignedTo.length} assignments</span>
              </div>
            </div>
          ));
          })()}
          {agents.length === 0 && <div className="empty-state">No Agents yet. Click above to create one.</div>}
        </div>

        <div className="agent-detail">
          {selectedAgent ? (
            <>
              <div className="agent-detail-header">
                <h3>{selectedAgent.name}</h3>
                <div className="agent-detail-actions">
                  <button className="btn-secondary" onClick={() => setShowAssign(true)}>Link to Org</button>
                  <button className="btn-secondary" onClick={() => setShowDemo(!showDemo)}>
                    {showDemo ? "Hide Demo" : "⚡ Try It"}
                  </button>
                  <button className="btn-danger" onClick={() => setConfirmDeleteAgent(selectedAgent.id)}>Delete</button>
                </div>
              </div>

              <div className="agent-detail-section">
                <div className="detail-label">Description</div>
                <div className="detail-value">{selectedAgent.description}</div>
              </div>
              <div className="agent-detail-section">
                <div className="detail-label">Type</div>
                <div className="detail-value">{getAgentTypeLabel(selectedAgent.type)}</div>
              </div>
              <div className="agent-detail-section">
                <div className="detail-label">Capabilities</div>
                <div className="capability-tags">
                  {selectedAgent.capabilities.map((cap) => (<span key={cap} className="capability-tag">{cap}</span>))}
                </div>
              </div>
              <div className="agent-detail-section">
                <div className="detail-label">Organization Links</div>
                <div className="assignment-list">
                  {selectedAgent.assignedTo.map((assign) => (
                    <div key={assign.targetId} className="assignment-item">
                      <span className="assignment-icon">{assign.targetType === "department" ? "🏢" : "👤"}</span>
                      <span className="assignment-name">{assign.targetName}</span>
                      <span className="assignment-type">{assign.targetType === "department" ? "Department" : "Individual"}</span>
                      <button className="assignment-remove" onClick={() => handleRemoveAssignment(selectedAgent.id, assign.targetId)}>×</button>
                    </div>
                  ))}
                  {selectedAgent.assignedTo.length === 0 && <div className="empty-state">Not linked to any org. Click "Link to Org" to add.</div>}
                </div>
              </div>

              {showDemo && (
                <div className="agent-demo-section">
                  <div className="detail-label">⚡ Workflow Demo</div>
                  {demoError && <div className="error-banner">{demoError}</div>}
                  <div className="form-group">
                    <label>{selectedAgent.type === "video-generator" ? "Video description (will generate video)" : "Product/topic description"}</label>
                    <textarea value={demoInput} onChange={(e) => setDemoInput(e.target.value)}
                      placeholder={selectedAgent.type === "video-generator" ? "Describe the video scene you want to generate..." : "Describe the product or topic..."} rows={4} />
                  </div>
                  {selectedAgent.type !== "video-generator" && (
                    <>
                      <div className="form-group">
                        <label>Knowledge Base (optional)</label>
                        <select value={demoKBId} onChange={(e) => setDemoKBId(e.target.value)}>
                          <option value="">None</option>
                          {knowledgeBases.map((kb) => (<option key={kb.id} value={kb.id}>{kb.name}</option>))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Style (optional)</label>
                        <input value={demoStyle} onChange={(e) => setDemoStyle(e.target.value)} placeholder="Tech, minimalist..." />
                      </div>
                    </>
                  )}
                  <button className="btn-primary" onClick={handleRunDemo} disabled={demoRunning}>
                    {demoRunning ? "⏳ Running..." : selectedAgent.type === "video-generator" ? "🎬 Generate Video" : "▶ Run Workflow"}
                  </button>
                  {demoProgress && <div className="demo-progress">⏳ {demoProgress}</div>}
                  {demoVideoUrl && (
                    <div className="video-result" style={{ marginTop: 16 }}>
                      <div className="result-header">🎬 Generated Video</div>
                      <video controls src={demoVideoUrl} style={{ width: "100%", maxHeight: 400, marginTop: 8, borderRadius: 4 }} />
                      <a href={demoVideoUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ marginTop: 8, display: "inline-block" }}>
                        Download Video
                      </a>
                    </div>
                  )}
                  {demoResult && !demoVideoUrl && (
                    <div className="workflow-result" style={{ marginTop: 16 }}>
                      <div className="result-header">Execution Result</div>
                      <pre className="result-content">{demoResult}</pre>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">← Select an Agent to view details</div>
          )}
        </div>
      </div>

      {showAddAgent && (
        <div className="modal-overlay" onClick={() => setShowAddAgent(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Agent</h3>
            <div className="form-group"><label>Name</label><input value={newAgentForm.name} onChange={(e) => setNewAgentForm({ ...newAgentForm, name: e.target.value })} placeholder="Agent name" /></div>
            <div className="form-group"><label>Description</label><input value={newAgentForm.description} onChange={(e) => setNewAgentForm({ ...newAgentForm, description: e.target.value })} placeholder="Agent description" /></div>
            <div className="form-group"><label>Type</label>
              <select value={newAgentForm.type} onChange={(e) => setNewAgentForm({ ...newAgentForm, type: e.target.value as Agent["type"] })}>
                <option value="storyboard-generator">Storyboard Generator</option>
                <option value="video-generator">Video Generator</option>
                <option value="weibo-publisher">Weibo Publisher</option>
                <option value="content-writer">Content Writer</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="form-group"><label>Capabilities (comma-separated)</label><input value={newAgentForm.capabilities} onChange={(e) => setNewAgentForm({ ...newAgentForm, capabilities: e.target.value })} placeholder="Knowledge retrieval, content generation, ..." /></div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddAgent(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleAddAgent}>Create</button>
            </div>
          </div>
        </div>
      )}

      {showAssign && (
        <div className="modal-overlay" onClick={() => setShowAssign(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Link to Organization</h3>
            <div className="form-group"><label>Link Type</label>
              <select value={assignType} onChange={(e) => { setAssignType(e.target.value as "member" | "department"); setAssignTargetId(""); }}>
                <option value="department">Department</option>
                <option value="member">Individual</option>
              </select>
            </div>
            <div className="form-group"><label>{assignType === "department" ? "Select Department" : "Select Member"}</label>
              <select value={assignTargetId} onChange={(e) => setAssignTargetId(e.target.value)}>
                <option value="">Please select</option>
                {assignType === "department"
                  ? allDeptsFlatList().map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))
                  : members.map((m) => (<option key={m.id} value={m.id}>{m.name} ({m.role})</option>))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAssign(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleAssign}>Confirm Link</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteAgent && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteAgent(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this Agent? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteAgent(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDeleteAgent(confirmDeleteAgent)}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
