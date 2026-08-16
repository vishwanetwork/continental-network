"use client";

import { useState, ReactNode } from "react";

export type MainView =
  | "organization"
  | "agents"
  | "workflows"
  | "intake"
  | "contractors"
  | "quests"
  | "rooms";

const navItems: Array<{ code: string; label: string; view: MainView }> = [
  { code: "01", label: "组织架构", view: "organization" },
  { code: "02", label: "AGENT管理", view: "agents" },
  { code: "03", label: "工作流", view: "workflows" },
  { code: "04", label: "COMMAND", view: "intake" },
  { code: "05", label: "CONTRACTORS", view: "contractors" },
  { code: "06", label: "QUESTS", view: "quests" },
  { code: "07", label: "ROOMS", view: "rooms" },
];

export default function Layout({
  currentView,
  onViewChange,
  children,
}: {
  currentView: MainView;
  onViewChange: (view: MainView) => void;
  children: ReactNode;
}) {
  return (
    <div className="continental-shell">
      <nav className="continental-nav">
        <div className="nav-brand">
          <span className="brand-mark">◆</span>
          <span className="brand-name">CONTINENTAL</span>
        </div>
        <div className="nav-items">
          {navItems.map((item) => (
            <button
              key={item.view}
              className={`nav-item ${currentView === item.view ? "active" : ""}`}
              onClick={() => onViewChange(item.view)}
            >
              <span className="nav-code">{item.code}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <main className="continental-main">{children}</main>
    </div>
  );
}
