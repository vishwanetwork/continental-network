"use client";

import { useState, useEffect } from "react";

interface TaskStep {
  step_order: number;
  name: string;
  agent_id: string;
  agent_output_format?: string;
  status: string;
  input: string | null;
  output: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface TaskData {
  id: string;
  workflow_name: string;
  initial_input: string;
  status: string;
  created_at: string;
  completed_at?: string;
  steps: TaskStep[];
}

interface Props {
  taskId: string;
  onBack: () => void;
}

function StepTimer() {
  const [elapsed, setElapsed] = useState(0);
  const mountTime = useState(() => Date.now())[0];

  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - mountTime) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [mountTime]);

  return <span className="step-v2-timer">{elapsed}s</span>;
}

export default function TaskDetail({ taskId, onBack }: Props) {
  const [task, setTask] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const userInteracted = useState(() => ({ current: false }))[0];

  const handleToggleStep = (i: number) => {
    userInteracted.current = true;
    setExpandedStep((prev) => prev === i ? null : i);
  };

  const loadTask = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTask(data);
        // Only auto-expand if user hasn't manually interacted
        if (!userInteracted.current) {
          const runningIdx = data.steps?.findIndex((s: TaskStep) => s.status === "running");
          const lastCompletedIdx = data.steps ? data.steps.map((s: TaskStep, i: number) => s.status === "completed" ? i : -1).filter((i: number) => i >= 0).pop() : undefined;
          if (runningIdx >= 0) setExpandedStep(runningIdx);
          else if (lastCompletedIdx !== undefined) setExpandedStep(lastCompletedIdx);
        }
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    loadTask();
    const t = setInterval(loadTask, 3000);
    return () => clearInterval(t);
  }, [taskId]);

  if (loading || !task) return <div className="loading-overlay"><div className="loading-spinner" /></div>;

  const completedCount = task.steps.filter((s) => s.status === "completed").length;
  const progress = Math.round((completedCount / task.steps.length) * 100);

  return (
    <div className="task-detail-container">
      <div className="task-detail-header">
        <button className="btn-secondary" onClick={onBack}>← Back</button>
        <div className="task-detail-title">
          <h2>{task.workflow_name || "Task"}</h2>
          <span className={`status-badge ${task.status}`}>{task.status.toUpperCase()}</span>
          {task.status === "completed" && (
            <button className="btn-primary btn-small" style={{ marginLeft: 12 }} onClick={async () => {
              try {
                const r = await fetch(`/api/tasks/${taskId}/download`, { credentials: "include" });
                if (!r.ok) {
                  const err = await r.json().catch(() => ({ error: "Download failed" }));
                  alert(err.error || "Download failed");
                  return;
                }
                const blob = await r.blob();
                if (blob.size === 0) { alert("No deliverable content"); return; }
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${task.workflow_name || "deliverable"}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch (e) { alert("Download error"); }
            }}>
              📥 Download Deliverable
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="task-progress-bar">
        <div className="task-progress-fill" style={{ width: `${progress}%` }} />
        <span className="task-progress-label">{completedCount} / {task.steps.length} steps completed</span>
      </div>

      <div className="task-detail-input">
        <div className="panel-title">📋 Initial Requirement</div>
        <pre className="task-input-content">{task.initial_input}</pre>
      </div>

      <div className="task-pipeline">
        <div className="panel-title">🔄 Pipeline</div>
        <div className="pipeline-steps-v2">
          {task.steps.map((step, i) => {
            const isExpanded = expandedStep === i;
            const statusIcon = step.status === "completed" ? "✓" : step.status === "running" ? "⚡" : step.status === "failed" ? "✗" : "○";
            const statusClass = `step-v2-${step.status}`;

            return (
              <div key={step.step_order} className={`pipeline-step-v2 ${statusClass}`}>
                <div className="step-v2-timeline">
                  <div className={`step-v2-dot ${statusClass}`}>{statusIcon}</div>
                  {i < task.steps.length - 1 && <div className={`step-v2-line ${step.status === "completed" ? "active" : ""}`} />}
                </div>

                <div className="step-v2-content">
                  <div className="step-v2-header" onClick={() => handleToggleStep(i)}>
                    <div className="step-v2-title">
                      <span className="step-v2-number">Step {step.step_order}</span>
                      <span className="step-v2-name">{step.name}</span>
                    </div>
                    <div className="step-v2-meta">
                      {step.status === "running" && <StepTimer />}
                      {step.status === "running" && <span className="step-v2-running-indicator">Processing...</span>}
                      {step.completed_at && <span className="step-v2-time">{new Date(step.completed_at).toLocaleString()}</span>}
                      <span className="step-v2-toggle">{isExpanded ? "▼" : "▶"}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="step-v2-detail">
                      {step.output && (
                        <div className="step-v2-section">
                          <div className="step-v2-section-label">
                            {(step.agent_output_format === "code" || step.output.includes("--- FILE:")) ? "📦 Code Output" : step.agent_output_format === "video-url" ? "🎬 Video" : step.agent_output_format === "json" ? "📋 JSON" : "📤 Output"}
                          </div>
                          {step.agent_output_format === "video-url" && step.output.match(/^https?:\/\//) ? (
                            <div className="step-v2-video">
                              <video controls src={step.output.trim()} style={{ width: "100%", maxHeight: 400, borderRadius: 4 }} />
                              <a href={step.output.trim()} target="_blank" rel="noopener noreferrer" className="step-v2-download">Download Video ↗</a>
                            </div>
                          ) : (step.agent_output_format === "code" || step.output.includes("--- FILE:")) ? (
                            <div>
                              <pre className="step-v2-pre">{step.output.length > 2000 ? step.output.slice(0, 2000) + "\n\n... (truncated in display, full content in download)" : step.output}</pre>
                              <button className="btn-primary btn-small" style={{ marginTop: 8 }} onClick={async () => {
                                const res = await fetch(`/api/agents/${step.agent_id}/chat/download`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  credentials: "include",
                                  body: JSON.stringify({ content: step.output }),
                                });
                                if (res.ok) {
                                  const blob = await res.blob();
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url; a.download = `${step.name}_code.zip`;
                                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                }
                              }}>📥 Download ZIP</button>
                            </div>
                          ) : step.agent_output_format === "json" ? (
                            <div>
                              <pre className="step-v2-pre">{step.output.length > 3000 ? step.output.slice(0, 3000) + "\n\n... (truncated)" : step.output}</pre>
                              <button className="btn-secondary btn-small" style={{ marginTop: 8 }} onClick={() => {
                                const blob = new Blob([step.output!], { type: "application/json" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url; a.download = `${step.name}.json`;
                                a.click(); URL.revokeObjectURL(url);
                              }}>📥 Download JSON</button>
                            </div>
                          ) : (
                            <pre className="step-v2-pre">{step.output.length > 3000 ? step.output.slice(0, 3000) + "\n\n... (truncated)" : step.output}</pre>
                          )}
                        </div>
                      )}
                      {step.error && (
                        <div className="step-v2-section step-v2-error">
                          <div className="step-v2-section-label">❌ Error</div>
                          <pre className="step-v2-pre">{step.error}</pre>
                        </div>
                      )}
                      {step.status === "running" && (
                        <div className="step-v2-loading">
                          <div className="loading-spinner" />
                          <div className="step-v2-loading-info">
                            <span>Agent is processing...</span>
                            {step.agent_id === "agent-video-gen" && (
                              <span className="step-v2-video-hint">Video generation typically takes 3-10 minutes. You can leave this page — processing continues in the background.</span>
                            )}
                          </div>
                        </div>
                      )}
                      {step.status === "pending" && (
                        <div className="step-v2-pending">Waiting for previous step to complete</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
