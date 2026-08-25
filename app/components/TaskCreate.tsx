"use client";

import { useState, useEffect } from "react";
import { useCurrentUser } from "./AuthGuard";

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  stepCount: number;
  is_prebuilt: boolean;
}

interface Props {
  organizationId: string;
  initialWorkflowId?: string;
  onCreated: (taskId: string) => void;
  onCancel: () => void;
}

export default function TaskCreate({ organizationId, initialWorkflowId, onCreated, onCancel }: Props) {
  const currentUser = useCurrentUser();
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [selectedWf, setSelectedWf] = useState(initialWorkflowId || "");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const url = currentUser ? `/api/workflows?userId=${currentUser.id}` : "/api/workflows";
    fetch(url).then((r) => r.json()).then((data) => {
      setWorkflows(data);
      if (!selectedWf && data.length > 0) setSelectedWf(data[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!selectedWf || !input.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workflowId: selectedWf, organizationId, initialInput: input.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create task");
      }
      const data = await res.json();
      onCreated(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /></div>;

  const selected = workflows.find((w) => w.id === selectedWf);

  return (
    <div className="task-create-container">
      <div className="task-create-header">
        <h2>Start New Task</h2>
        <button className="btn-secondary" onClick={onCancel}>← Back</button>
      </div>

      <div className="task-create-form">
        <div className="form-group">
          <label>Select Workflow</label>
          <div className="workflow-select-grid">
            {workflows.map((wf) => (
              <button
                key={wf.id}
                className={`workflow-select-card ${selectedWf === wf.id ? "selected" : ""}`}
                onClick={() => setSelectedWf(wf.id)}
              >
                <span className="wf-card-name">{wf.name}</span>
                <span className="wf-card-desc">{wf.description}</span>
                <span className="wf-card-steps">{wf.stepCount} steps</span>
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <div className="form-group">
            <label>Your Requirement</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Describe what you want the "${selected.name}" workflow to produce...`}
              rows={6}
            />
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}

        <button className="btn-primary btn-large" onClick={handleSubmit} disabled={submitting || !input.trim() || !selectedWf}>
          {submitting ? "⏳ Starting..." : "🚀 Start Task"}
        </button>
      </div>
    </div>
  );
}
