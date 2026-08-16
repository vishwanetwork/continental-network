"use client";

import { useState, useEffect } from "react";
import type { Department, Member } from "../types";
import {
  getDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment,
  getMembers,
  addMember,
  deleteMember,
} from "../store";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function Organization() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  const [newDeptParent, setNewDeptParent] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editMemberName, setEditMemberName] = useState("");
  const [editMemberRole, setEditMemberRole] = useState("");
  const [editMemberEmail, setEditMemberEmail] = useState("");
  const [editEmailError, setEditEmailError] = useState("");
  const [confirmDeleteMember, setConfirmDeleteMember] = useState<string | null>(null);
  const [confirmDeleteDept, setConfirmDeleteDept] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const [depts, mems] = await Promise.all([getDepartments(), getMembers()]);
    setDepartments(depts);
    setMembers(mems);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const allDeptsFlatList = (): Department[] => {
    const flat: Department[] = [];
    const traverse = (depts: Department[]) => {
      for (const d of depts) {
        flat.push(d);
        if (d.children) traverse(d.children);
      }
    };
    traverse(departments);
    return flat;
  };

  const getMembersForDept = (deptId: string): Member[] => {
    return members.filter((m) => m.departmentId === deptId);
  };

  const handleAddDept = async () => {
    if (!newDeptName.trim()) return;
    await addDepartment({
      id: `dept-${Date.now()}`,
      name: newDeptName.trim(),
      parentId: newDeptParent,
      description: newDeptDesc.trim() || undefined,
    });
    setNewDeptName("");
    setNewDeptDesc("");
    setNewDeptParent(null);
    setShowAddDept(false);
    await loadData();
  };

  const handleDeleteDept = async (deptId: string) => {
    await deleteDepartment(deptId);
    if (selectedDeptId === deptId) setSelectedDeptId(null);
    setConfirmDeleteDept(null);
    await loadData();
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim() || !selectedDeptId) return;
    if (!newMemberEmail.trim()) {
      setEmailError("邮箱为必填项");
      return;
    }
    if (!isValidEmail(newMemberEmail.trim())) {
      setEmailError("请输入有效的邮箱格式");
      return;
    }
    setEmailError("");
    await addMember({
      id: `m-${Date.now()}`,
      name: newMemberName.trim(),
      role: newMemberRole.trim() || "成员",
      departmentId: selectedDeptId,
      email: newMemberEmail.trim(),
    });
    setNewMemberName("");
    setNewMemberRole("");
    setNewMemberEmail("");
    setShowAddMember(false);
    await loadData();
  };

  const handleDeleteMember = async (memberId: string) => {
    await deleteMember(memberId);
    setConfirmDeleteMember(null);
    await loadData();
  };

  const handleEditMember = async () => {
    if (!editingMember || !editMemberName.trim()) return;
    if (!editMemberEmail.trim()) {
      setEditEmailError("邮箱为必填项");
      return;
    }
    if (!isValidEmail(editMemberEmail.trim())) {
      setEditEmailError("请输入有效的邮箱格式");
      return;
    }
    setEditEmailError("");
    // 删除旧的再创建新的（因为没有 updateMember API）
    await deleteMember(editingMember.id);
    await addMember({
      id: editingMember.id,
      name: editMemberName.trim(),
      role: editMemberRole.trim() || "成员",
      departmentId: editingMember.departmentId,
      email: editMemberEmail.trim(),
    });
    setEditingMember(null);
    await loadData();
  };

  const handleEditDept = async (deptId: string, name: string) => {
    await updateDepartment(deptId, name);
    setEditingDeptId(null);
    await loadData();
  };

  const renderDeptTree = (depts: Department[], level = 0) => {
    return depts.map((dept) => (
      <div key={dept.id} style={{ marginLeft: level * 20 }}>
        <div
          className={`dept-node ${selectedDeptId === dept.id ? "selected" : ""}`}
          onClick={() => setSelectedDeptId(dept.id)}
        >
          <span className="dept-icon">{dept.children?.length ? "📁" : "📂"}</span>
          {editingDeptId === dept.id ? (
            <input
              className="dept-edit-input"
              value={editDeptName}
              onChange={(e) => setEditDeptName(e.target.value)}
              onBlur={() => handleEditDept(dept.id, editDeptName)}
              onKeyDown={(e) => { if (e.key === "Enter") handleEditDept(dept.id, editDeptName); }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="dept-name"
              onDoubleClick={(e) => { e.stopPropagation(); setEditingDeptId(dept.id); setEditDeptName(dept.name); }}
            >
              {dept.name}
            </span>
          )}
          <span className="dept-count">{getMembersForDept(dept.id).length}人</span>
          <button
            className="dept-delete-btn"
            onClick={(e) => { e.stopPropagation(); setConfirmDeleteDept(dept.id); }}
            title="删除部门"
          >
            ×
          </button>
        </div>
        {dept.children && renderDeptTree(dept.children, level + 1)}
      </div>
    ));
  };

  const selectedDept = allDeptsFlatList().find((d) => d.id === selectedDeptId);
  const selectedMembers = selectedDeptId ? getMembersForDept(selectedDeptId) : [];

  if (loading) return <div className="empty-state">加载中...</div>;

  return (
    <div className="org-container">
      <div className="org-header">
        <h2>组织架构管理</h2>
        <button className="btn-primary" onClick={() => setShowAddDept(true)}>+ 添加部门</button>
      </div>

      <div className="org-content">
        <div className="org-tree">
          <div className="panel-title">部门结构</div>
          {departments.length === 0 ? (
            <div className="empty-state">暂无部门，点击上方按钮创建</div>
          ) : (
            renderDeptTree(departments)
          )}
        </div>

        <div className="org-detail">
          {selectedDept ? (
            <>
              <div className="panel-title">
                {selectedDept.name}
                {selectedDept.description && <span className="dept-description"> — {selectedDept.description}</span>}
              </div>
              <div className="member-header">
                <span>成员列表 ({selectedMembers.length})</span>
                <button className="btn-secondary" onClick={() => setShowAddMember(true)}>+ 添加成员</button>
              </div>
              <div className="member-list">
                {selectedMembers.map((member) => (
                  <div key={member.id} className="member-card">
                    <div className="member-avatar">{member.name.slice(0, 1)}</div>
                    <div className="member-info">
                      <div className="member-name">{member.name}</div>
                      <div className="member-role">{member.role}</div>
                      {member.email && <div className="member-email">{member.email}</div>}
                    </div>
                    <button className="member-edit-btn" onClick={() => { setEditingMember(member); setEditMemberName(member.name); setEditMemberRole(member.role); setEditMemberEmail(member.email || ""); setEditEmailError(""); }} title="编辑">✎</button>
                    <button className="member-delete-btn" onClick={() => setConfirmDeleteMember(member.id)} title="删除">×</button>
                  </div>
                ))}
                {selectedMembers.length === 0 && <div className="empty-state">暂无成员，点击上方按钮添加</div>}
              </div>
            </>
          ) : (
            <div className="empty-state">← 选择一个部门查看详情</div>
          )}
        </div>
      </div>

      {showAddDept && (
        <div className="modal-overlay" onClick={() => setShowAddDept(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>添加部门</h3>
            <div className="form-group">
              <label>部门名称</label>
              <input value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="输入部门名称" />
            </div>
            <div className="form-group">
              <label>描述</label>
              <input value={newDeptDesc} onChange={(e) => setNewDeptDesc(e.target.value)} placeholder="可选描述" />
            </div>
            <div className="form-group">
              <label>上级部门</label>
              <select value={newDeptParent || ""} onChange={(e) => setNewDeptParent(e.target.value || null)}>
                <option value="">无（顶级部门）</option>
                {allDeptsFlatList().map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddDept(false)}>取消</button>
              <button className="btn-primary" onClick={handleAddDept}>确认添加</button>
            </div>
          </div>
        </div>
      )}

      {showAddMember && (
        <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>添加成员到 {selectedDept?.name}</h3>
            <div className="form-group">
              <label>姓名</label>
              <input value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="输入姓名" />
            </div>
            <div className="form-group">
              <label>角色</label>
              <input value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)} placeholder="输入角色/职位" />
            </div>
            <div className="form-group">
              <label>Google 邮箱（必填）</label>
              <input value={newMemberEmail} onChange={(e) => { setNewMemberEmail(e.target.value); setEmailError(""); }} placeholder="example@gmail.com" type="email" />
              {emailError && <span className="form-error">{emailError}</span>}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowAddMember(false); setEmailError(""); }}>取消</button>
              <button className="btn-primary" onClick={handleAddMember}>确认添加</button>
            </div>
          </div>
        </div>
      )}

      {editingMember && (
        <div className="modal-overlay" onClick={() => setEditingMember(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>编辑成员</h3>
            <div className="form-group">
              <label>姓名</label>
              <input value={editMemberName} onChange={(e) => setEditMemberName(e.target.value)} placeholder="输入姓名" />
            </div>
            <div className="form-group">
              <label>角色</label>
              <input value={editMemberRole} onChange={(e) => setEditMemberRole(e.target.value)} placeholder="输入角色/职位" />
            </div>
            <div className="form-group">
              <label>Google 邮箱（必填）</label>
              <input value={editMemberEmail} onChange={(e) => { setEditMemberEmail(e.target.value); setEditEmailError(""); }} placeholder="example@gmail.com" type="email" />
              {editEmailError && <span className="form-error">{editEmailError}</span>}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setEditingMember(null)}>取消</button>
              <button className="btn-primary" onClick={handleEditMember}>保存修改</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteMember && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteMember(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>确认删除</h3>
            <p>确定要删除该成员吗？此操作不可撤销。</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteMember(null)}>取消</button>
              <button className="btn-danger" onClick={() => handleDeleteMember(confirmDeleteMember)}>确认删除</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteDept && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteDept(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>确认删除部门</h3>
            <p>确定要删除该部门吗？部门下的所有成员和子部门也会被删除，此操作不可撤销。</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteDept(null)}>取消</button>
              <button className="btn-danger" onClick={() => handleDeleteDept(confirmDeleteDept)}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
