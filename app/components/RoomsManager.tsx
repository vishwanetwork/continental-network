"use client";

import { useState, useEffect, useRef } from "react";
import type { Agent, Department, Member } from "../types";
import { getAgents, getDepartments, getMembers } from "../store";
import { useCurrentUser } from "./AuthGuard";

interface DropdownOption {
  id: string;
  label: string;
  sub?: string;
}

function MultiSelectDropdown({
  options,
  selected,
  onToggle,
  placeholder = "Select...",
}: {
  options: DropdownOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedLabels = options.filter((o) => selected.has(o.id)).map((o) => o.label);

  return (
    <div className="multi-select-dropdown" ref={ref}>
      <button type="button" className="multi-select-trigger" onClick={() => setOpen(!open)}>
        <span className="multi-select-text">
          {selectedLabels.length > 0 ? selectedLabels.join(", ") : placeholder}
        </span>
        <span className="multi-select-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="multi-select-menu">
          {options.length === 0 && <div className="multi-select-empty">No options available</div>}
          {options.map((opt) => (
            <label key={opt.id} className={`multi-select-option ${selected.has(opt.id) ? "checked" : ""}`}>
              <input
                type="checkbox"
                checked={selected.has(opt.id)}
                onChange={() => onToggle(opt.id)}
              />
              <span className="multi-select-option-label">{opt.label}</span>
              {opt.sub && <small className="multi-select-option-sub">{opt.sub}</small>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

interface WorkflowItem {
  id: string;
  name: string;
  stepCount: number;
}

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  memberIds: string[];
  agentIds: string[];
  workflowIds: string[];
}

export function loadRooms(): Room[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem("continental_rooms_v3");
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function saveRooms(rooms: Room[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("continental_rooms_v3", JSON.stringify(rooms));
}

export function getVisibleAgentIds(userEmail: string, members: Member[]): Set<string> | "all" {
  return "all";
}

export function getVisibleWorkflowIds(userId: string): Set<string> | "all" {
  const rooms = loadRooms();
  const visibleIds = new Set<string>();
  for (const room of rooms) {
    if (room.memberIds.includes(userId)) {
      for (const wfId of (room.workflowIds || [])) visibleIds.add(wfId);
    }
  }
  return visibleIds;
}

export function getVisibleAgentIdsByUserId(userId: string): Set<string> | "all" {
  return "all";
}

export default function RoomsManager() {
  const currentUser = useCurrentUser();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showEditRoom, setShowEditRoom] = useState(false);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Create/Edit form state
  const [formName, setFormName] = useState("");
  const [formMembers, setFormMembers] = useState<Set<string>>(new Set());
  const [formAgents, setFormAgents] = useState<Set<string>>(new Set());
  const [formWorkflows, setFormWorkflows] = useState<Set<string>>(new Set());

  const loadData = async () => {
    const [a] = await Promise.all([getAgents(), getDepartments()]);
    setAgents(a);
    // Load all users for member selection
    try {
      const usersRes = await fetch("/api/users");
      if (usersRes.ok) {
        const users = await usersRes.json();
        setMembers(users.map((u: { id: string; email: string; name: string }) => ({
          id: u.id,
          name: u.name || u.email.split("@")[0],
          email: u.email,
          role: "",
          departmentId: "",
        })));
      }
    } catch { /* ignore */ }
    try {
      const wfRes = await fetch("/api/workflows");
      if (wfRes.ok) setWorkflows(await wfRes.json());
    } catch { /* ignore */ }
    setRooms(loadRooms());
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const isOwner = (room: Room) => currentUser?.email === room.ownerEmail;

  const handleCreateRoom = () => {
    if (!formName.trim() || !currentUser) return;
    const room: Room = {
      id: `room-${Date.now()}`,
      name: formName.trim(),
      ownerId: currentUser.id,
      ownerEmail: currentUser.email,
      memberIds: Array.from(formMembers),
      agentIds: Array.from(formAgents),
      workflowIds: Array.from(formWorkflows),
    };
    const updated = [...rooms, room];
    setRooms(updated);
    saveRooms(updated);
    setSelectedRoomId(room.id);
    resetForm();
    setShowCreateRoom(false);
  };

  const handleEditRoom = () => {
    if (!selectedRoom || !formName.trim()) return;
    const updated = rooms.map((r) => {
      if (r.id !== selectedRoom.id) return r;
      return { ...r, name: formName.trim(), memberIds: Array.from(formMembers), agentIds: Array.from(formAgents), workflowIds: Array.from(formWorkflows) };
    });
    setRooms(updated);
    saveRooms(updated);
    setShowEditRoom(false);
    resetForm();
  };

  const handleDeleteRoom = (roomId: string) => {
    const updated = rooms.filter((r) => r.id !== roomId);
    setRooms(updated);
    saveRooms(updated);
    if (selectedRoomId === roomId) setSelectedRoomId(null);
    setConfirmDeleteRoom(null);
  };

  const openEditModal = () => {
    if (!selectedRoom) return;
    setFormName(selectedRoom.name);
    setFormMembers(new Set(selectedRoom.memberIds));
    setFormAgents(new Set(selectedRoom.agentIds));
    setFormWorkflows(new Set(selectedRoom.workflowIds || []));
    setShowEditRoom(true);
  };

  const resetForm = () => {
    setFormName("");
    setFormMembers(new Set());
    setFormAgents(new Set());
    setFormWorkflows(new Set());
  };

  const toggleFormMember = (id: string) => {
    setFormMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleFormAgent = (id: string) => {
    setFormAgents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleFormWorkflow = (id: string) => {
    setFormWorkflows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /></div>;

  const renderRoomModal = (title: string, onSubmit: () => void, onCancel: () => void, submitLabel: string) => (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div className="form-group">
          <label>Room Name</label>
          <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Marketing workspace" />
        </div>

        <div className="form-group">
          <label>Members</label>
          <MultiSelectDropdown
            options={members.map((m) => ({ id: m.id, label: m.name, sub: m.email || m.role }))}
            selected={formMembers}
            onToggle={toggleFormMember}
            placeholder="Select members..."
          />
        </div>

        <div className="form-group">
          <label>Workflows</label>
          <MultiSelectDropdown
            options={workflows.map((wf) => ({ id: wf.id, label: wf.name, sub: `${wf.stepCount} steps` }))}
            selected={formWorkflows}
            onToggle={toggleFormWorkflow}
            placeholder="Select workflows..."
          />
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={onSubmit} disabled={!formName.trim()}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="rooms-container">
      <div className="rooms-header">
        <h2>Rooms</h2>
        <button className="btn-primary" onClick={() => { resetForm(); setShowCreateRoom(true); }}>+ Create Room</button>
      </div>

      <div className="rooms-content">
        <div className="rooms-list">
          <div className="panel-title">Room List</div>
          {rooms.length === 0 && <div className="empty-state">No Rooms yet</div>}
          {rooms.map((room) => (
            <div
              key={room.id}
              className={`room-card ${selectedRoomId === room.id ? "selected" : ""}`}
              onClick={() => setSelectedRoomId(room.id)}
            >
              <div className="room-card-name">{room.name}</div>
              <div className="room-card-meta">
                {room.memberIds.length} Members · {room.agentIds.length} Agents
                {isOwner(room) && <span className="room-owner-badge">Owner</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="rooms-detail">
          {selectedRoom ? (
            <div className="room-config">
              <div className="room-detail-header">
                <h3>{selectedRoom.name}</h3>
                {isOwner(selectedRoom) && (
                  <div className="room-detail-actions">
                    <button className="btn-secondary" onClick={openEditModal}>Edit</button>
                    <button className="btn-danger" onClick={() => setConfirmDeleteRoom(selectedRoom.id)}>Delete</button>
                  </div>
                )}
              </div>
              <div className="room-owner-info">Owner: {selectedRoom.ownerEmail}</div>

              <div className="room-section">
                <div className="panel-title">Workflows ({(selectedRoom.workflowIds || []).length})</div>
                <div className="room-member-chips">
                  {(selectedRoom.workflowIds || []).map((wid) => {
                    const wf = workflows.find((x) => x.id === wid);
                    return wf ? <span key={wid} className="room-chip">{wf.name}</span> : null;
                  })}
                  {(selectedRoom.workflowIds || []).length === 0 && <span className="empty-hint">No workflows assigned</span>}
                </div>
              </div>

              <div className="room-section">
                <div className="panel-title">Members ({selectedRoom.memberIds.length})</div>
                <div className="room-member-chips">
                  {selectedRoom.memberIds.map((mid) => {
                    const m = members.find((x) => x.id === mid);
                    return m ? <span key={mid} className="room-chip">{m.name}</span> : null;
                  })}
                  {selectedRoom.memberIds.length === 0 && <span className="empty-hint">No members assigned</span>}
                </div>
              </div>

              <div className="room-section">
                <div className="panel-title">Agents ({selectedRoom.agentIds.length})</div>
                <div className="room-member-chips">
                  {selectedRoom.agentIds.map((aid) => {
                    const a = agents.find((x) => x.id === aid);
                    return a ? <span key={aid} className="room-chip">{a.name}</span> : null;
                  })}
                  {selectedRoom.agentIds.length === 0 && <span className="empty-hint">No agents assigned</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">← Select a Room to view details</div>
          )}
        </div>
      </div>

      {showCreateRoom && renderRoomModal("Create Room", handleCreateRoom, () => setShowCreateRoom(false), "Create")}
      {showEditRoom && renderRoomModal("Edit Room", handleEditRoom, () => setShowEditRoom(false), "Save Changes")}

      {confirmDeleteRoom && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteRoom(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this Room?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteRoom(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDeleteRoom(confirmDeleteRoom)}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
