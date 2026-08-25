"use client";

import { useState, useEffect } from "react";
import { useCurrentUser } from "./AuthGuard";

interface Agent {
  id: string;
  name: string;
  description: string;
  type: string;
  input_format: string;
  output_format: string;
  provider: string;
  rating?: number;
  user_rating?: number | null;
  canEdit?: boolean;
}

type AgentTab = "all" | "shared";

interface Props {
  organizationId: string;
}

export default function AgentBrowser({ organizationId }: Props) {
  const currentUser = useCurrentUser();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDeleteAgentId, setConfirmDeleteAgentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AgentTab>("all");

  // Share
  const [showShare, setShowShare] = useState(false);
  const [shareEmail, setShareEmail] = useState("");

  // Rating
  const [hoverStar, setHoverStar] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState(false);

  // Chat
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  // Edit
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] = useState("");
  const [editProvider, setEditProvider] = useState("");
  const [editOutputFormat, setEditOutputFormat] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editVisibility, setEditVisibility] = useState("department");
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState("");
  const [formProvider, setFormProvider] = useState("deepseek");
  const [formPrompt, setFormPrompt] = useState("");
  const [formOutputFormat, setFormOutputFormat] = useState("text");
  const [formVisibility, setFormVisibility] = useState("department");

  const loadAgents = async () => {
    try {
      let url = "/api/agents";
      if (currentUser) {
        url += `?userId=${currentUser.id}&organizationId=${organizationId}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) setAgents(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadAgents(); }, []);

  const loadChatHistory = async (agentId: string) => {
    // Don't load from DB — chat is session-only
    setChatMessages([]);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !selectedId || chatSending) return;
    const msg = chatInput.trim();
    setChatInput("");
    const newMessages = [...chatMessages, { role: "user", content: msg }];
    setChatMessages(newMessages);
    setChatSending(true);
    try {
      const res = await fetch(`/api/agents/${selectedId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: msg, history: chatMessages }),
      });
      if (res.ok) {
        const data = await res.json();
        // Check if it's a video generation task
        try {
          const parsed = JSON.parse(data.reply);
          if (parsed.type === "video_pending" && parsed.taskId) {
            setChatMessages((prev) => [...prev, { role: "assistant", content: `🎬 Video generating... prompt: "${parsed.prompt}"\n⏳ Please wait, polling for result...` }]);
            setChatSending(false);
            // Poll for video status
            pollVideoStatus(parsed.taskId);
            return;
          }
        } catch { /* not JSON, normal reply */ }
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch { /* ignore */ }
    setChatSending(false);
  };

  const pollVideoStatus = async (taskId: string) => {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const res = await fetch("/api/video/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: taskId }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data.status === "SUCCESS" && data.video_url) {
          setChatMessages((prev) => {
            const updated = [...prev];
            // Replace the last "generating" message with the video URL
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].content.includes("⏳")) {
              updated[lastIdx] = { role: "assistant", content: data.video_url };
            } else {
              updated.push({ role: "assistant", content: data.video_url });
            }
            return updated;
          });
          return;
        }
        if (data.status === "FAIL") {
          setChatMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].content.includes("⏳")) {
              updated[lastIdx] = { role: "assistant", content: `❌ Video generation failed: ${data.error || "Unknown error"}` };
            }
            return updated;
          });
          return;
        }
        // Still processing — update progress indicator
        setChatMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].content.includes("⏳")) {
            const elapsed = (i + 1) * 5;
            updated[lastIdx] = { role: "assistant", content: `🎬 Video generating...\n⏳ ${elapsed}s elapsed, still processing...` };
          }
          return [...updated];
        });
      } catch { /* ignore polling errors */ }
    }
    // Timeout
    setChatMessages((prev) => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (lastIdx >= 0 && updated[lastIdx].content.includes("⏳")) {
        updated[lastIdx] = { role: "assistant", content: "❌ Video generation timed out. Please try again." };
      }
      return updated;
    });
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formType.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim(),
          type: formType.trim(),
          inputFormat: "text",
          outputFormat: formOutputFormat,
          provider: formProvider,
          systemPrompt: formPrompt.trim(),
          visibility: formVisibility,
          organizationId,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setFormName(""); setFormDesc(""); setFormType(""); setFormPrompt(""); setFormOutputFormat("text"); setFormVisibility("department");
        await loadAgents();
      }
    } catch { /* ignore */ }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteAgentId(null);
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId(null);
    await loadAgents();
  };

  const openEdit = (agent: Agent) => {
    setEditName(agent.name);
    setEditDesc(agent.description);
    setEditType(agent.type);
    setEditProvider(agent.provider);
    setEditOutputFormat(agent.output_format || "text");
    setEditPrompt("");
    setEditVisibility("department");
    // Fetch current visibility
    fetch(`/api/agents/${agent.id}/permissions`, { credentials: "include" })
      .then((r) => r.json())
      .then((perms) => {
        if (Array.isArray(perms) && perms.some((p: { target_type: string }) => p.target_type === "all")) {
          setEditVisibility("all");
        } else {
          setEditVisibility("department");
        }
      })
      .catch(() => {});
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!selectedId) return;
    const body: Record<string, string> = {};
    if (editName.trim()) body.name = editName.trim();
    if (editDesc !== undefined) body.description = editDesc.trim();
    if (editType.trim()) body.type = editType.trim();
    if (editOutputFormat) body.outputFormat = editOutputFormat;
    if (editProvider) body.provider = editProvider;
    if (editPrompt.trim()) body.systemPrompt = editPrompt.trim();
    body.visibility = editVisibility;
    body.organizationId = organizationId;
    
    const res = await fetch(`/api/agents/${selectedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Save failed");
      return;
    }
    setShowEdit(false);
    await loadAgents();
  };

  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /></div>;

  // Agents are already filtered by permissions on the backend
  const selected = agents.find((a) => a.id === selectedId);

  return (
    <div className="agent-browser-container">
      <div className="agent-browser-header">
        <div>
          <h2>Agents</h2>
          <p className="agent-browser-subtitle">AI capabilities available for your workflows</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Create Agent</button>
      </div>

      <div className="agent-browser-tabs">
        <button className={`tab-btn ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>All</button>
        <button className={`tab-btn ${activeTab === "shared" ? "active" : ""}`} onClick={() => setActiveTab("shared")}>Shared with me</button>
      </div>

      <div className="agent-grid">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`agent-browser-card ${selectedId === agent.id ? "selected" : ""}`}
            onClick={() => { setSelectedId(agent.id); setShowChat(false); setChatMessages([]); }}
          >
            <div className="agent-browser-card-header">
              <span className="agent-browser-name">{agent.name}</span>
              <span className="agent-browser-provider">{agent.provider}</span>
            </div>
            <p className="agent-browser-desc">{agent.description}</p>
            <div className="agent-browser-meta">
              <span>Type: {agent.type}</span>
              <span className="agent-rating">⭐ {agent.rating || 5.0}</span>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="agent-detail-panel">
          <div className="agent-detail-panel-header">
            <h3>{selected.name}</h3>
            <div style={{ display: "flex", gap: "6px" }}>
              <button className="btn-primary btn-small" onClick={() => { setShowChat(!showChat); if (!showChat) loadChatHistory(selected.id); }}>
                {showChat ? "Close Chat" : "💬 Chat"}
              </button>
              {selected.canEdit && <button className="btn-secondary btn-small" onClick={() => openEdit(selected)}>Edit</button>}
              {selected.canEdit && <button className="btn-secondary btn-small" onClick={() => setShowShare(true)}>Share</button>}
              {selected.canEdit && <button className="btn-danger btn-small" onClick={() => setConfirmDeleteAgentId(selected.id)}>Delete</button>}
            </div>
          </div>

          {showChat ? (
            <div className="agent-chat-panel">
              <div className="agent-chat-messages">
                {chatMessages.length === 0 && <div className="empty-state">Start a conversation with {selected.name}</div>}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-msg ${msg.role}`}>
                    <span className="chat-msg-role">{msg.role === "user" ? "You" : selected.name}</span>
                    {msg.role === "assistant" && selected.output_format === "code" && msg.content.includes("--- FILE:") && msg.content.length > 500 ? (
                      <div className="chat-msg-content">
                        <span style={{ color: "var(--green)", fontSize: 11 }}>📦 Generated project files</span>
                        <button className="btn-primary btn-small" style={{ marginTop: 8, display: "block" }} onClick={async () => {
                          const res = await fetch(`/api/agents/${selected.id}/chat/download`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ content: msg.content }),
                          });
                          if (res.ok) {
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url; a.download = `${selected.name}_output.zip`;
                            document.body.appendChild(a); a.click(); document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }
                        }}>📥 Download ZIP</button>
                      </div>
                    ) : msg.role === "assistant" && msg.content.match(/^https?:\/\/.*\.(mp4|webm|mov)/) ? (
                      <div className="chat-msg-content">
                        <video controls src={msg.content.trim()} style={{ width: "100%", maxHeight: 300, borderRadius: 4 }} />
                        <a href={msg.content.trim()} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-small" style={{ marginTop: 6, display: "inline-block" }}>Download Video ↗</a>
                      </div>
                    ) : (
                      <div className="chat-msg-content">{msg.content}</div>
                    )}
                  </div>
                ))}
                {chatSending && <div className="chat-msg assistant"><span className="chat-msg-role">{selected.name}</span><div className="chat-msg-content">Thinking...</div></div>}
              </div>
              <div className="agent-chat-input-bar">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Ask ${selected.name}...`}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendChat(); }}
                />
                <button className="btn-primary" onClick={handleSendChat} disabled={chatSending || !chatInput.trim()}>Send</button>
                <button className="btn-secondary btn-small" onClick={() => setChatMessages([])}>Clear</button>
              </div>
            </div>
          ) : (
            <>
              <div className="agent-detail-row"><span>Type</span><strong>{selected.type}</strong></div>
              <div className="agent-detail-row"><span>Provider</span><strong>{selected.provider}</strong></div>
              <div className="agent-detail-row"><span>Output Format</span><strong>{selected.output_format || "text"}</strong></div>
              <div className="agent-detail-row"><span>Description</span><strong>{selected.description}</strong></div>
              {<div className="agent-detail-row"><span>Rating</span><strong>⭐ {selected.rating || 5.0}</strong></div>}
              <div className="agent-detail-row">
                <span>Your Rating</span>
                {selected.user_rating != null ? (
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} style={{ fontSize: 16, color: star <= selected.user_rating! ? "var(--warning)" : "var(--muted)" }}>★</span>
                    ))}
                    <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>Already rated</span>
                  </div>
                ) : ratingLoading ? (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Submitting...</span>
                ) : ratingSuccess ? (
                  <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Rating submitted!</span>
                ) : (
                  <div style={{ display: "flex", gap: "2px", alignItems: "center" }} onMouseLeave={() => setHoverStar(0)}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        style={{
                          background: "none", border: "none", cursor: "pointer", fontSize: 18,
                          color: star <= hoverStar ? "var(--warning)" : "var(--muted)",
                          transition: "color 0.15s, transform 0.15s",
                          transform: star <= hoverStar ? "scale(1.2)" : "scale(1)",
                        }}
                        onMouseEnter={() => setHoverStar(star)}
                        onClick={async () => {
                          setRatingLoading(true);
                          const res = await fetch(`/api/agents/${selected.id}/rate`, {
                            method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                            body: JSON.stringify({ score: star }),
                          });
                          setRatingLoading(false);
                          if (res.ok) {
                            setRatingSuccess(true);
                            setTimeout(() => setRatingSuccess(false), 2000);
                            await loadAgents();
                          } else {
                            const err = await res.json().catch(() => ({}));
                            if (res.status === 409) alert("You have already rated this agent");
                          }
                        }}
                      >★</button>
                    ))}
                    {hoverStar > 0 && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>{hoverStar} / 5</span>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Agent</h3>
            <div className="form-group">
              <label>Name</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. SEO Writer" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="What does this agent do?" />
            </div>
            <div className="form-group">
              <label>Type / Role</label>
              <input value={formType} onChange={(e) => setFormType(e.target.value)} placeholder="e.g. seo-writing, data-analysis" />
            </div>
            <div className="form-group">
              <label>Provider</label>
              <select value={formProvider} onChange={(e) => setFormProvider(e.target.value)}>
                <option value="deepseek">DeepSeek (Text)</option>
                <option value="zhipu">Zhipu (Video)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Output Format</label>
              <select value={formOutputFormat} onChange={(e) => setFormOutputFormat(e.target.value)}>
                <option value="text">Text (documents, reports)</option>
                <option value="code">Code (downloadable project zip)</option>
                <option value="json">JSON (structured data)</option>
                <option value="video-url">Video (AI generated)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Visibility</label>
              <select value={formVisibility} onChange={(e) => setFormVisibility(e.target.value)}>
                <option value="department">My department only</option>
                <option value="all">All members</option>
              </select>
            </div>
            <div className="form-group">
              <label>System Prompt (instructions for the AI)</label>
              <textarea value={formPrompt} onChange={(e) => setFormPrompt(e.target.value)} placeholder="You are a..." rows={4} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate} disabled={creating || !formName.trim() || !formType.trim()}>
                {creating ? "Creating..." : "Create Agent"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteAgentId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteAgentId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Agent</h3>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "12px 0" }}>Are you sure you want to delete this agent?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteAgentId(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDelete(confirmDeleteAgentId)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showShare && selected && (
        <div className="modal-overlay" onClick={() => setShowShare(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Share Agent</h3>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "8px 0 16px" }}>Share "{selected.name}" with a team member by email.</p>
            <div className="form-group">
              <label>Member Email</label>
              <input value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} placeholder="member@example.com" type="email" />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowShare(false)}>Cancel</button>
              <button className="btn-primary" onClick={async () => {
                if (!shareEmail.trim()) return;
                await fetch(`/api/agents/${selected.id}/share`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ targetUserId: shareEmail.trim(), organizationId: "" }),
                });
                setShowShare(false);
                setShareEmail("");
              }}>Share</button>
            </div>
          </div>
        </div>
      )}

      {showEdit && selected && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Agent</h3>
            <div className="form-group">
              <label>Name</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Type / Role</label>
              <input value={editType} onChange={(e) => setEditType(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Provider</label>
              <select value={editProvider} onChange={(e) => setEditProvider(e.target.value)}>
                <option value="deepseek">DeepSeek (Text)</option>
                <option value="zhipu">Zhipu (Video)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Output Format</label>
              <select value={editOutputFormat} onChange={(e) => setEditOutputFormat(e.target.value)}>
                <option value="text">Text</option>
                <option value="code">Code (zip)</option>
                <option value="json">JSON</option>
                <option value="video-url">Video</option>
              </select>
            </div>
            <div className="form-group">
              <label>Visibility</label>
              <select value={editVisibility} onChange={(e) => setEditVisibility(e.target.value)}>
                <option value="department">My department only</option>
                <option value="all">All members</option>
              </select>
            </div>
            <div className="form-group">
              <label>System Prompt (leave empty to keep current)</label>
              <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="Leave empty to keep existing prompt..." rows={3} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
