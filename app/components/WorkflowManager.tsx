"use client";

import { useState, useEffect } from "react";
import { useCurrentUser } from "./AuthGuard";

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  stepCount: number;
  is_prebuilt: boolean;
  canEdit?: boolean;
}

interface WorkflowStep {
  step_order: number;
  name: string;
  agent_id: string;
  description: string;
  output_description: string;
}

interface WorkflowDetail extends WorkflowTemplate {
  steps: WorkflowStep[];
}

interface Agent {
  id: string;
  name: string;
  type: string;
  description: string;
}

interface Props {
  organizationId: string;
}

export default function WorkflowManager({ organizationId }: Props) {
  const currentUser = useCurrentUser();
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkflowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSteps, setFormSteps] = useState<Array<{ name: string; agentId: string; description: string }>>([]);
  const [formVisibility, setFormVisibility] = useState("department");
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadData = async () => {
    const wfUrl = currentUser ? `/api/workflows?userId=${currentUser.id}&organizationId=${organizationId}` : "/api/workflows";
    const [wfs, ags] = await Promise.all([
      fetch(wfUrl, { credentials: "include" }).then((r) => r.json()),
      fetch("/api/agents", { credentials: "include" }).then((r) => r.json()),
    ]);
    setWorkflows(wfs);
    setAgents(ags);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedId) {
      fetch(`/api/workflows/${selectedId}`, { credentials: "include" }).then((r) => r.json()).then((d) => {
        const wf = workflows.find((w) => w.id === selectedId);
        setDetail({ ...d, canEdit: wf?.canEdit });
      }).catch(() => {});
    } else {
      setDetail(null);
    }
  }, [selectedId]);

  const getAgentName = (id: string) => agents.find((a) => a.id === id)?.name || id;

  const handleAddStep = () => {
    const defaultAgent = agents[0];
    setFormSteps([...formSteps, { name: defaultAgent?.name || "", agentId: defaultAgent?.id || "", description: "" }]);
  };

  const handleRemoveStep = (index: number) => {
    setFormSteps(formSteps.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, field: string, value: string) => {
    setFormSteps(formSteps.map((s, i) => {
      if (i !== index) return s;
      if (field === "agentId") {
        const agent = agents.find((a) => a.id === value);
        return { ...s, agentId: value, name: agent?.name || s.name };
      }
      return { ...s, [field]: value };
    }));
  };

  const handleCreate = async () => {
    if (!formName.trim() || formSteps.length < 2) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim(),
          organizationId,
          visibility: formVisibility,
          steps: formSteps.map((s) => ({
            name: s.name.trim() || `Step ${formSteps.indexOf(s) + 1}`,
            agentId: s.agentId,
            description: s.description.trim(),
            outputDescription: "",
          })),
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setFormName("");
        setFormDesc("");
        setFormSteps([]);
        setFormVisibility("department");
        await loadData();
      }
    } catch { /* ignore */ }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    await fetch(`/api/workflows/${id}`, { method: "DELETE", credentials: "include" });
    if (selectedId === id) { setSelectedId(null); setDetail(null); }
    await loadData();
  };

  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /></div>;

  return (
    <div className="wf-manager-container">
      <div className="wf-manager-header">
        <h2>Workflows</h2>
        <button className="btn-primary" onClick={() => { setShowCreate(true); setFormSteps([{ name: agents[0]?.name || "", agentId: agents[0]?.id || "", description: "" }, { name: agents[1]?.name || agents[0]?.name || "", agentId: agents[1]?.id || agents[0]?.id || "", description: "" }]); }}>
          + Create Workflow
        </button>
      </div>

      <div className="wf-manager-content">
        <div className="wf-list">
          <div className="panel-title">Templates</div>
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className={`wf-card ${selectedId === wf.id ? "selected" : ""}`}
              onClick={() => setSelectedId(wf.id)}
            >
              <div className="wf-card-name">{wf.name} {wf.is_prebuilt ? "⭐" : ""}</div>
              <div className="wf-card-meta">{wf.stepCount} steps · {wf.is_prebuilt ? "Platform" : "Custom"}</div>
            </div>
          ))}
        </div>

        <div className="wf-detail">
          {detail ? (
            <div className="wf-detail-content">
              <div className="wf-detail-header">
                <h3>{detail.name}</h3>
                {!detail.is_prebuilt && detail.canEdit && (
                  <button className="btn-danger btn-small" onClick={() => setConfirmDeleteId(detail.id)}>Delete</button>
                )}
              </div>
              <p className="wf-detail-desc">{detail.description}</p>

              <div className="panel-title">Steps</div>
              <div className="wf-steps-list">
                {detail.steps.map((step, i) => (
                  <div key={step.step_order} className="wf-step-item">
                    <div className="wf-step-number">{i + 1}</div>
                    <div className="wf-step-info">
                      <span className="wf-step-name">{step.name}</span>
                      <span className="wf-step-agent">Agent: {getAgentName(step.agent_id)}</span>
                      {step.description && <span className="wf-step-desc">{step.description}</span>}
                    </div>
                    {i < detail.steps.length - 1 && <div className="wf-step-arrow">↓</div>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">← Select a workflow to view details</div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Create Workflow</h3>

            <div className="form-group">
              <label>Workflow Name</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Content Production Pipeline" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="What does this workflow produce?" />
            </div>

            <div className="form-group">
              <label>Visibility</label>
              <select value={formVisibility} onChange={(e) => setFormVisibility(e.target.value)}>
                <option value="department">My department only</option>
                <option value="all">All members</option>
              </select>
            </div>

            <div className="form-group">
              <label>Steps (minimum 2)</label>
              <div className="wf-create-steps">
                {formSteps.map((step, i) => (
                  <div key={i} className="wf-create-step">
                    <div className="wf-create-step-header">
                      <span className="wf-create-step-num">Step {i + 1}</span>
                      {formSteps.length > 2 && (
                        <button className="wf-create-step-remove" onClick={() => handleRemoveStep(i)}>×</button>
                      )}
                    </div>
                    <select value={step.agentId} onChange={(e) => handleStepChange(i, "agentId", e.target.value)}>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name} — {a.type}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <button className="btn-secondary" onClick={handleAddStep}>+ Add Step</button>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate} disabled={creating || !formName.trim() || formSteps.length < 2}>
                {creating ? "Creating..." : "Create Workflow"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Workflow</h3>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "12px 0" }}>Are you sure you want to delete this workflow?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDelete(confirmDeleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
