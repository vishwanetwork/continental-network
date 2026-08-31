"use client";

import { useState, useEffect } from "react";

interface AIModel {
  id: string;
  name: string;
  provider: string;
  api_url: string;
  api_key: string;
  model_name: string;
  enabled: boolean;
}

export default function AIModelSettings() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showEditModel, setShowEditModel] = useState<string | null>(null);

  // Add/Edit form
  const [formName, setFormName] = useState("");
  const [formProvider, setFormProvider] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formModelName, setFormModelName] = useState("");
  const [formKey, setFormKey] = useState("");

  const loadModels = async () => {
    try {
      const res = await fetch("/api/settings/ai-models", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setModels(data.map((m: AIModel) => ({ ...m, enabled: !!m.enabled })));
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadModels(); }, []);

  const handleToggle = async (model: AIModel) => {
    if (model.enabled) return;
    if (!model.api_key || model.api_key === "Not set") {
      setMessage("⚠️ Please set the API Key before switching");
      setTimeout(() => setMessage(""), 3000);
      return;
    }
    setSaving(model.id);
    try {
      const res = await fetch(`/api/settings/ai-models/${model.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage(`⚠️ ${data.error || "Switch failed"}`);
        setTimeout(() => setMessage(""), 3000);
      } else {
        await loadModels();
        setMessage(`Switched to ${model.name}`);
        setTimeout(() => setMessage(""), 2000);
      }
    } catch { /* ignore */ }
    setSaving(null);
  };

  const handleSaveKey = async (model: AIModel) => {
    const key = editKey[model.id];
    if (key === undefined) return;
    setSaving(model.id);
    try {
      await fetch(`/api/settings/ai-models/${model.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ api_key: key }),
      });
      await loadModels();
      setEditKey((prev) => { const next = { ...prev }; delete next[model.id]; return next; });
      setMessage(`${model.name} API Key saved`);
      setTimeout(() => setMessage(""), 2000);
    } catch { /* ignore */ }
    setSaving(null);
  };

  const handleAddModel = async () => {
    if (!formName.trim() || !formUrl.trim() || !formModelName.trim()) return;
    setSaving("new");
    try {
      const res = await fetch("/api/settings/ai-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: formName.trim(), provider: formProvider.trim() || "custom", api_url: formUrl.trim(), model_name: formModelName.trim(), api_key: formKey }),
      });
      if (res.ok) {
        setShowAdd(false);
        setFormName(""); setFormProvider(""); setFormUrl(""); setFormModelName(""); setFormKey("");
        await loadModels();
        setMessage("Model added");
        setTimeout(() => setMessage(""), 2000);
      }
    } catch { /* ignore */ }
    setSaving(null);
  };

  const handleEditModel = async () => {
    if (!showEditModel || !formName.trim() || !formUrl.trim() || !formModelName.trim()) return;
    setSaving(showEditModel);
    try {
      const body: Record<string, string> = { name: formName.trim(), provider: formProvider.trim(), api_url: formUrl.trim(), model_name: formModelName.trim() };
      if (formKey) body.api_key = formKey;
      await fetch(`/api/settings/ai-models/${showEditModel}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      setShowEditModel(null);
      setFormName(""); setFormProvider(""); setFormUrl(""); setFormModelName(""); setFormKey("");
      await loadModels();
      setMessage("Model updated");
      setTimeout(() => setMessage(""), 2000);
    } catch { /* ignore */ }
    setSaving(null);
  };

  const [confirmDeleteModel, setConfirmDeleteModel] = useState<AIModel | null>(null);

  const handleDeleteModel = async (model: AIModel) => {
    setConfirmDeleteModel(null);
    setSaving(model.id);
    try {
      const res = await fetch(`/api/settings/ai-models/${model.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const data = await res.json();
        setMessage(`⚠️ ${data.error}`);
        setTimeout(() => setMessage(""), 3000);
      } else {
        await loadModels();
      }
    } catch { /* ignore */ }
    setSaving(null);
  };

  const openEditModal = (model: AIModel) => {
    setFormName(model.name);
    setFormProvider(model.provider);
    setFormUrl(model.api_url);
    setFormModelName(model.model_name);
    setFormKey("");
    setShowEditModel(model.id);
  };

  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /></div>;

  return (
    <div className="ai-model-settings">
      <div className="ai-model-header">
        <div>
          <h2>AI Model Settings</h2>
          <p style={{ color: "var(--muted)", fontSize: 12 }}>Manage your personal AI models and API keys</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowAdd(true); setFormName(""); setFormProvider(""); setFormUrl(""); setFormModelName(""); setFormKey(""); }}>
          + Add Model
        </button>
      </div>

      {message && <div className={message.startsWith("⚠️") ? "error-banner" : "success-banner"}>{message}</div>}

      <div className="ai-model-list">
        {models.map((model) => (
          <div key={model.id} className={`ai-model-card ${model.enabled ? "enabled" : "disabled"}`}>
            <div className="ai-model-card-header">
              <div>
                <h3>{model.name} {!!model.enabled && <span style={{ color: "var(--green)", fontSize: 11, marginLeft: 8 }}>● Active</span>}</h3>
                <span className="ai-model-provider">{model.provider}</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  className={`btn-${model.enabled ? "primary" : "secondary"} btn-small`}
                  onClick={() => handleToggle(model)}
                  disabled={saving === model.id || model.enabled}
                >
                  {model.enabled ? "Active" : "Switch"}
                </button>
                <button className="btn-secondary btn-small" onClick={() => openEditModal(model)}>Edit</button>
                {!model.enabled && <button className="btn-danger btn-small" onClick={() => setConfirmDeleteModel(model)} disabled={saving === model.id}>
                  {saving === model.id ? "Deleting..." : "Delete"}
                </button>}
              </div>
            </div>
            <div className="ai-model-details">
              <div className="ai-model-row">
                <span>Model</span>
                <strong>{model.model_name}</strong>
              </div>
              <div className="ai-model-row">
                <span>API URL</span>
                <strong style={{ fontSize: 10, wordBreak: "break-all" }}>{model.api_url}</strong>
              </div>
              <div className="ai-model-row">
                <span>API Key</span>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", flex: 1 }}>
                  {editKey[model.id] !== undefined ? (
                    <>
                      <input
                        type="password"
                        value={editKey[model.id]}
                        onChange={(e) => setEditKey((prev) => ({ ...prev, [model.id]: e.target.value }))}
                        placeholder="Enter API Key..."
                        style={{ flex: 1, fontSize: 11 }}
                      />
                      <button className="btn-primary btn-small" onClick={() => handleSaveKey(model)} disabled={saving === model.id}>Save</button>
                      <button className="btn-secondary btn-small" onClick={() => setEditKey((prev) => { const next = { ...prev }; delete next[model.id]; return next; })}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <strong>{model.api_key || "Not set"}</strong>
                      <button className="btn-secondary btn-small" onClick={() => setEditKey((prev) => ({ ...prev, [model.id]: "" }))}>{model.api_key ? "Change" : "Set"}</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(showAdd || showEditModel) && (
        <div className="modal-overlay" onClick={() => { setShowAdd(false); setShowEditModel(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{showEditModel ? "Edit Model" : "Add Model"}</h3>
            <div className="form-group">
              <label>Name *</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Claude 3.5" />
            </div>
            <div className="form-group">
              <label>Provider</label>
              <input value={formProvider} onChange={(e) => setFormProvider(e.target.value)} placeholder="e.g. anthropic, openai, deepseek" />
            </div>
            <div className="form-group">
              <label>API URL * (full path, e.g. https://xxx/v1/chat/completions)</label>
              <input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://api.example.com/v1/chat/completions" />
            </div>
            <div className="form-group">
              <label>Model Name *</label>
              <input value={formModelName} onChange={(e) => setFormModelName(e.target.value)} placeholder="e.g. gpt-4o, claude-3-5-sonnet" />
            </div>
            <div className="form-group">
              <label>API Key {showEditModel ? "(leave empty to keep current)" : ""}</label>
              <input type="password" value={formKey} onChange={(e) => setFormKey(e.target.value)} placeholder="sk-..." />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowAdd(false); setShowEditModel(null); }}>Cancel</button>
              <button className="btn-primary" onClick={showEditModel ? handleEditModel : handleAddModel} disabled={(showEditModel ? saving === showEditModel : saving === "new") || !formName.trim() || !formUrl.trim() || !formModelName.trim()}>
                {showEditModel ? (saving === showEditModel ? "Saving..." : "Save") : (saving === "new" ? "Adding..." : "Add")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteModel && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteModel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Model</h3>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "12px 0" }}>Delete {confirmDeleteModel.name}? This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteModel(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDeleteModel(confirmDeleteModel)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
