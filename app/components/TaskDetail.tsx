"use client";

import { useState, useEffect } from "react";

interface Guardrail {
  check_name: string;
  check_label: string;
  status: string;
  result_reason?: string;
}

interface TaskStep {
  step_order: number;
  name: string;
  agent_id: string;
  description?: string;
  progress?: string;
  agent_output_format?: string;
  status: string;
  input: string | null;
  output: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  guardrails: Guardrail[];
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
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - mountTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [mountTime]);
  return <span className="step-v2-timer">{elapsed}s</span>;
}

/* Shield icon — Bootstrap shield-shaded, coloured per status */
function ShieldIcon({ status }: { status: string }) {
  // Three colours from the design: green (passed/evaluating), red (blocked), dark grey (locked/pending)
  let fill = "#3a5a48";   // locked/pending — dark muted
  let half = "#2a4035";   // shaded half
  if (status === "passed") { fill = "#49e39a"; half = "#2ea06c"; }
  else if (status === "evaluating") { fill = "#49e39a"; half = "#2ea06c"; }
  else if (status === "blocked") { fill = "#ff4444"; half = "#c03030"; }

  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      {/* Shaded half (right side, filled) */}
      <path fillRule="evenodd" d="M8 14.933a1 1 0 0 0 .1-.025q.114-.034.294-.118c.24-.113.547-.29.893-.533a10.7 10.7 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067z" fill={half} />
      {/* Full outline */}
      <path fillRule="evenodd" d="M5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56" fill={fill} />
      {/* Shaded half on top */}
      <path fillRule="evenodd" d="M8 14.933a1 1 0 0 0 .1-.025q.114-.034.294-.118c.24-.113.547-.29.893-.533a10.7 10.7 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067z" fill={half} />
    </svg>
  );
}

/* Single check item with connecting progress bar */
function CheckItem({ g, isLast, nextStatus }: { g: Guardrail; isLast: boolean; nextStatus?: string }) {
  const passed = g.status === "passed";
  const evaluating = g.status === "evaluating";
  const pending = g.status === "pending" || g.status === "locked";
  const blocked = g.status === "blocked" || g.status === "failed";

  return (
    <div className="gr-ck-wrapper">
      <div className={`gr-ck gr-ck-s-${g.status}`}>
        <span className="gr-ck-dot">
          {passed && <span className="gr-dot-passed">✓</span>}
          {evaluating && <span className="gr-dot-eval" />}
          {blocked && <span className="gr-dot-blocked">✗</span>}
          {pending && <span className="gr-dot-pending">○</span>}
        </span>
        <span className="gr-ck-text">{g.check_label}</span>
        {g.result_reason && (passed || blocked) && (
          <span className={`gr-ck-reason ${blocked ? "gr-ck-reason-fail" : ""}`}>{g.result_reason}</span>
        )}
      </div>
      {!isLast && (
        <div className={`gr-ck-bar ${passed ? "gr-ck-bar-done" : evaluating ? "gr-ck-bar-active" : "gr-ck-bar-idle"}`}>
          {evaluating && <div className="gr-ck-bar-fill" />}
        </div>
      )}
    </div>
  );
}

