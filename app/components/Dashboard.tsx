"use client";

import { useState, useEffect } from "react";
import { useCurrentUser } from "./AuthGuard";

interface Task {
  id: string;
  workflow_id: string;
  workflow_name: string;
  initial_input: string;
  status: string;
  created_at: string;
  completed_at?: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  stepCount: number;
}

interface Props {
  organizationId: string;
  onCreateTask: (workflowId?: string) => void;
  onViewTask: (taskId: string) => void;
}

export default function Dashboard({ organizationId, onCreateTask, onViewTask }: Props) {
  const currentUser = useCurrentUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const wfUrl = currentUser ? `/api/workflows?userId=${currentUser.id}` : "/api/workflows";
      const [tasksRes, wfRes] = await Promise.all([
        fetch(`/api/tasks?organizationId=${organizationId}`),
        fetch(wfUrl),
      ]);
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (wfRes.ok) setWorkflows(await wfRes.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadData(); const t = setInterval(loadData, 5000); return () => clearInterval(t); }, [organizationId]);

  // Workflows are already filtered by permissions on the backend
  const visibleWorkflows = workflows;

  const getStatusBadge = (status: string) => {
    if (status === "completed") return <span className="status-badge completed">✓ Completed</span>;
    if (status === "failed") return <span className="status-badge failed">✗ Failed</span>;
    return <span className="status-badge running">⏳ Running</span>;
  };

  const handleDeleteTask = async (taskId: string) => {
    setConfirmDeleteTaskId(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    } catch { /* ignore */ }
  };

  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /></div>;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <button className="btn-primary" onClick={onCreateTask}>+ New Task</button>
      </div>

      {/* Quick start workflow cards */}
      <div className="dashboard-workflows">
        <div className="panel-title">Start a Workflow</div>
        <div className="workflow-quick-grid">
          {visibleWorkflows.map((wf) => (
            <button key={wf.id} className="workflow-quick-card" onClick={() => onCreateTask(wf.id)}>
              <span className="wf-quick-icon">{wf.name.includes("Video") ? "🎬" : "🚀"}</span>
              <span className="wf-quick-name">{wf.name}</span>
              <span className="wf-quick-desc">{wf.description}</span>
              <span className="wf-quick-steps">{wf.stepCount} steps · Auto pipeline</span>
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="dashboard-tasks">
        <div className="panel-title">Recent Tasks</div>
        {tasks.length === 0 ? (
          <div className="empty-state">
            <p>No tasks yet. Select a workflow above to get started.</p>
          </div>
        ) : (
          <div className="task-list">
            {tasks.map((task) => (
              <div key={task.id} className="task-card">
                <div className="task-card-header" onClick={() => onViewTask(task.id)}>
                  <span className="task-workflow-name">{task.workflow_name || "Workflow"}</span>
                  {getStatusBadge(task.status)}
                </div>
                <div className="task-card-input" onClick={() => onViewTask(task.id)}>{task.initial_input.slice(0, 120)}{task.initial_input.length > 120 ? "..." : ""}</div>
                <div className="task-card-footer">
                  <span className="task-card-meta">{new Date(task.created_at).toLocaleString()}</span>
                  <button className="task-delete-btn" onClick={(e) => { e.stopPropagation(); setConfirmDeleteTaskId(task.id); }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDeleteTaskId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteTaskId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Task</h3>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "12px 0" }}>Are you sure you want to delete this task?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteTaskId(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDeleteTask(confirmDeleteTaskId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
