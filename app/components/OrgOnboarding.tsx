"use client";

import { useState, useEffect } from "react";

interface OrgItem {
  id: string;
  name: string;
  created_at: string;
}

interface DeptItem {
  id: string;
  name: string;
  children: DeptItem[];
}

interface Props {
  onComplete: () => void;
}

export default function OrgOnboarding({ onComplete }: Props) {
  const [mode, setMode] = useState<"choose" | "create" | "apply">("choose");
  const [allOrgs, setAllOrgs] = useState<OrgItem[]>([]);
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [error, setError] = useState("");
  const [pendingOrg, setPendingOrg] = useState<string | null>(null);

  // Create org state
  const [createDepts, setCreateDepts] = useState<string[]>([""]);
  const [creatorRole, setCreatorRole] = useState("");

  // Apply state
  const [applyOrgId, setApplyOrgId] = useState("");
  const [applyDepts, setApplyDepts] = useState<DeptItem[]>([]);
  const [applyDeptId, setApplyDeptId] = useState("");
  const [applyRole, setApplyRole] = useState("");

  useEffect(() => {
    fetch("/api/organizations/all")
      .then((r) => r.json())
      .then((data) => { setAllOrgs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
        throw new Error(data.error || "Failed to create organization");
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setOperating(false);
    }
  };

  const handleSelectOrg = async (orgId: string) => {
    setApplyOrgId(orgId);
    // Load departments for this org
    try {
      const res = await fetch(`/api/organizations/${orgId}/departments`);
      if (res.ok) {
        const depts = await res.json();
        setApplyDepts(depts);
      }
    } catch { /* ignore */ }
    setMode("apply");
  };

  const flattenDepts = (depts: DeptItem[], prefix = ""): Array<{ id: string; name: string }> => {
    const result: Array<{ id: string; name: string }> = [];
    for (const d of depts) {
      result.push({ id: d.id, name: prefix + d.name });
      if (d.children) result.push(...flattenDepts(d.children, prefix + d.name + " / "));
    }
    return result;
  };

  const handleApply = async () => {
    if (!applyDeptId) { setError("Please select a department"); return; }
    if (!applyRole.trim()) { setError("Please enter your role"); return; }
    setOperating(true);
    setError("");
    try {
      const res = await fetch(`/api/organizations/${applyOrgId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ departmentId: applyDeptId, role: applyRole.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "approved") {
          window.location.reload();
        } else {
          setPendingOrg(applyOrgId);
          setMode("choose");
        }
      }
    } catch { /* ignore */ }
    setOperating(false);
  };

  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /></div>;

  return (
    <div className="onboarding-container">
      {operating && <div className="loading-overlay"><div className="loading-spinner" /></div>}
      <div className="onboarding-card">
        <h1>Welcome to Continental</h1>
        <p className="onboarding-subtitle">Join an existing organization or create a new one to get started.</p>

        {pendingOrg && (
          <div className="team-applications" style={{ marginBottom: 16 }}>
            <p style={{ color: "var(--warning)", fontSize: 12, margin: 0 }}>
              ⏳ Your application is pending approval. An admin or department leader will review it shortly.
            </p>
          </div>
        )}

        {mode === "choose" && (
          <>
            {allOrgs.length > 0 && (
              <div className="org-list-section">
                <div className="panel-title">Available Organizations</div>
                <div className="org-join-list">
                  {allOrgs.map((org) => (
                    <div key={org.id} className="org-join-item">
                      <div className="org-join-name">{org.name}</div>
                      <div className="org-join-date">{new Date(org.created_at).toLocaleDateString()}</div>
                      {pendingOrg === org.id ? (
                        <span style={{ color: "var(--warning)", fontSize: 10 }}>Pending ⏳</span>
                      ) : (
                        <button className="btn-secondary btn-small" onClick={() => handleSelectOrg(org.id)}>
                          Apply
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="onboarding-divider"><span>or</span></div>

            <div className="onboarding-actions">
              <button className="btn-primary btn-large" onClick={() => setMode("create")}>
                Create New Organization
              </button>
            </div>
          </>
        )}

        {mode === "apply" && (
          <div className="onboarding-form">
            <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 16 }}>
              Select a department and enter your role. Your application will be reviewed by an admin or department leader.
            </p>
            <div className="form-group">
              <label>Department *</label>
              <select value={applyDeptId} onChange={(e) => setApplyDeptId(e.target.value)}>
                <option value="">Select a department...</option>
                {flattenDepts(applyDepts).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Your Role / Position *</label>
              <input value={applyRole} onChange={(e) => setApplyRole(e.target.value)} placeholder="e.g. Frontend Developer, Marketing Manager" />
            </div>
            {error && <div className="error-banner">{error}</div>}
            <div className="onboarding-actions">
              <button className="btn-secondary" onClick={() => { setMode("choose"); setError(""); }}>Back</button>
              <button className="btn-primary" onClick={handleApply}>Submit Application</button>
            </div>
          </div>
        )}

        {mode === "create" && (
          <div className="onboarding-form">
            <div className="form-group">
              <label>Organization Name *</label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. My Company"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Your Role / Position *</label>
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
                {operating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
