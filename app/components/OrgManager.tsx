"use client";

import { useState, useEffect } from "react";
import { useCurrentUser } from "./AuthGuard";

interface Department {
  id: string;
  name: string;
  parent_id: string | null;
  leader_user_id: string | null;
  organization_id: string;
  children: Department[];
}

interface Member {
  id: number;
  user_id: string;
  email: string;
  name: string;
  role: string;
  department_id: string | null;
  joined_at: string;
}

interface Props {
  organizationId: string;
  organizationName: string;
}

export default function OrgManager({ organizationId, organizationName }: Props) {
  const currentUser = useCurrentUser();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);

  // Modals
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showMoveMember, setShowMoveMember] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showSetLeader, setShowSetLeader] = useState(false);

  // Forms
  const [deptName, setDeptName] = useState("");
  const [deptParentId, setDeptParentId] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [moveToDeptId, setMoveToDeptId] = useState("");
  const [leaderUserId, setLeaderUserId] = useState("");

  // Pending applications
  const [applications, setApplications] = useState<Member[]>([]);

  const loadData = async () => {
    try {
      const [deptRes, membersRes, appsRes] = await Promise.all([
        fetch(`/api/organizations/${organizationId}/departments`),
        fetch(`/api/organizations/${organizationId}/members`),
        fetch(`/api/organizations/${organizationId}/applications`, { credentials: "include" }),
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (membersRes.ok) setMembers(await membersRes.json());
      if (appsRes.ok) setApplications(await appsRes.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [organizationId]);

  // Flatten departments for select dropdowns
  const flatDepts = (): Department[] => {
    const result: Department[] = [];
    const traverse = (depts: Department[]) => {
      for (const d of depts) {
        result.push(d);
        if (d.children) traverse(d.children);
      }
    };
    traverse(departments);
    return result;
  };

  const selectedDept = flatDepts().find((d) => d.id === selectedDeptId);
  const deptMembers = members.filter((m) => m.department_id === selectedDeptId);
  const unassignedMembers = members.filter((m) => !m.department_id);

  const handleCreateDept = async () => {
    if (!deptName.trim()) return;
    setOperating(true);
    await fetch(`/api/organizations/${organizationId}/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: deptName.trim(), parentId: deptParentId || null }),
    });
    setDeptName("");
    setDeptParentId("");
    setShowCreateDept(false);
    await loadData();
    setOperating(false);
  };

  const handleDeleteDept = async (deptId: string) => {
    setOperating(true);
    await fetch(`/api/organizations/${organizationId}/departments/${deptId}`, { method: "DELETE" });
    if (selectedDeptId === deptId) setSelectedDeptId(null);
    await loadData();
    setOperating(false);
  };

  const handleAddMember = async () => {
    if (!newEmail.trim()) return;
    setOperating(true);
    await fetch(`/api/organizations/${organizationId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail.trim(), departmentId: selectedDeptId }),
    });
    setNewEmail("");
    setShowAddMember(false);
    await loadData();
    setOperating(false);
  };

  const handleMoveMember = async (userId: string) => {
    setOperating(true);
    await fetch(`/api/organizations/${organizationId}/members/${userId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departmentId: moveToDeptId || null }),
    });
    setShowMoveMember(null);
    setMoveToDeptId("");
    await loadData();
    setOperating(false);
  };

  const handleRemoveMember = async (userId: string) => {
    setOperating(true);
    await fetch(`/api/organizations/${organizationId}/members/${userId}`, { method: "DELETE" });
    await loadData();
    setOperating(false);
  };

  const handleSetLeader = async () => {
    if (!selectedDeptId) return;
    setOperating(true);
    await fetch(`/api/organizations/${organizationId}/departments/${selectedDeptId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaderUserId: leaderUserId || null }),
    });
    setShowSetLeader(false);
    setLeaderUserId("");
    await loadData();
    setOperating(false);
  };

  const handleLeave = async () => {
    setShowLeaveConfirm(false);
    setOperating(true);
    const res = await fetch(`/api/organizations/${organizationId}/leave`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Cannot leave organization");
      setOperating(false);
      return;
    }
    window.location.reload();
  };

  const handleApprove = async (userId: string) => {
    setOperating(true);
    await fetch(`/api/organizations/${organizationId}/applications/${userId}/approve`, { method: "POST", credentials: "include" });
    await loadData();
    setOperating(false);
  };

  const handleReject = async (userId: string) => {
    setOperating(true);
    await fetch(`/api/organizations/${organizationId}/applications/${userId}/reject`, { method: "POST", credentials: "include" });
    await loadData();
    setOperating(false);
  };

  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /></div>;

  const renderDeptTree = (depts: Department[], level = 0) => (
    depts.map((dept) => (
      <div key={dept.id}>
        <div
          className={`dept-tree-item ${selectedDeptId === dept.id ? "selected" : ""}`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
          onClick={() => setSelectedDeptId(dept.id)}
        >
          <span className="dept-tree-icon">{dept.children.length > 0 ? "📂" : "📁"}</span>
          <span className="dept-tree-name">{dept.name}</span>
          {dept.leader_user_id && <span className="dept-leader-badge">👑</span>}
          <span className="dept-tree-count">
            {members.filter((m) => m.department_id === dept.id).length}
          </span>
        </div>
        {dept.children.length > 0 && renderDeptTree(dept.children, level + 1)}
      </div>
    ))
  );

  return (
    <div className="team-container">
      {operating && <div className="loading-overlay"><div className="loading-spinner" /></div>}

      <div className="team-header">
        <h2>Team</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn-primary" onClick={() => setShowCreateDept(true)}>+ Department</button>
          <button className="btn-secondary" onClick={() => setShowAddMember(true)}>+ Member</button>
          <button className="btn-danger btn-small" onClick={() => setShowLeaveConfirm(true)}>Leave Org</button>
        </div>
      </div>

      <div className="org-info">
        <span className="org-name-display">{organizationName}</span>
        <span className="org-member-count">{members.length} members · {flatDepts().length} departments</span>
      </div>

      {/* Pending Applications */}
      {applications.length > 0 && (
        <div className="team-applications">
          <div className="panel-title">⏳ Pending Applications ({applications.length})</div>
          {applications.map((app) => (
            <div key={app.user_id} className="application-row">
              <span className="app-email">{app.email}</span>
              <div className="app-actions">
                <button className="btn-primary btn-small" onClick={() => handleApprove(app.user_id)}>Approve</button>
                <button className="btn-danger btn-small" onClick={() => handleReject(app.user_id)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="team-content">
        {/* Left: Department Tree */}
        <div className="team-tree-panel">
          <div className="panel-title">Departments</div>
          {renderDeptTree(departments)}
          {departments.length === 0 && <div className="empty-state">No departments yet</div>}
        </div>

        {/* Right: Members List */}
        <div className="team-members-panel">
          {selectedDeptId ? (
            <>
              <div className="team-members-header">
                <div>
                  <h3>{selectedDept?.name || ""}</h3>
                  {selectedDept?.leader_user_id && (
                    <span className="dept-leader-info">
                      Leader: {members.find((m) => m.user_id === selectedDept.leader_user_id)?.email || "—"}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button className="btn-secondary btn-small" onClick={() => setShowSetLeader(true)}>Set Leader</button>
                  <button className="btn-danger btn-small" onClick={() => handleDeleteDept(selectedDeptId)}>Delete Dept</button>
                </div>
              </div>
              <div className="member-list-new">
                {deptMembers.length === 0 && <div className="empty-state">No members in this department</div>}
                {deptMembers.map((m) => (
                  <div key={m.user_id} className="member-row">
                    <div className="member-row-email">
                      {m.name || m.email}
                      {selectedDept?.leader_user_id === m.user_id && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--warning)" }}>👑 Leader</span>}
                    </div>
                    <div className="member-row-role">{m.role}</div>
                    <div className="member-row-date">{new Date(m.joined_at).toLocaleDateString()}</div>
                    <div className="member-row-actions">
                      <button className="btn-small btn-secondary" onClick={() => { setShowMoveMember(m.user_id); setMoveToDeptId(""); }}>Move</button>
                      <button className="member-row-remove" onClick={() => handleRemoveMember(m.user_id)}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">← Select a department to view members</div>
          )}
        </div>
      </div>

      {/* Create Department Modal */}
      {showCreateDept && (
        <div className="modal-overlay" onClick={() => setShowCreateDept(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Department</h3>
            <div className="form-group">
              <label>Department Name</label>
              <input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Marketing" />
            </div>
            <div className="form-group">
              <label>Parent Department (optional)</label>
              <select value={deptParentId} onChange={(e) => setDeptParentId(e.target.value)}>
                <option value="">None (top-level)</option>
                {flatDepts().map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreateDept(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateDept}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Member</h3>
            <div className="form-group">
              <label>Email</label>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="member@example.com" type="email" />
            </div>
            <div className="form-group">
              <label>Department (optional)</label>
              <select value={selectedDeptId || ""} disabled>
                <option value="">Unassigned</option>
                {flatDepts().map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddMember(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleAddMember}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Move Member Modal */}
      {showMoveMember && (
        <div className="modal-overlay" onClick={() => setShowMoveMember(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Move Member</h3>
            <div className="form-group">
              <label>Move to Department</label>
              <select value={moveToDeptId} onChange={(e) => setMoveToDeptId(e.target.value)}>
                <option value="">Unassigned</option>
                {flatDepts().map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowMoveMember(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => handleMoveMember(showMoveMember)}>Move</button>
            </div>
          </div>
        </div>
      )}

      {/* Set Leader Modal */}
      {showSetLeader && selectedDeptId && (
        <div className="modal-overlay" onClick={() => setShowSetLeader(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Set Department Leader</h3>
            <div className="form-group">
              <label>Select Leader</label>
              <select value={leaderUserId} onChange={(e) => setLeaderUserId(e.target.value)}>
                <option value="">None</option>
                {deptMembers.map((m) => <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowSetLeader(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSetLeader}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Org Confirm */}
      {showLeaveConfirm && (
        <div className="modal-overlay" onClick={() => setShowLeaveConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Leave Organization</h3>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "12px 0" }}>Leave this organization? You will need to rejoin.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowLeaveConfirm(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleLeave}>Leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
