"use client";

import { useState, useEffect } from "react";
import type { KnowledgeBase, Storyboard, StoryboardScene } from "../types";
import { getKnowledgeBases, saveKnowledgeBases } from "../store";
import { generateStoryboard, generateVideoScript } from "../lib/deepseek";

type WorkflowTab = "storyboard" | "video" | "knowledge";

export default function WorkflowPanel() {
  const [tab, setTab] = useState<WorkflowTab>("storyboard");
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);

  // Storyboard generation state
  const [productInput, setProductInput] = useState("");
  const [styleInput, setStyleInput] = useState("");
  const [selectedKBId, setSelectedKBId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState("");
  const [error, setError] = useState("");

  // Video generation state
  const [videoInput, setVideoInput] = useState("");
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoResult, setVideoResult] = useState("");

  // Knowledge base management
  const [newDocName, setNewDocName] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [showAddDoc, setShowAddDoc] = useState(false);

  useEffect(() => {
    setKnowledgeBases(getKnowledgeBases());
  }, []);

  const handleGenerateStoryboard = async () => {
    if (!productInput.trim()) {
      setError("Please enter product information");
      return;
    }
    setError("");
    setGenerating(true);
    setGeneratedResult("");

    try {
      // Get knowledge base context
      let context = "";
      if (selectedKBId) {
        const kb = knowledgeBases.find((k) => k.id === selectedKBId);
        if (kb) {
          context = kb.documents.map((d) => d.content).join("\n\n");
        }
      }

      const result = await generateStoryboard(productInput, context, styleInput);
      setGeneratedResult(result);

      // Try to parse and save
      try {
        const scenes = JSON.parse(result);
        const storyboard: Storyboard = {
          id: `sb-${Date.now()}`,
          title: `${productInput.slice(0, 20)} - Storyboard`,
          product: productInput,
          scenes: scenes as StoryboardScene[],
          createdAt: new Date().toISOString().slice(0, 10),
          status: "draft",
        };
        setStoryboards((prev) => [...prev, storyboard]);
      } catch {
        // AI response might not be pure JSON, keep original text for display
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed, please retry");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!videoInput.trim()) {
      setError("Please enter storyboard content");
      return;
    }
    setError("");
    setVideoGenerating(true);
    setVideoResult("");

    try {
      const result = await generateVideoScript(videoInput);
      setVideoResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed, please retry");
    } finally {
      setVideoGenerating(false);
    }
  };

  const handleAddDocument = () => {
    if (!newDocName.trim() || !newDocContent.trim()) return;
    const updated = knowledgeBases.map((kb) => {
      if (kb.id === (selectedKBId || knowledgeBases[0]?.id)) {
        return {
          ...kb,
          documents: [
            ...kb.documents,
            {
              id: `doc-${Date.now()}`,
              name: newDocName.trim(),
              content: newDocContent.trim(),
              type: "text" as const,
              createdAt: new Date().toISOString().slice(0, 10),
            },
          ],
        };
      }
      return kb;
    });
    setKnowledgeBases(updated);
    saveKnowledgeBases(updated);
    setNewDocName("");
    setNewDocContent("");
    setShowAddDoc(false);
  };

  const handleCreateKB = () => {
    const newKB: KnowledgeBase = {
      id: `kb-${Date.now()}`,
      name: "New Knowledge Base",
      documents: [],
    };
    const updated = [...knowledgeBases, newKB];
    setKnowledgeBases(updated);
    saveKnowledgeBases(updated);
    setSelectedKBId(newKB.id);
  };

  return (
    <div className="workflow-container">
      <div className="workflow-header">
        <h2>Agent Workflows</h2>
        <div className="workflow-tabs">
          <button
            className={`tab-btn ${tab === "storyboard" ? "active" : ""}`}
            onClick={() => setTab("storyboard")}
          >
            📝 Storyboard Generation
          </button>
          <button
            className={`tab-btn ${tab === "video" ? "active" : ""}`}
            onClick={() => setTab("video")}
          >
            🎬 Video Production Guide
          </button>
          <button
            className={`tab-btn ${tab === "knowledge" ? "active" : ""}`}
            onClick={() => setTab("knowledge")}
          >
            📚 Knowledge Base
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {tab === "storyboard" && (
        <div className="workflow-content">
          <div className="workflow-input-section">
            <div className="form-group">
              <label>Product / Topic Information</label>
              <textarea
                value={productInput}
                onChange={(e) => setProductInput(e.target.value)}
                placeholder="Describe the product or topic for the video, e.g.: Continental Network platform intro video showcasing AI Agent workflow management..."
                rows={4}
              />
            </div>
            <div className="form-group">
              <label>Select Knowledge Base (optional)</label>
              <select
                value={selectedKBId}
                onChange={(e) => setSelectedKBId(e.target.value)}
              >
                <option value="">No knowledge base</option>
                {knowledgeBases.map((kb) => (
                  <option key={kb.id} value={kb.id}>
                    {kb.name} ({kb.documents.length} docs)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Style Requirements (optional)</label>
              <input
                value={styleInput}
                onChange={(e) => setStyleInput(e.target.value)}
                placeholder="e.g.: tech-focused, minimalist, enterprise-oriented"
              />
            </div>
            <button
              className="btn-primary btn-large"
              onClick={handleGenerateStoryboard}
              disabled={generating}
            >
              {generating ? "⏳ Generating..." : "🚀 Generate Storyboard"}
            </button>
          </div>

          {generatedResult && (
            <div className="workflow-result">
              <div className="result-header">
                <span>Generated Result</span>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setVideoInput(generatedResult);
                    setTab("video");
                  }}
                >
                  → Use for Video Generation
                </button>
              </div>
              <pre className="result-content">{generatedResult}</pre>
            </div>
          )}

          {storyboards.length > 0 && (
            <div className="storyboard-history">
              <div className="panel-title">Generation History</div>
              {storyboards.map((sb) => (
                <div key={sb.id} className="storyboard-card">
                  <span className="sb-title">{sb.title}</span>
                  <span className="sb-date">{sb.createdAt}</span>
                  <span className="sb-scenes">{sb.scenes.length} scenes</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "video" && (
        <div className="workflow-content">
          <div className="workflow-input-section">
            <div className="form-group">
              <label>Storyboard Script Content</label>
              <textarea
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                placeholder="Paste storyboard content, or auto-import from previous step..."
                rows={8}
              />
            </div>
            <button
              className="btn-primary btn-large"
              onClick={handleGenerateVideo}
              disabled={videoGenerating}
            >
              {videoGenerating ? "⏳ Generating..." : "🎬 Generate Video Production Guide"}
            </button>
          </div>

          {videoResult && (
            <div className="workflow-result">
              <div className="result-header">Video Production Guide</div>
              <pre className="result-content">{videoResult}</pre>
            </div>
          )}
        </div>
      )}

      {tab === "knowledge" && (
        <div className="workflow-content">
          <div className="kb-header">
            <button className="btn-secondary" onClick={handleCreateKB}>
              + Create Knowledge Base
            </button>
            <button className="btn-secondary" onClick={() => setShowAddDoc(true)}>
              + Add Document
            </button>
          </div>

          {knowledgeBases.map((kb) => (
            <div key={kb.id} className="kb-section">
              <div className="panel-title">{kb.name}</div>
              <div className="doc-list">
                {kb.documents.map((doc) => (
                  <div key={doc.id} className="doc-card">
                    <div className="doc-name">{doc.name}</div>
                    <div className="doc-preview">
                      {doc.content.slice(0, 100)}...
                    </div>
                    <div className="doc-meta">{doc.createdAt}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {showAddDoc && (
            <div className="modal-overlay" onClick={() => setShowAddDoc(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>Add Document to Knowledge Base</h3>
                <div className="form-group">
                  <label>Document Name</label>
                  <input
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    placeholder="Document title"
                  />
                </div>
                <div className="form-group">
                  <label>Document Content</label>
                  <textarea
                    value={newDocContent}
                    onChange={(e) => setNewDocContent(e.target.value)}
                    placeholder="Enter document content..."
                    rows={8}
                  />
                </div>
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setShowAddDoc(false)}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={handleAddDocument}>
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
