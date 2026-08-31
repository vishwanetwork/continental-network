"use client";

import { useState, useEffect, useRef } from "react";
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

interface KnowledgeItem {
  id: string;
  agent_id: string;
  name: string;
  type: string;
  content: string;
  summary: string;
  created_at: string;
}

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
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [activeModelName, setActiveModelName] = useState<string>("");

  // Rating
  const [hoverStar, setHoverStar] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState(false);

  // Chat
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  // Knowledge feeding
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [feedName, setFeedName] = useState("");
  const [feedContent, setFeedContent] = useState("");
  const [feeding, setFeeding] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  // Edit
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] = useState("");
  const [editProvider, setEditProvider] = useState("");
  const [editOutputFormat, setEditOutputFormat] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editVisibility, setEditVisibility] = useState("department");

  // Permission assignment
  const [showPermissions, setShowPermissions] = useState(false);
  const [orgMembers, setOrgMembers] = useState<Array<{ user_id: string; name: string; email: string; department_id: string }>>([]);
  const [permittedUserIds, setPermittedUserIds] = useState<Set<string>>(new Set());
  const [agentCreatorId, setAgentCreatorId] = useState<string>("");
  const [savingPerms, setSavingPerms] = useState(false);

  // Create form
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

  // Fetch active AI model name
  useEffect(() => {
    fetch("/api/settings/ai-models/active", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { name: "" })
      .then((data) => setActiveModelName(data.name || ""))
      .catch(() => {});
  }, []);

  // Auto-scroll chat to bottom
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (showChat) scrollToBottom();
  }, [chatMessages, chatSending, showChat]);

  const loadChatHistory = async (agentId: string) => {
    setChatMessages([]); // Clear immediately to prevent stale data from previous agent
    try {
      const res = await fetch(`/api/agents/${agentId}/chat/history`, { credentials: "include" });
      if (res.ok) {
        const history = await res.json();
        setChatMessages(history.map((h: { role: string; content: string }) => ({ role: h.role, content: h.content })));
      }
    } catch { setChatMessages([]); }
  };

  const loadKnowledge = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge`, { credentials: "include" });
      if (res.ok) setKnowledgeItems(await res.json());
    } catch { setKnowledgeItems([]); }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !selectedId || chatSending) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: msg }]);
    setChatSending(true);
    try {
      const res = await fetch(`/api/agents/${selectedId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: msg }),
      });
      if (res.ok) {
        const data = await res.json();
        try {
          const parsed = JSON.parse(data.reply);
          if (parsed.type === "video_pending" && parsed.taskId) {
            setChatMessages((prev) => [...prev, { role: "assistant", content: `🎬 Generating video... prompt: "${parsed.prompt}"\n⏳ Please wait...` }]);
            setChatSending(false);
            pollVideoStatus(parsed.taskId);
            return;
          }
        } catch { /* not JSON */ }
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
              updated[lastIdx] = { role: "assistant", content: `❌ Video generation failed` };
            }
            return updated;
          });
          return;
        }
      } catch { /* ignore */ }
    }
  };

  const handleFeedKnowledge = async () => {
    if (!feedName.trim() || !feedContent.trim() || !selectedId) return;
    setFeeding(true);
    try {
      const res = await fetch(`/api/agents/${selectedId}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: feedName.trim(), type: "text", content: feedContent.trim(), organizationId }),
      });
      if (res.ok) {
        setFeedName("");
        setFeedContent("");
        await loadKnowledge(selectedId);
        showToast("success", "Knowledge fed successfully");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", data.error || "Feed failed");
      }
    } catch {
      showToast("error", "Feed failed, please retry");
    }
    setFeeding(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/agents/${selectedId}/knowledge/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        await loadKnowledge(selectedId);
        showToast("success", `Fed: ${data.fileName || file.name}`);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", data.error || "Feed failed");
      }
    } catch (err) {
      showToast("error", "Upload failed, please retry");
    }
    setUploadingFile(false);
    e.target.value = "";
  };

  const handleDeleteKnowledge = async (kbId: string) => {
    if (!selectedId) return;
    await fetch(`/api/agents/${selectedId}/knowledge/${kbId}`, { method: "DELETE", credentials: "include" });
    await loadKnowledge(selectedId);
  };

  const openPermissions = async (agentId: string) => {
    setShowPermissions(true);
    // Load org members
    try {
      const res = await fetch(`/api/organizations/${organizationId}/members`, { credentials: "include" });
      if (res.ok) setOrgMembers(await res.json());
    } catch { setOrgMembers([]); }
    // Load agent details for created_by
    try {
      const res = await fetch(`/api/agents/${agentId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAgentCreatorId(data.created_by || "");
      }
    } catch { setAgentCreatorId(""); }
    // Load current permissions
    try {
      const res = await fetch(`/api/agents/${agentId}/permissions`, { credentials: "include" });
      if (res.ok) {
        const perms = await res.json();
        const memberIds = new Set<string>(perms.filter((p: { target_type: string; target_id: string }) => p.target_type === "member").map((p: { target_id: string }) => p.target_id));
        setPermittedUserIds(memberIds);
      }
    } catch { setPermittedUserIds(new Set()); }
  };

  const handleSavePermissions = async () => {
    if (!selectedId) return;
    setSavingPerms(true);
    try {
      // Build permissions array: all checked members
      const permissions = Array.from(permittedUserIds).map((uid) => ({ targetType: "member", targetId: uid }));
      // If no one is selected (shouldn't happen since creator is always checked), fallback to creator only
      if (permissions.length === 0 && agentCreatorId) {
        permissions.push({ targetType: "member", targetId: agentCreatorId });
      }
      const res = await fetch(`/api/agents/${selectedId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ permissions, organizationId }),
      });
      if (res.ok) {
        showToast("success", "Permissions saved");
        setShowPermissions(false);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", data.error || "Save failed");
      }
    } catch { showToast("error", "Save failed"); }
    setSavingPerms(false);
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
    fetch(`/api/agents/${agent.id}/permissions`, { credentials: "include" })
      .then((r) => r.json())
      .then((perms) => {
        if (Array.isArray(perms) && perms.some((p: { target_type: string }) => p.target_type === "all")) {
          setEditVisibility("all");
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
      showToast("error", err.error || "Save failed");
      return;
    }
    setShowEdit(false);
    await loadAgents();
  };

  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /></div>;

  const selected = agents.find((a) => a.id === selectedId);

  return (
    <div className="agent-browser-container">
      {toast && (
        <div className={`agent-toast ${toast.type}`}>
          {toast.type === "success" ? "✓" : "✗"} {toast.text}
        </div>
      )}
      <div className="agent-browser-header">
        <div>
          <h2>Agents</h2>
          <p className="agent-browser-subtitle">Manage and use AI Agents</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Create Agent</button>
      </div>

      <div className="agent-grid">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`agent-browser-card ${selectedId === agent.id ? "selected" : ""}`}
            onClick={() => { setSelectedId(agent.id); setShowChat(false); setShowKnowledge(false); setChatMessages([]); }}
          >
            <div className="agent-browser-card-header">
              <span className="agent-browser-name">{agent.name}</span>
              <span className="agent-browser-provider">{agent.provider === "zhipu" ? "ZHIPU" : (activeModelName || agent.provider).toUpperCase()}</span>
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
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button className="btn-primary btn-small" onClick={() => { setShowChat(!showChat); setShowKnowledge(false); if (!showChat) loadChatHistory(selected.id); }}>
                {showChat ? "Close Chat" : "💬 Chat"}
              </button>
              {selected.canEdit && <button className="btn-secondary btn-small" onClick={() => { setShowKnowledge(!showKnowledge); setShowChat(false); if (!showKnowledge) loadKnowledge(selected.id); }}>
                {showKnowledge ? "Close Knowledge" : "📚 Feed Knowledge"}
              </button>}
              {selected.canEdit && <button className="btn-secondary btn-small" onClick={() => openEdit(selected)}>Edit</button>}
              {selected.canEdit && <button className="btn-secondary btn-small" onClick={() => openPermissions(selected.id)}>👥 Assign</button>}
              {selected.canEdit && <button className="btn-danger btn-small" onClick={() => setConfirmDeleteAgentId(selected.id)}>Delete</button>}
            </div>
          </div>

          {showChat ? (
            <div className="agent-chat-panel">
              <div className="agent-chat-messages">
                {chatMessages.length === 0 && <div className="empty-state">Start a conversation with {selected.name} (context is preserved)</div>}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-msg ${msg.role}`}>
                    <span className="chat-msg-role">{msg.role === "user" ? "You" : selected.name}</span>
                    {msg.role === "assistant" && msg.content.match(/^https?:\/\/.*\.(mp4|webm|mov)/) ? (
                      <div className="chat-msg-content">
                        <video controls src={msg.content.trim()} style={{ width: "100%", maxHeight: 300, borderRadius: 4 }} />
                      </div>
                    ) : (
                      <div className="chat-msg-content">{msg.content}</div>
                    )}
                  </div>
                ))}
                {chatSending && <div className="chat-msg assistant"><span className="chat-msg-role">{selected.name}</span><div className="chat-msg-content">Thinking...</div></div>}
                <div ref={chatEndRef} />
              </div>
              <div className="agent-chat-input-bar">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Ask ${selected.name}...`}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendChat(); }}
                />
                <button className="btn-primary" onClick={handleSendChat} disabled={chatSending || !chatInput.trim()}>Send</button>
                <button className="btn-secondary btn-small" style={{ fontSize: 9, opacity: 0.6 }} onClick={() => setShowConfirmClear(true)}>Clear</button>
              </div>
            </div>
          ) : showKnowledge ? (
            <div className="agent-knowledge-panel">
              <div className="knowledge-feed-form">
                <h4>Feed Knowledge</h4>
                <p style={{ color: "var(--muted)", fontSize: 11, margin: "4px 0 12px" }}>
                  Upload files or paste text. AI analyzes and stores as Agent knowledge, auto-loaded during chat.<br/>
                  Supports TXT, PDF, DOCX, Excel, PPTX, images, audio, video. All content is extracted as text.
                </p>

                <div className="knowledge-upload-zone">
                  <label className="btn-primary" style={{ cursor: "pointer", display: "inline-block" }}>
                    📎 Upload File
                    <input type="file" accept=".txt,.md,.csv,.json,.docx,.xlsx,.xls,.pptx,.pdf,.png,.jpg,.jpeg,.gif,.webp,.mp3,.wav,.m4a,.ogg,.flac,.aac,.wma,.mp4,.mov,.avi,.mkv,.webm,.flv" onChange={handleFileUpload} style={{ display: "none" }} />
                  </label>
                  {uploadingFile && <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: 8 }}>Analyzing...</span>}
                </div>

                <div className="onboarding-divider" style={{ margin: "12px 0" }}><span>or paste text manually</span></div>

                <div className="form-group">
                  <label>Name</label>
                  <input value={feedName} onChange={(e) => setFeedName(e.target.value)} placeholder="e.g. Company Product Manual" />
                </div>
                <div className="form-group">
                  <label>Content (paste document text)</label>
                  <textarea
                    value={feedContent}
                    onChange={(e) => setFeedContent(e.target.value)}
                    placeholder="Paste document content, company info, product docs here..."
                    rows={5}
                  />
                </div>
                <button className="btn-primary" onClick={handleFeedKnowledge} disabled={feeding || !feedName.trim() || !feedContent.trim()}>
                  {feeding ? "Analyzing..." : "Feed"}
                </button>
              </div>

              <div className="knowledge-list">
                <div className="panel-title">Knowledge Items ({knowledgeItems.length})</div>
                {knowledgeItems.length === 0 && <div className="empty-state">No knowledge yet. Feed content to enhance this Agent.</div>}
                {knowledgeItems.map((item) => (
                  <div key={item.id} className="knowledge-item">
                    <div className="knowledge-item-header">
                      <span className="knowledge-item-name">{item.name}</span>
                      <button className="btn-danger btn-small" onClick={() => handleDeleteKnowledge(item.id)}>Delete</button>
                    </div>
                    <div className="knowledge-item-summary">{item.content || item.summary || "(empty)"}</div>
                    <div className="knowledge-item-meta">{item.type} · {new Date(item.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="agent-detail-row"><span>Type</span><strong>{selected.type}</strong></div>
              <div className="agent-detail-row"><span>Provider</span><strong>{selected.provider}</strong></div>
              <div className="agent-detail-row"><span>Output Format</span><strong>{selected.output_format || "text"}</strong></div>
              <div className="agent-detail-row"><span>Description</span><strong>{selected.description}</strong></div>
              <div className="agent-detail-row"><span>Rating</span><strong>⭐ {selected.rating || 5.0}</strong></div>
              <div className="agent-detail-row">
                <span>Your Rating</span>
                {selected.user_rating != null ? (
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} style={{ fontSize: 16, color: star <= selected.user_rating! ? "var(--warning)" : "var(--muted)" }}>★</span>
                    ))}
                  </div>
                ) : ratingLoading ? (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Submitting...</span>
                ) : ratingSuccess ? (
                  <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Rating submitted</span>
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
                          }
                        }}
                      >★</button>
                    ))}
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
              <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="What does this Agent do?" />
            </div>
            <div className="form-group">
              <label>Type</label>
              <input value={formType} onChange={(e) => setFormType(e.target.value)} placeholder="e.g. seo-writing, data-analysis" />
            </div>
            <div className="form-group">
              <label>Provider</label>
              <select value={formProvider} onChange={(e) => setFormProvider(e.target.value)}>
                <option value="text">Text (uses global AI model)</option>
                <option value="zhipu">Zhipu (Video Generation)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Output Format</label>
              <select value={formOutputFormat} onChange={(e) => setFormOutputFormat(e.target.value)}>
                <option value="text">Text</option>
                <option value="code">Code (zip)</option>
                <option value="json">JSON</option>
                <option value="video-url">Video</option>
              </select>
            </div>
            <div className="form-group">
              <label>Visibility</label>
              <select value={formVisibility} onChange={(e) => setFormVisibility(e.target.value)}>
                <option value="department">My department</option>
                <option value="all">All members</option>
              </select>
            </div>
            <div className="form-group">
              <label>System Prompt</label>
              <textarea value={formPrompt} onChange={(e) => setFormPrompt(e.target.value)} placeholder="You are a..." rows={4} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate} disabled={creating || !formName.trim() || !formType.trim()}>
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteAgentId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteAgentId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Agent</h3>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "12px 0" }}>Delete this Agent? Associated workflows will also be deleted.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteAgentId(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDelete(confirmDeleteAgentId)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmClear && (
        <div className="modal-overlay" onClick={() => setShowConfirmClear(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Clear Chat History</h3>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "12px 0" }}>Clear all chat history with this Agent? This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowConfirmClear(false)}>Cancel</button>
              <button className="btn-danger" onClick={async () => {
                setShowConfirmClear(false);
                if (!selectedId) return;
                await fetch(`/api/agents/${selectedId}/chat/history`, { method: "DELETE", credentials: "include" });
                setChatMessages([]);
                showToast("success", "Chat history cleared");
              }}>Clear</button>
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
              <label>Type</label>
              <input value={editType} onChange={(e) => setEditType(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Provider</label>
              <select value={editProvider} onChange={(e) => setEditProvider(e.target.value)}>
                <option value="text">Text (uses global AI model)</option>
                <option value="zhipu">Zhipu (Video Generation)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Output Format</label>
              <select value={editOutputFormat} onChange={(e) => setEditOutputFormat(e.target.value)}>
                <option value="text">Text</option>
                <option value="code">Code</option>
                <option value="json">JSON</option>
                <option value="video-url">Video</option>
              </select>
            </div>
            <div className="form-group">
              <label>Visibility</label>
              <select value={editVisibility} onChange={(e) => setEditVisibility(e.target.value)}>
                <option value="department">My department</option>
                <option value="all">All members</option>
              </select>
            </div>
            <div className="form-group">
              <label>System Prompt (leave empty to keep current)</label>
              <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="Leave empty to keep current..." rows={3} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showPermissions && selected && (
        <div className="modal-overlay" onClick={() => setShowPermissions(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "70vh", display: "flex", flexDirection: "column" }}>
            <h3>Assign Agent Permissions</h3>
            <p style={{ color: "var(--muted)", fontSize: 11, margin: "4px 0 12px" }}>
              Select members who can see and use this agent. Creator is always included.
            </p>
            <div style={{ flex: 1, overflowY: "auto", margin: "0 -16px", padding: "0 16px" }}>
              {orgMembers.map((m) => {
                const isCreator = m.user_id === agentCreatorId;
                const isChecked = permittedUserIds.has(m.user_id);
                return (
                  <label key={m.user_id} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                    borderBottom: "1px solid var(--border)", cursor: isCreator ? "default" : "pointer",
                    opacity: isCreator ? 0.9 : 1,
                  }}>
                    <input
                      type="checkbox"
                      checked={isChecked || isCreator}
                      disabled={isCreator}
                      onChange={() => {
                        if (isCreator) return;
                        setPermittedUserIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(m.user_id)) next.delete(m.user_id);
                          else next.add(m.user_id);
                          return next;
                        });
                      }}
                      style={{ accentColor: "var(--primary)" }}
                    />
                    <span style={{ fontSize: 12, color: "var(--paper)" }}>
                      {m.name || m.email}
                      {isCreator && <span style={{ color: "var(--muted)", fontSize: 10, marginLeft: 4 }}>(creator)</span>}
                    </span>
                  </label>
                );
              })}
              {orgMembers.length === 0 && <div className="empty-state">No members found</div>}
            </div>
            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button className="btn-secondary" onClick={() => setShowPermissions(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSavePermissions} disabled={savingPerms}>
                {savingPerms ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
