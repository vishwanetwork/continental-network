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
            <p>This feature is from the original MVP demo and is being progressively implemented...</p>
            <p>Please switch to "Organization", "Agents" or "Workflows" to view implemented features.</p>
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
