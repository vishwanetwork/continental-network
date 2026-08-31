"use client";

import { useState } from "react";

interface Props {
  onComplete: () => void;
}

export default function OrgOnboarding({ onComplete }: Props) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [orgName, setOrgName] = useState("");
  const [operating, setOperating] = useState(false);
  const [error, setError] = useState("");

  // Create org state
  const [createDepts, setCreateDepts] = useState<string[]>([""]);
  const [creatorRole, setCreatorRole] = useState("");

  // Join by code state
  const [inviteCode, setInviteCode] = useState("");
  const [joinDepartmentId, setJoinDepartmentId] = useState("");
  const [availableDepts, setAvailableDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);

  const handleCreate = async () => {
    if (!orgName.trim()) return;
    const validDepts = createDepts.filter((d) => d.trim());
    if (validDepts.length === 0) { setError("Please add at least one department"); return; }
    if (!creatorRole.trim()) { setError("Please enter your role"); return; }
    setOperating(true);
    setError("");
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: orgName.trim(), departments: validDepts.map((d) => ({ name: d.trim() })), creatorRole: creatorRole.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create");
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setOperating(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) { setError("Please enter invite code"); return; }
    if (!joinDepartmentId) { setError("Please select a department"); return; }
    setOperating(true);
    setError("");
    try {
      const res = await fetch("/api/organizations/join-by-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: inviteCode.trim(), departmentId: joinDepartmentId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join");
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setOperating(false);
    }
  };

  // Load departments when invite code changes (debounced)
  const loadDepartments = async (code: string) => {
    if (!code.trim()) { setAvailableDepts([]); return; }
    setLoadingDepts(true);
    try {
      const res = await fetch(`/api/organizations/departments-by-code?code=${encodeURIComponent(code.trim())}`, { credentials: "include" });
      if (res.ok) {
        const depts = await res.json();
        setAvailableDepts(depts);
        if (depts.length > 0 && !joinDepartmentId) setJoinDepartmentId(depts[0].id);
      } else {
        setAvailableDepts([]);
      }
    } catch { setAvailableDepts([]); }
    setLoadingDepts(false);
  };

  return (
    <div className="onboarding-container">
      {operating && <div className="loading-overlay"><div className="loading-spinner" /></div>}
      <div className="onboarding-card">
        <h1>Welcome to Continental</h1>
        <p className="onboarding-subtitle">Create a company or join with an invite code</p>

        {mode === "choose" && (
          <>
            <div className="onboarding-actions" style={{ flexDirection: "column", gap: "12px", marginTop: "24px" }}>
              <button className="btn-primary btn-large" onClick={() => setMode("create")} style={{ width: "100%" }}>
                Create New Company
              </button>
              <div className="onboarding-divider"><span>or</span></div>
              <button className="btn-secondary btn-large" onClick={() => setMode("join")} style={{ width: "100%" }}>
                Join with Invite Code
              </button>
            </div>
          </>
        )}

        {mode === "join" && (
          <div className="onboarding-form">
            <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 16 }}>
              Enter the one-time invite code from your company admin (e.g. CompanyName-ABCD)
            </p>
            <div className="form-group">
              <label>Invite Code *</label>
              <input
                value={inviteCode}
                onChange={(e) => { setInviteCode(e.target.value); }}
                onBlur={() => loadDepartments(inviteCode)}
                placeholder="e.g. MyCompany-A1B2"
                autoFocus
              />
              {inviteCode.trim() && (
                <button
                  className="btn-secondary btn-small"
                  style={{ marginTop: 4 }}
                  onClick={() => loadDepartments(inviteCode)}
                  disabled={loadingDepts}
                >
                  {loadingDepts ? "Loading..." : "Verify Code"}
                </button>
              )}
            </div>
            {availableDepts.length > 0 && (
              <div className="form-group">
                <label>Select Department *</label>
                <select
                  value={joinDepartmentId}
                  onChange={(e) => setJoinDepartmentId(e.target.value)}
                >
                  <option value="">-- Select Department --</option>
                  {availableDepts.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
            )}
            {error && <div className="error-banner">{error}</div>}
            <div className="onboarding-actions">
              <button className="btn-secondary" onClick={() => { setMode("choose"); setError(""); setAvailableDepts([]); }}>Back</button>
              <button className="btn-primary" onClick={handleJoinByCode} disabled={operating}>
                {operating ? "Joining..." : "Join Company"}
              </button>
            </div>
          </div>
        )}

        {mode === "create" && (
          <div className="onboarding-form">
            <div className="form-group">
              <label>Company Name *</label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. My Company"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Your Role *</label>
              <input
                value={creatorRole}
                onChange={(e) => setCreatorRole(e.target.value)}
                placeholder="e.g. CEO, CTO, Project Manager"
              />
            </div>
            <div className="form-group">
              <label>Departments (at least one) *</label>
              {createDepts.map((dept, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                  <input
                    value={dept}
                    onChange={(e) => { const next = [...createDepts]; next[i] = e.target.value; setCreateDepts(next); }}
                    placeholder={`Department ${i + 1} name`}
                    style={{ flex: 1 }}
                  />
                  {createDepts.length > 1 && (
                    <button className="btn-danger btn-small" onClick={() => setCreateDepts(createDepts.filter((_, idx) => idx !== i))}>×</button>
                  )}
                </div>
              ))}
              <button className="btn-secondary btn-small" onClick={() => setCreateDepts([...createDepts, ""])} style={{ marginTop: "4px" }}>+ Add Department</button>
            </div>
            {error && <div className="error-banner">{error}</div>}
            <div className="onboarding-actions">
              <button className="btn-secondary" onClick={() => { setMode("choose"); setError(""); }}>Back</button>
              <button className="btn-primary" onClick={handleCreate} disabled={operating || !orgName.trim()}>
                {operating ? "Creating..." : "Create Company"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
