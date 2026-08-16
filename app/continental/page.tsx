"use client";

import { useState } from "react";
import Layout, { MainView } from "../components/Layout";
import Organization from "../components/Organization";
import AgentManager from "../components/AgentManager";
import WorkflowPanel from "../components/WorkflowPanel";

export default function ContinentalApp() {
  const [currentView, setCurrentView] = useState<MainView>("organization");

  const renderView = () => {
    switch (currentView) {
      case "organization":
        return <Organization />;
      case "agents":
        return <AgentManager />;
      case "workflows":
        return <WorkflowPanel />;
      case "intake":
      case "contractors":
      case "quests":
      case "rooms":
        return (
          <div className="legacy-placeholder">
            <p>此功能来自原始 MVP 演示，正在逐步实现中...</p>
            <p>请切换到"组织架构"、"AGENT管理"或"工作流"查看已实现的功能</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      {renderView()}
    </Layout>
  );
}
