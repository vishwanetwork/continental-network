"use client";

import { useState, useEffect } from "react";
import type { Agent, Department, Member } from "../types";
import { getAgents, getDepartments, getMembers } from "../store";

export interface Room {
  id: string;
  name: string;
  memberIds: string[];
  agentIds: string[];
}

export function loadRooms(): Room[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem("continental_rooms_v2");
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function saveRooms(rooms: Room[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("continental_rooms_v2", JSON.stringify(rooms));
}

// 根据用户邮箱获取可见的 agent IDs
export function getVisibleAgentIds(userEmail: string, members: Member[]): Set<string> | "all" {
  const rooms = loadRooms();
  if (rooms.length === 0) return "all";

  const currentMember = members.find((m) => m.email === userEmail);
  if (!currentMember) return new Set();

  const visibleIds = new Set<string>();
  for (const room of rooms) {
    if (room.memberIds.includes(currentMember.id)) {
      for (const agentId of room.agentIds) {
        visibleIds.add(agentId);
      }
    }
  }
  return visibleIds;
}

export default function RoomsManager() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const [a, d, m] = await Promise.all([getAgents(), getDepartments(), getMembers()]);
    setAgents(a);
    setDepartments(d);
    setMembers(m);
    setRooms(loadRooms());
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) return;
    const room: Room = {
      id: `room-${Date.now()}`,
      name: newRoomName.trim(),
      memberIds: [],
      agentIds: [],
    };
    const updated = [...rooms, room];
    setRooms(updated);
    saveRooms(updated);
    setSelectedRoomId(room.id);
    setNewRoomName("");
    setShowCreateRoom(false);
  };

  const handleDeleteRoom = (roomId: string) => {
    const updated = rooms.filter((r) => r.id !== roomId);
    setRooms(updated);
    saveRooms(updated);
    if (selectedRoomId === roomId) setSelectedRoomId(null);
    setConfirmDeleteRoom(null);
  };

  const toggleMember = (memberId: string) => {
    if (!selectedRoom) return;
    const updated = rooms.map((r) => {
      if (r.id !== selectedRoom.id) return r;
      const has = r.memberIds.includes(memberId);
      return { ...r, memberIds: has ? r.memberIds.filter((id) => id !== memberId) : [...r.memberIds, memberId] };
    });
    setRooms(updated);
    saveRooms(updated);
  };

  const toggleAgent = (agentId: string) => {
    if (!selectedRoom) return;
    const updated = rooms.map((r) => {
      if (r.id !== selectedRoom.id) return r;
      const has = r.agentIds.includes(agentId);
      return { ...r, agentIds: has ? r.agentIds.filter((id) => id !== agentId) : [...r.agentIds, agentId] };
    });
    setRooms(updated);
    saveRooms(updated);
  };

  if (loading) return <div className="empty-state">加载中...</div>;

  return (
    <div className="rooms-container">
      <div className="rooms-header">
        <h2>Rooms 工作间</h2>
        <button className="btn-primary" onClick={() => setShowCreateRoom(true)}>+ 创建 Room</button>
      </div>

      <div className="rooms-content">
        <div className="rooms-list">
          <div className="panel-title">Room 列表</div>
          {rooms.length === 0 && <div className="empty-state">暂无 Room</div>}
          {rooms.map((room) => (
            <div
              key={room.id}
              className={`room-card ${selectedRoomId === room.id ? "selected" : ""}`}
              onClick={() => setSelectedRoomId(room.id)}
            >
              <div className="room-card-name">{room.name}</div>
              <div className="room-card-meta">
                {room.memberIds.length} 成员 · {room.agentIds.length} Agent
              </div>
              <button className="dept-delete-btn" onClick={(e) => { e.stopPropagation(); setConfirmDeleteRoom(room.id); }}>×</button>
            </div>
          ))}
        </div>

        <div className="rooms-detail">
          {selectedRoom ? (
            <div className="room-config">
              <h3>{selectedRoom.name}</h3>

              <div className="room-section">
                <div className="panel-title">成员（勾选可访问此 Room 的人）</div>
                <div className="room-checklist">
                  {members.length === 0 && <div className="empty-state">请先在组织架构中添加成员</div>}
                  {members.map((m) => (
                    <label key={m.id} className="room-check-item">
                      <input
                        type="checkbox"
                        checked={selectedRoom.memberIds.includes(m.id)}
                        onChange={() => toggleMember(m.id)}
                      />
                      <span>{m.name}</span>
                      <span className="room-check-meta">{m.email || "无邮箱"}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="room-section">
                <div className="panel-title">Agent（勾选此 Room 可使用的 Agent）</div>
                <div className="room-checklist">
                  {agents.length === 0 && <div className="empty-state">请先创建 Agent</div>}
                  {agents.map((a) => (
                    <label key={a.id} className="room-check-item">
                      <input
                        type="checkbox"
                        checked={selectedRoom.agentIds.includes(a.id)}
                        onChange={() => toggleAgent(a.id)}
                      />
                      <span>{a.name}</span>
                      <span className="room-check-meta">{a.type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">← 选择一个 Room 管理权限</div>
          )}
        </div>
      </div>

      {showCreateRoom && (
        <div className="modal-overlay" onClick={() => setShowCreateRoom(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>创建 Room</h3>
            <div className="form-group">
              <label>Room 名称</label>
              <input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="如：市场部工作间" />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreateRoom(false)}>取消</button>
              <button className="btn-primary" onClick={handleCreateRoom}>创建</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteRoom && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteRoom(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>确认删除</h3>
            <p>确定要删除该 Room 吗？</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteRoom(null)}>取消</button>
              <button className="btn-danger" onClick={() => handleDeleteRoom(confirmDeleteRoom)}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
