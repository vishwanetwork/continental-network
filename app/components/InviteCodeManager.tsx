"use client";

import { useState, useEffect } from "react";

interface InviteCode {
  id: number;
  code: string;
  organization_id: string;
  created_by: string;
  used: boolean;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

interface Props {
  organizationId: string;
}

export default function InviteCodeManager({ organizationId }: Props) {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const loadCodes = async () => {
    try {
      const res = await fetch(`/api/organizations/${organizationId}/invite-codes`, { credentials: "include" });
      if (res.ok) setCodes(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadCodes(); }, [organizationId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setNewCode(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/invite-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setNewCode(data.code);
        await loadCodes();
      }
    } catch { /* ignore */ }
    setGenerating(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast("Copied to clipboard");
  };

  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /></div>;

  return (
    <div className="invite-code-container">
      {toast && (
        <div className="agent-toast success" style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 200 }}>
          ✓ {toast}
        </div>
      )}
      <div className="invite-code-header">
        <h2>Invite Code Management</h2>
        <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating..." : "+ Generate Code"}
        </button>
      </div>

      <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 16 }}>
        Invite codes are one-time use. Share with members who need to join.
      </p>

      {newCode && (
        <div className="invite-code-new">
          <span>New code: </span>
          <strong>{newCode}</strong>
          <button className="btn-secondary btn-small" onClick={() => copyCode(newCode)}>Copy</button>
        </div>
      )}

      <div className="invite-code-list">
        <div className="panel-title">All Invite Codes</div>
        {codes.length === 0 && <div className="empty-state">No codes yet. Click the button above to generate one.</div>}
        {codes.map((code) => (
          <div key={code.id} className={`invite-code-item ${code.used ? "used" : "active"}`}>
            <div className="invite-code-value">
              <span className="invite-code-text">{code.code}</span>
              {!code.used && (
                <button className="btn-secondary btn-small" onClick={() => copyCode(code.code)}>Copy</button>
              )}
            </div>
            <div className="invite-code-meta">
              <span>{code.used ? `✓ Used` : "⏳ Available"}</span>
              <span>{new Date(code.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