/* Guardrail row — collapsible, shows shield + status bar + expandable checks */
function GuardrailRow({ guardrails, stepOrder, stepStatus, autoExpanded, progressText }: {
  guardrails: Guardrail[];
  stepOrder: number;
  stepStatus: string;
  autoExpanded: boolean;
  progressText: string | null;
}) {
  const [manualToggle, setManualToggle] = useState<boolean | null>(null);
  if (!guardrails || guardrails.length === 0) return null;

  const passedCount = guardrails.filter((g) => g.status === "passed").length;
  const evaluatingCount = guardrails.filter((g) => g.status === "evaluating").length;
  const failedCount = guardrails.filter((g) => g.status === "failed").length;
  const total = guardrails.length;
  const grId = String(stepOrder).padStart(2, "0");

  let overall: "passed" | "evaluating" | "blocked" | "locked" | "pending" = "pending";
  if (failedCount > 0 && evaluatingCount === 0 && passedCount + failedCount === total) overall = "passed"; // all done, some failed but advisory
  else if (passedCount === total) overall = "passed";
  else if (evaluatingCount > 0) overall = "evaluating";
  else if (stepStatus === "pending") overall = "locked";

  // Agent is running after all guardrails pass
  const agentRunning = overall === "passed" && stepStatus === "running";

  // Expand logic: manual toggle overrides, otherwise follow autoExpanded
  const expanded = manualToggle !== null ? manualToggle : autoExpanded;

  const handleClick = () => {
    if (overall === "locked") return;
    setManualToggle(expanded ? false : true);
  };

  return (
    <div className={`gr-row gr-row-${overall}`}>
      <div className="gr-header" onClick={handleClick}>
        <div className="gr-header-left">
          <ShieldIcon status={overall} />
          <span className="gr-name">VETA GUARDRAIL {grId}</span>
          <span className={`gr-badge gr-badge-${overall}`}>{overall.toUpperCase()}</span>
          {overall !== "locked" && (
            <span className="gr-progress">{passedCount} / {total} controls cleared{failedCount > 0 ? ` · ${failedCount} flagged` : ""}</span>
          )}
          {agentRunning && progressText && (
            <span className="gr-agent-status">· {progressText}</span>
          )}
        </div>
        <div className="gr-header-right">
          {overall === "locked" && (
            <span className="gr-wait">{stepOrder > 1 ? `WAITING FOR STEP ${stepOrder - 1}` : "WAITING FOR VETA CLEARANCE"}</span>
          )}
          {overall !== "locked" && <span className="gr-toggle">{expanded ? "▲" : "▶"}</span>}
        </div>
      </div>

      {expanded && overall !== "locked" && (
        <div className="gr-checks-panel">
          <div className="gr-checks-divider" />
          <div className="gr-checks-flow">
            {guardrails.map((g, idx) => (
              <CheckItem
                key={g.check_name}
                g={g}
                isLast={idx === guardrails.length - 1}
                nextStatus={idx < guardrails.length - 1 ? guardrails[idx + 1].status : undefined}
              />
            ))}
          </div>
          {overall === "evaluating" && (
            <div className="gr-notice">NEXT STEP REMAINS LOCKED UNTIL ALL CHECKS PASS</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TaskDetail({ taskId, onBack }: Props) {
  const [task, setTask] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
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
  const grSets = task.steps.filter((s) => (s.guardrails || []).length > 0).length;
  const grSetsPassed = task.steps.filter((s) => (s.guardrails || []).length > 0 && (s.guardrails || []).every((g) => g.status === "passed")).length;

  // Determine which step's guardrail panel should auto-expand
  // Running step or evaluating guardrails → expand; completed → collapse; only one open at a time
  const autoExpandedGrStep = (() => {
    for (const step of task.steps) {
      const grs = step.guardrails || [];
      const hasEvaluating = grs.some((g) => g.status === "evaluating");
      const allPassed = grs.length > 0 && grs.every((g) => g.status === "passed");
      // If guardrails are being evaluated, expand this step
      if (hasEvaluating) return step.step_order;
      // If all guardrails passed but step is still running (agent executing), expand this step
      if (allPassed && step.status === "running") return step.step_order;
    }
    return -1;
  })();

  return (
    <div className="task-detail-container">
      <div className="task-detail-header">
        <button className="btn-secondary" onClick={onBack}>← Back</button>
        <div className="task-detail-title">
          <h2>{task.workflow_name || "Task"}</h2>
          <span className={`status-badge ${task.status}`}>{task.status.toUpperCase()}</span>
          {task.status === "completed" && (
            <button className="btn-primary btn-small" style={{ marginLeft: 12 }} disabled={downloading} onClick={async () => {
              setDownloading(true);
              try {
                const r = await fetch(`/api/tasks/${taskId}/download`, { credentials: "include" });
                if (!r.ok) { const err = await r.json().catch(() => ({ error: "Download failed" })); alert(err.error || "Download failed"); return; }
                const blob = await r.blob();
                if (blob.size === 0) { alert("No deliverable content"); return; }
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `${task.workflow_name || "deliverable"}.zip`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
              } catch { alert("Download error"); } finally { setDownloading(false); }
            }}>{downloading ? "⏳ Downloading..." : "📥 Download Deliverable"}</button>
          )}
        </div>
      </div>

      <div className="task-progress-bar">
        <div className="task-progress-fill" style={{ width: `${progress}%` }} />
        <span className="task-progress-label">
          {completedCount} / {task.steps.length} STEPS COMPLETED · {grSetsPassed} / {grSets} GUARDRAILS PASSED
        </span>
      </div>

      <div className="task-detail-input">
        <div className="panel-title">📋 INITIAL REQUIREMENT</div>
        <pre className="task-input-content">{task.initial_input}</pre>
      </div>

      <div className="task-pipeline">
        <div className="panel-title">🔄 PIPELINE</div>

        <div className="pipeline-steps-v2">
          {task.steps.map((step, i) => {
            const isExpanded = expandedStep === i;
            const statusIcon = step.status === "completed" ? "✓" : step.status === "running" ? "⚡" : step.status === "failed" ? "✗" : "🔒";
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
                      {step.status === "running" && <span className="step-v2-running-indicator">{step.progress || "Processing..."}</span>}
                      {step.status === "failed" && <span className="step-v2-locked-label">LOCKED BY VETA</span>}
                      {step.status === "completed" && <span className="step-v2-approved-label">APPROVED BY VETA</span>}
                      <span className="step-v2-toggle">{isExpanded ? "▼" : "▶"}</span>
                    </div>
                  </div>

                  <GuardrailRow guardrails={step.guardrails || []} stepOrder={step.step_order} stepStatus={step.status} autoExpanded={autoExpandedGrStep === step.step_order} progressText={step.progress || null} />

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
                              <pre className="step-v2-pre">{step.output.length > 2000 ? step.output.slice(0, 2000) + "\n\n... (truncated)" : step.output}</pre>
                              <button className="btn-primary btn-small" style={{ marginTop: 8 }} onClick={async () => {
                                const res = await fetch(`/api/agents/${step.agent_id}/chat/download`, {
                                  method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                                  body: JSON.stringify({ content: step.output }),
                                });
                                if (res.ok) {
                                  const blob = await res.blob(); const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a"); a.href = url; a.download = `${step.name}_code.zip`;
                                  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                                }
                              }}>📥 Download ZIP</button>
                            </div>
                          ) : step.agent_output_format === "json" ? (
                            <div>
                              <pre className="step-v2-pre">{step.output.length > 3000 ? step.output.slice(0, 3000) + "\n\n... (truncated)" : step.output}</pre>
                              <button className="btn-secondary btn-small" style={{ marginTop: 8 }} onClick={() => {
                                const blob = new Blob([step.output!], { type: "application/json" }); const url = URL.createObjectURL(blob);
                                const a = document.createElement("a"); a.href = url; a.download = `${step.name}.json`; a.click(); URL.revokeObjectURL(url);
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
                      {step.status === "pending" && (
                        <div className="step-v2-pending-msg">Waiting for previous step to complete</div>
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
