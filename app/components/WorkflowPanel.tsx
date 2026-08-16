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

  // 分镜头生成状态
  const [productInput, setProductInput] = useState("");
  const [styleInput, setStyleInput] = useState("");
  const [selectedKBId, setSelectedKBId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState("");
  const [error, setError] = useState("");

  // 视频生成状态
  const [videoInput, setVideoInput] = useState("");
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoResult, setVideoResult] = useState("");

  // 知识库管理
  const [newDocName, setNewDocName] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [showAddDoc, setShowAddDoc] = useState(false);

  useEffect(() => {
    setKnowledgeBases(getKnowledgeBases());
  }, []);

  const handleGenerateStoryboard = async () => {
    if (!productInput.trim()) {
      setError("请输入产品信息");
      return;
    }
    setError("");
    setGenerating(true);
    setGeneratedResult("");

    try {
      // 获取知识库上下文
      let context = "";
      if (selectedKBId) {
        const kb = knowledgeBases.find((k) => k.id === selectedKBId);
        if (kb) {
          context = kb.documents.map((d) => d.content).join("\n\n");
        }
      }

      const result = await generateStoryboard(productInput, context, styleInput);
      setGeneratedResult(result);

      // 尝试解析并保存
      try {
        const scenes = JSON.parse(result);
        const storyboard: Storyboard = {
          id: `sb-${Date.now()}`,
          title: `${productInput.slice(0, 20)} - 分镜头脚本`,
          product: productInput,
          scenes: scenes as StoryboardScene[],
          createdAt: new Date().toISOString().slice(0, 10),
          status: "draft",
        };
        setStoryboards((prev) => [...prev, storyboard]);
      } catch {
        // AI 返回内容可能不是纯 JSON，保留原文显示
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成失败，请重试");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!videoInput.trim()) {
      setError("请输入分镜头脚本内容");
      return;
    }
    setError("");
    setVideoGenerating(true);
    setVideoResult("");

    try {
      const result = await generateVideoScript(videoInput);
      setVideoResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成失败，请重试");
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
      name: "新知识库",
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
        <h2>Agent 工作流</h2>
        <div className="workflow-tabs">
          <button
            className={`tab-btn ${tab === "storyboard" ? "active" : ""}`}
            onClick={() => setTab("storyboard")}
          >
            📝 分镜头脚本生成
          </button>
          <button
            className={`tab-btn ${tab === "video" ? "active" : ""}`}
            onClick={() => setTab("video")}
          >
            🎬 视频制作指南
          </button>
          <button
            className={`tab-btn ${tab === "knowledge" ? "active" : ""}`}
            onClick={() => setTab("knowledge")}
          >
            📚 知识库管理
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {tab === "storyboard" && (
        <div className="workflow-content">
          <div className="workflow-input-section">
            <div className="form-group">
              <label>产品/主题信息</label>
              <textarea
                value={productInput}
                onChange={(e) => setProductInput(e.target.value)}
                placeholder="描述你要制作视频的产品或主题，例如：Continental Network 平台介绍视频，展示 AI Agent 工作流管理功能..."
                rows={4}
              />
            </div>
            <div className="form-group">
              <label>选择知识库（可选）</label>
              <select
                value={selectedKBId}
                onChange={(e) => setSelectedKBId(e.target.value)}
              >
                <option value="">不使用知识库</option>
                {knowledgeBases.map((kb) => (
                  <option key={kb.id} value={kb.id}>
                    {kb.name} ({kb.documents.length} 篇文档)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>风格要求（可选）</label>
              <input
                value={styleInput}
                onChange={(e) => setStyleInput(e.target.value)}
                placeholder="例如：科技感、简洁、面向企业用户"
              />
            </div>
            <button
              className="btn-primary btn-large"
              onClick={handleGenerateStoryboard}
              disabled={generating}
            >
              {generating ? "⏳ 正在生成..." : "🚀 生成分镜头脚本"}
            </button>
          </div>

          {generatedResult && (
            <div className="workflow-result">
              <div className="result-header">
                <span>生成结果</span>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setVideoInput(generatedResult);
                    setTab("video");
                  }}
                >
                  → 用于视频生成
                </button>
              </div>
              <pre className="result-content">{generatedResult}</pre>
            </div>
          )}

          {storyboards.length > 0 && (
            <div className="storyboard-history">
              <div className="panel-title">历史生成记录</div>
              {storyboards.map((sb) => (
                <div key={sb.id} className="storyboard-card">
                  <span className="sb-title">{sb.title}</span>
                  <span className="sb-date">{sb.createdAt}</span>
                  <span className="sb-scenes">{sb.scenes.length} 个镜头</span>
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
              <label>分镜头脚本内容</label>
              <textarea
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                placeholder="粘贴分镜头脚本内容，或从上一步自动导入..."
                rows={8}
              />
            </div>
            <button
              className="btn-primary btn-large"
              onClick={handleGenerateVideo}
              disabled={videoGenerating}
            >
              {videoGenerating ? "⏳ 正在生成..." : "🎬 生成视频制作指南"}
            </button>
          </div>

          {videoResult && (
            <div className="workflow-result">
              <div className="result-header">视频制作指南</div>
              <pre className="result-content">{videoResult}</pre>
            </div>
          )}
        </div>
      )}

      {tab === "knowledge" && (
        <div className="workflow-content">
          <div className="kb-header">
            <button className="btn-secondary" onClick={handleCreateKB}>
              + 创建知识库
            </button>
            <button className="btn-secondary" onClick={() => setShowAddDoc(true)}>
              + 添加文档
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
                <h3>添加文档到知识库</h3>
                <div className="form-group">
                  <label>文档名称</label>
                  <input
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    placeholder="文档标题"
                  />
                </div>
                <div className="form-group">
                  <label>文档内容</label>
                  <textarea
                    value={newDocContent}
                    onChange={(e) => setNewDocContent(e.target.value)}
                    placeholder="输入文档内容..."
                    rows={8}
                  />
                </div>
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setShowAddDoc(false)}>
                    取消
                  </button>
                  <button className="btn-primary" onClick={handleAddDocument}>
                    添加
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
