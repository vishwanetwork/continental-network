import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import crypto from "crypto";
import { createRequire } from "module";
import multer from "multer";
import iconv from "iconv-lite";
import mammoth from "mammoth";
const require = createRequire(import.meta.url);
const archiver = require("archiver");
const pdfParse = require("pdf-parse");
const XLSX = require("xlsx");
const AdmZip = require("adm-zip");
import { execFile } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { writeFile, unlink } from "fs/promises";
import { config } from "dotenv";
import { getOAuthConfig } from "./oauth-config.mjs";
config();

// ffmpeg-static provides a bundled ffmpeg binary path
let ffmpegPath;
try {
  ffmpegPath = require("ffmpeg-static");
} catch { ffmpegPath = null; }

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// ============ Google OAuth Configuration ============
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const { googleRedirectUri: GOOGLE_REDIRECT_URI, publicAppUrl: PUBLIC_APP_URL } = getOAuthConfig();

// Session cache (runtime only, auto-recovered from DB on miss)
const sessions = new Map();

async function saveSession(sessionId, user) {
  sessions.set(sessionId, user);
  // Persist session_id to user mapping in users table
  try {
    await pool.execute("UPDATE users SET session_id = ? WHERE id = ?", [sessionId, user.id]);
  } catch { /* ignore */ }
}

async function deleteSession(sessionId) {
  sessions.delete(sessionId);
  try { await pool.execute("UPDATE users SET session_id = NULL WHERE session_id = ?", [sessionId]); } catch { /* ignore */ }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "",
  password: process.env.DB_PASSWORD || "",
  database: "workflow",
  waitForConnections: true,
  connectionLimit: 10,
  ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
});

// Initialize table schema
async function initTables() {
  const conn = await pool.getConnection();
  // Wrap execute: DDL/statements without params must use query() on real MySQL
  const origExecute = conn.execute.bind(conn);
  conn.execute = (sql, params) => {
    if (!params || params.length === 0) return conn.query(sql);
    return origExecute(sql, params);
  };
  try {
    await conn.execute("CREATE DATABASE IF NOT EXISTS workflow");
    await conn.execute("USE workflow");

    // Drop old tables that conflict with new schema
    await conn.execute("DROP TABLE IF EXISTS agent_assignments");
    await conn.execute("DROP TABLE IF EXISTS members");
    await conn.execute("DROP TABLE IF EXISTS knowledge_bases");
    await conn.execute("DROP TABLE IF EXISTS kb_documents");

    // Users (keep existing)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(256) NOT NULL UNIQUE,
        name VARCHAR(128) DEFAULT '',
        avatar VARCHAR(512) DEFAULT '',
        google_id VARCHAR(128) DEFAULT '',
        session_id VARCHAR(128) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add session_id column if not exists
    try {
      await conn.execute("ALTER TABLE users ADD COLUMN session_id VARCHAR(128) DEFAULT NULL");
    } catch { /* column already exists */ }

    // Organizations
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS organizations (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        created_by VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Organization members
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS org_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        email VARCHAR(256) NOT NULL,
        role VARCHAR(32) DEFAULT 'member',
        status VARCHAR(32) DEFAULT 'approved',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_org_user (organization_id, user_id)
      )
    `);
    // Ensure status column exists (for tables created before this migration)
    try {
      await conn.execute("ALTER TABLE org_members ADD COLUMN status VARCHAR(32) DEFAULT 'approved'");
    } catch { /* column already exists */ }
    // Fix any NULL status values
    await conn.execute("UPDATE org_members SET status = 'approved' WHERE status IS NULL");

    // Add department_id to org_members if not exists
    try {
      await conn.execute("ALTER TABLE org_members ADD COLUMN department_id VARCHAR(64) NULL");
    } catch { /* column already exists */ }
    try {
      await conn.execute("ALTER TABLE org_members ADD COLUMN applied_department_id VARCHAR(64) NULL");
    } catch { /* column already exists */ }

    // Departments
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS departments (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        parent_id VARCHAR(64) NULL,
        leader_user_id VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Agent permissions
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS agent_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        organization_id VARCHAR(64) NOT NULL,
        target_type VARCHAR(32) DEFAULT 'all',
        target_id VARCHAR(64) NULL,
        UNIQUE KEY unique_perm (agent_id, target_type, target_id)
      )
    `);

    // Workflow permissions
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS workflow_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        workflow_id VARCHAR(64) NOT NULL,
        organization_id VARCHAR(64) NOT NULL,
        target_type VARCHAR(32) DEFAULT 'all',
        target_id VARCHAR(64) NULL,
        UNIQUE KEY unique_perm (workflow_id, target_type, target_id)
      )
    `);

    // Agent chat messages
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS agent_chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        role VARCHAR(16) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Agent user ratings
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS agent_ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        score DECIMAL(2,1) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_agent_user_rating (agent_id, user_id)
      )
    `);

    // Invite codes (one-time use)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS invite_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(64) NOT NULL UNIQUE,
        organization_id VARCHAR(64) NOT NULL,
        created_by VARCHAR(64) NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        used_by VARCHAR(64) NULL,
        used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Agent knowledge base (feeding)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS agent_knowledge (
        id VARCHAR(64) PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        organization_id VARCHAR(64) DEFAULT '',
        name VARCHAR(256) NOT NULL,
        type VARCHAR(32) DEFAULT 'text',
        content LONGTEXT NOT NULL,
        summary TEXT,
        created_by VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add organization_id column if not exists
    try {
      await conn.execute("ALTER TABLE agent_knowledge ADD COLUMN organization_id VARCHAR(64) DEFAULT ''");
    } catch { /* already exists */ }

    // AI model settings
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ai_model_settings (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        provider VARCHAR(64) NOT NULL,
        api_url VARCHAR(512) NOT NULL,
        api_key VARCHAR(512) DEFAULT '',
        model_name VARCHAR(128) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        user_id VARCHAR(64) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add user_id column if not exists (migration for existing tables)
    try {
      await conn.execute("ALTER TABLE ai_model_settings ADD COLUMN user_id VARCHAR(64) DEFAULT NULL");
    } catch { /* column already exists */ }

    // Seed global preset AI models (user_id IS NULL means preset/template)
    await conn.execute(`INSERT IGNORE INTO ai_model_settings (id, name, provider, api_url, api_key, model_name, enabled, user_id) VALUES
      ('model-deepseek', 'DeepSeek', 'deepseek', 'https://api.deepseek.com/chat/completions', '', 'deepseek-chat', TRUE, NULL),
      ('model-qwen', 'qwen3.8-max', 'qwen3.8-max', 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', '', 'qwen3.8-max', FALSE, NULL)
    `);
    // Migrate: replace old chatgpt preset with qwen if it exists
    await conn.execute("UPDATE ai_model_settings SET id = 'model-qwen', name = 'qwen3.8-max', provider = 'qwen3.8-max', api_url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model_name = 'qwen3.8-max' WHERE id = 'model-chatgpt' AND user_id IS NULL").catch(() => {});
    // Also fix existing qwen presets with wrong name/provider
    await conn.execute("UPDATE ai_model_settings SET name = 'qwen3.8-max', provider = 'qwen3.8-max', model_name = 'qwen3.8-max' WHERE id = 'model-qwen' AND user_id IS NULL").catch(() => {});

    // Sync environment variable keys into preset/template models only (user_id IS NULL)
    const envDeepseekKey = process.env.DEEPSEEK_API_KEY || process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || "";
    const envQwenKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || "";
    if (envDeepseekKey) {
      await conn.execute("UPDATE ai_model_settings SET api_key = ? WHERE id = 'model-deepseek' AND user_id IS NULL AND (api_key = '' OR api_key IS NULL)", [envDeepseekKey]);
    }
    if (envQwenKey) {
      await conn.execute("UPDATE ai_model_settings SET api_key = ? WHERE id = 'model-qwen' AND user_id IS NULL AND (api_key = '' OR api_key IS NULL)", [envQwenKey]);
    }

    // Ensure only one preset model is enabled at a time (preset = user_id IS NULL)
    const [enabledModels] = await conn.execute("SELECT id FROM ai_model_settings WHERE enabled = TRUE AND user_id IS NULL");
    if (enabledModels.length > 1) {
      await conn.execute("UPDATE ai_model_settings SET enabled = FALSE WHERE id != 'model-deepseek' AND user_id IS NULL");
    } else if (enabledModels.length === 0) {
      await conn.execute("UPDATE ai_model_settings SET enabled = TRUE WHERE id = 'model-deepseek' AND user_id IS NULL");
    }

    // Agent chat history (persistent context)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS agent_chat_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        role VARCHAR(16) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_agent_user (agent_id, user_id)
      )
    `);

    // Add rating column to agents if not exists (stores average)
    // NOTE: agents table is created below, but we need it before these UPDATEs
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        description TEXT,
        type VARCHAR(64) NOT NULL,
        input_format VARCHAR(64) NOT NULL,
        output_format VARCHAR(64) NOT NULL,
        provider VARCHAR(64) NOT NULL,
        config JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    try {
      await conn.execute("ALTER TABLE agents ADD COLUMN rating DECIMAL(3,1) DEFAULT 5.0");
    } catch { /* column already exists */ }
    try {
      await conn.execute("ALTER TABLE agents ADD COLUMN created_by VARCHAR(64) DEFAULT NULL");
    } catch { /* column already exists */ }
    // Set default rating to 5.0 for all agents without rating
    await conn.execute("UPDATE agents SET rating = 5.0 WHERE rating = 0 OR rating IS NULL");

    // Update developer agent prompt — output SINGLE self-contained HTML file for simple projects
    const devPrompt = `You are a senior frontend developer. Based on the technical design, create a WORKING project.

CRITICAL RULE: Output a SINGLE index.html file with ALL code inline (CSS in <style>, JS in <script>). This guarantees it works when opened in a browser.

OUTPUT FORMAT:
--- FILE: index.html ---
(complete HTML with inline CSS and JS)
--- END FILE ---

--- FILE: README.md ---
(brief instructions)
--- END FILE ---

RULES:
1. Put EVERYTHING in ONE index.html file: HTML structure, <style> block, <script> block
2. DO NOT use external files (no style.css, no app.js, no CDN links)
3. The page MUST display visible content IMMEDIATELY on load
4. Use modern CSS (flexbox, grid, variables, animations)
5. All JavaScript must be complete and working — trace through every function mentally
6. NO placeholders, NO TODOs, NO "..." shortcuts — every line must be real code
7. For countdowns: calculate the target date correctly, update every second
8. For dashboards: use hardcoded sample data that looks realistic
9. Include error handling so the page never shows blank/black
10. Test your code mentally: Does the DOM have visible elements? Are colors set? Is text readable?

If the project needs backend, output separate files:
--- FILE: server.js ---
--- FILE: package.json ---
But frontend MUST always be a single self-contained index.html.`;
    await conn.execute(
      "UPDATE agents SET config = ? WHERE id = 'agent-developer'",
      [JSON.stringify({ systemPrompt: devPrompt })]
    );

    // Update tester agent — verify the code works, fix if broken, output corrected version
    const testPrompt = `You are a QA engineer reviewing code for correctness.

YOUR JOB:
1. Read the index.html file completely
2. Trace through ALL JavaScript code mentally — check for: undefined variables, wrong selectors, missing DOM elements, logic errors
3. Verify CSS produces visible output (not black/white screen)
4. If you find ANY bugs: FIX THEM and output the corrected file
5. If the code is correct: output it unchanged

OUTPUT FORMAT (always output the complete corrected project):
--- FILE: index.html ---
(the complete corrected HTML file with inline CSS and JS)
--- END FILE ---

--- FILE: test_report.md ---
# Test Report
## Bugs Found: (list each bug and how you fixed it)
## Verification: (confirm the page displays correctly)
--- END FILE ---

COMMON BUGS TO CHECK:
- Canvas elements with no drawing code (causes black screen)
- Missing document.addEventListener('DOMContentLoaded', ...) 
- Referencing DOM elements before they exist
- CSS with no background-color on body (causes white/black screen)
- setTimeout/setInterval with wrong logic
- Missing or wrong date calculations for countdowns`;
    await conn.execute(
      "UPDATE agents SET config = ? WHERE id = 'agent-tester'",
      [JSON.stringify({ systemPrompt: testPrompt })]
    );

    // Workflow templates
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS workflow_templates (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64),
        name VARCHAR(128) NOT NULL,
        description TEXT,
        is_prebuilt BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Workflow template steps
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS workflow_steps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        workflow_id VARCHAR(64) NOT NULL,
        step_order INT NOT NULL,
        name VARCHAR(128) NOT NULL,
        agent_id VARCHAR(64) NOT NULL,
        description TEXT,
        output_description TEXT,
        UNIQUE KEY unique_workflow_step (workflow_id, step_order)
      )
    `);

    // Tasks (workflow instances)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(64) PRIMARY KEY,
        workflow_id VARCHAR(64) NOT NULL,
        organization_id VARCHAR(64) NOT NULL,
        created_by VARCHAR(64) NOT NULL,
        initial_input TEXT NOT NULL,
        status VARCHAR(32) DEFAULT 'running',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL
      )
    `);

    // Task steps (execution records)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS task_steps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id VARCHAR(64) NOT NULL,
        step_order INT NOT NULL,
        name VARCHAR(128) NOT NULL,
        agent_id VARCHAR(64) NOT NULL,
        description TEXT,
        status VARCHAR(32) DEFAULT 'pending',
        input LONGTEXT,
        output LONGTEXT,
        error TEXT,
        started_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        UNIQUE KEY unique_task_step (task_id, step_order)
      )
    `);
    try { await conn.execute("ALTER TABLE task_steps ADD COLUMN description TEXT"); } catch { /* exists */ }
    try { await conn.execute("ALTER TABLE task_steps ADD COLUMN progress VARCHAR(256) DEFAULT NULL"); } catch { /* exists */ }

    // Task step guardrails (VETA sub-checks per step)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS task_guardrails (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id VARCHAR(64) NOT NULL,
        step_order INT NOT NULL,
        check_name VARCHAR(64) NOT NULL,
        check_label VARCHAR(128) NOT NULL,
        status VARCHAR(32) DEFAULT 'pending',
        result_reason TEXT DEFAULT NULL,
        started_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        INDEX idx_task_step (task_id, step_order)
      )
    `);
    try { await conn.execute("ALTER TABLE task_guardrails ADD COLUMN result_reason TEXT DEFAULT NULL"); } catch { /* exists */ }

    // Seed agents if not exist
    await seedAgents(conn);
    // Seed workflow templates if not exist
    await seedWorkflowTemplates(conn);
    // Seed demo organization
    await seedDemoOrg(conn);

    console.log("✅ Tables initialized");
  } finally {
    conn.release();
  }
}

// Seed platform-preset agents
async function seedAgents(conn) {
  const agents = [
    {
      id: "agent-script-writer",
      name: "Script Writer",
      description: "Generates video scripts, narration, and dialogue based on product/topic requirements",
      type: "script-writer",
      input_format: "text",
      output_format: "text",
      provider: "deepseek",
      config: JSON.stringify({ systemPrompt: "You are a professional script writer. Based on the user's requirements, write a complete video script including narration, scene descriptions, and key talking points. Output clean, production-ready text." }),
    },
    {
      id: "agent-storyboard",
      name: "Storyboard Creator",
      description: "Converts scripts into detailed scene-by-scene storyboard with visual descriptions",
      type: "storyboard",
      input_format: "text",
      output_format: "text",
      provider: "deepseek",
      config: JSON.stringify({ systemPrompt: "You are a storyboard specialist. Based on the script provided, create a detailed storyboard. For each scene, describe: scene number, duration, visual composition, camera angle, narration, and production notes. Output as clear structured text." }),
    },
    {
      id: "agent-video-gen",
      name: "Video Generator",
      description: "Generates video from text descriptions using AI video generation",
      type: "video-gen",
      input_format: "text",
      output_format: "video-url",
      provider: "zhipu",
      config: JSON.stringify({ model: "cogvideox-3" }),
    },
    {
      id: "agent-pm",
      name: "Product Manager",
      description: "Analyzes requirements, writes PRDs, and performs acceptance review",
      type: "pm-analysis",
      input_format: "text",
      output_format: "text",
      provider: "deepseek",
      config: JSON.stringify({ systemPrompt: "You are an experienced product manager. Based on the input, produce a clear, structured document. If analyzing a requirement, output a PRD with user stories, acceptance criteria, and priorities. If reviewing deliverables, output an acceptance report with pass/fail criteria." }),
    },
    {
      id: "agent-architect",
      name: "System Architect",
      description: "Designs system architecture, data models, and technical solutions",
      type: "architecture",
      input_format: "text",
      output_format: "text",
      provider: "deepseek",
      config: JSON.stringify({ systemPrompt: "You are a senior system architect. Based on the PRD or requirements provided, design a complete technical solution including: system architecture, component breakdown, data models, API design, and technology choices. Be specific and actionable." }),
    },
    {
      id: "agent-developer",
      name: "Developer",
      description: "Implements code based on technical designs and specifications",
      type: "development",
      input_format: "text",
      output_format: "text",
      provider: "deepseek",
      config: JSON.stringify({ systemPrompt: "You are a senior software developer. Based on the technical design provided, write a complete, production-ready project that can be run immediately.\n\nCRITICAL OUTPUT FORMAT: You MUST output each file using this exact format:\n\n--- FILE: path/to/file.ext ---\n(file content here)\n--- END FILE ---\n\nRules:\n1. Include ALL files needed to run the project (HTML, CSS, JS, package.json if needed)\n2. For simple frontend projects, use vanilla HTML/CSS/JS so it can be opened directly in a browser\n3. If a build tool is needed, include package.json with scripts\n4. Always include a README.md with run instructions\n5. Include an index.html as the entry point\n6. Make sure the code is complete and working - no placeholders or TODOs\n7. Output ONLY files in the format above, no other text before or after" }),
    },
    {
      id: "agent-tester",
      name: "QA Tester",
      description: "Creates test plans, writes test cases, and produces test reports",
      type: "testing",
      input_format: "text",
      output_format: "text",
      provider: "deepseek",
      config: JSON.stringify({ systemPrompt: "You are a QA engineer. Based on the code/implementation provided, create a comprehensive test report including: test cases (unit, integration, edge cases), test results (simulated), issues found, and overall quality assessment." }),
    },
  ];

  for (const agent of agents) {
    await conn.execute(
      `INSERT IGNORE INTO agents (id, name, description, type, input_format, output_format, provider, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [agent.id, agent.name, agent.description, agent.type, agent.input_format, agent.output_format, agent.provider, agent.config]
    );
  }
}

// Seed pre-built workflow templates
async function seedWorkflowTemplates(conn) {
  // Video Production template
  const [existing1] = await conn.execute("SELECT id FROM workflow_templates WHERE id = ?", ["wf-video-production"]);
  if (existing1.length === 0) {
    await conn.execute(
      `INSERT INTO workflow_templates (id, organization_id, name, description, is_prebuilt) VALUES (?, NULL, ?, ?, TRUE)`,
      ["wf-video-production", "Video Production", "End-to-end video creation: script writing → storyboard → video generation"]
    );
    const videoSteps = [
      { order: 1, name: "Script Writing", agentId: "agent-script-writer", desc: "Generate video script from requirements", output: "Complete video script" },
      { order: 2, name: "Storyboard", agentId: "agent-storyboard", desc: "Create detailed scene storyboard", output: "Scene-by-scene storyboard" },
      { order: 3, name: "Video Generation", agentId: "agent-video-gen", desc: "Generate video from storyboard", output: "Generated video URL" },
    ];
    for (const step of videoSteps) {
      await conn.execute(
        `INSERT INTO workflow_steps (workflow_id, step_order, name, agent_id, description, output_description) VALUES (?, ?, ?, ?, ?, ?)`,
        ["wf-video-production", step.order, step.name, step.agentId, step.desc, step.output]
      );
    }
  }

  // Product Development template
  const [existing2] = await conn.execute("SELECT id FROM workflow_templates WHERE id = ?", ["wf-product-dev"]);
  if (existing2.length === 0) {
    await conn.execute(
      `INSERT INTO workflow_templates (id, organization_id, name, description, is_prebuilt) VALUES (?, NULL, ?, ?, TRUE)`,
      ["wf-product-dev", "Product Development", "Full product lifecycle: requirements → design → development → testing → acceptance"]
    );
    const devSteps = [
      { order: 1, name: "Requirements Analysis", agentId: "agent-pm", desc: "Analyze requirements and produce PRD", output: "Product Requirements Document" },
      { order: 2, name: "System Design", agentId: "agent-architect", desc: "Design system architecture", output: "Technical Design Document" },
      { order: 3, name: "Development", agentId: "agent-developer", desc: "Implement the solution", output: "Code implementation" },
      { order: 4, name: "Testing", agentId: "agent-tester", desc: "Test the implementation", output: "Test report" },
      { order: 5, name: "Acceptance", agentId: "agent-pm", desc: "Review and accept deliverables", output: "Acceptance report" },
    ];
    for (const step of devSteps) {
      await conn.execute(
        `INSERT INTO workflow_steps (workflow_id, step_order, name, agent_id, description, output_description) VALUES (?, ?, ?, ?, ?, ?)`,
        ["wf-product-dev", step.order, step.name, step.agentId, step.desc, step.output]
      );
    }
  }
}

// Seed a demo organization that anyone can join without approval
async function seedDemoOrg(conn) {
  const [existing] = await conn.execute("SELECT id FROM organizations WHERE id = ?", ["org-demo"]);
  if (existing.length === 0) {
    await conn.execute(
      "INSERT INTO organizations (id, name, created_by) VALUES (?, ?, ?)",
      ["org-demo", "Vishwa Demo Team", "system"]
    );
  }
}

// Ensure all requests use the workflow database
app.use(async (req, res, next) => {
  try {
    await pool.execute("USE workflow");
  } catch (e) {
    // If the database doesn't exist, initTables will create it
  }
  next();
});

// ============ Session Middleware ============
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((c) => {
    const [key, val] = c.trim().split("=");
    if (key && val) cookies[key] = decodeURIComponent(val);
  });
  return cookies;
}

app.use(async (req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies["session_id"];
  if (sessionId && sessions.has(sessionId)) {
    req.user = sessions.get(sessionId);
  } else if (sessionId) {
    // Cache miss — recover session from DB (handles server restart)
    try {
      const [rows] = await pool.execute("SELECT id, email, name, avatar FROM users WHERE session_id = ?", [sessionId]);
      if (rows.length > 0) {
        const user = { id: rows[0].id, email: rows[0].email, name: rows[0].name, avatar: rows[0].avatar };
        sessions.set(sessionId, user);
        req.user = user;
      } else {
        req.user = null;
      }
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
});

// ============ Google OAuth API ============
app.get("/api/auth/google", (req, res) => {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });
  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

app.get("/api/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Missing code");

  try {
    // Exchange code for token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(400).send("Token exchange failed: " + JSON.stringify(tokenData));
    }

    // Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();

    // Store in database
    const userId = `user_${crypto.randomUUID().slice(0, 8)}`;
    await pool.execute(
      `INSERT INTO users (id, email, name, avatar, google_id) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), avatar = VALUES(avatar), google_id = VALUES(google_id)`,
      [userId, googleUser.email, googleUser.name || "", googleUser.picture || "", googleUser.id || ""]
    );

    // Query actual user record
    const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [googleUser.email]);
    const dbUser = rows[0];

    // Create session
    const sessionId = crypto.randomUUID();
    await saveSession(sessionId, {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      avatar: dbUser.avatar,
    });

    // Set cookie and redirect back to frontend
    res.setHeader("Set-Cookie", `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
    res.redirect(PUBLIC_APP_URL);
  } catch (e) {
    console.error("OAuth error:", e);
    res.status(500).send("OAuth failed: " + e.message);
  }
});

app.get("/api/auth/me", (req, res) => {
  if (req.user) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: "Not logged in" });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies["session_id"];
  if (sessionId) await deleteSession(sessionId);
  res.setHeader("Set-Cookie", "session_id=; Path=/; HttpOnly; Max-Age=0");
  res.json({ success: true });
});

// ============ Departments API (removed - replaced by Organizations) ============

// ============ Organization API ============
// List orgs the current user belongs to
app.get("/api/organizations", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    // User belongs to org only if they're in org_members (approved)
    const [rows] = await pool.execute(
      `SELECT DISTINCT o.* FROM organizations o 
       INNER JOIN org_members m ON o.id = m.organization_id AND m.user_id = ?
       WHERE m.status = 'approved' OR m.status IS NULL`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List ALL orgs (for onboarding / join flow)
app.get("/api/organizations/all", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT id, name, created_by, created_at FROM organizations ORDER BY created_at DESC");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create org (requires at least one department)
app.post("/api/organizations", async (req, res) => {
  try {
    const { name, departments, creatorRole } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    if (!departments || !Array.isArray(departments) || departments.length === 0) {
      return res.status(400).json({ error: "At least one department is required" });
    }
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const id = `org-${crypto.randomUUID().slice(0, 8)}`;
    await pool.execute("INSERT INTO organizations (id, name, created_by) VALUES (?, ?, ?)", [id, name.trim(), req.user.id]);
    
    // Create departments and assign creator to the first one
    let firstDeptId = null;
    for (let i = 0; i < departments.length; i++) {
      const deptName = departments[i]?.name || departments[i];
      if (!deptName) continue;
      const deptId = `dept-${crypto.randomUUID().slice(0, 8)}`;
      if (i === 0) firstDeptId = deptId;
      await pool.execute(
        "INSERT INTO departments (id, organization_id, name, leader_user_id) VALUES (?, ?, ?, ?)",
        [deptId, id, typeof deptName === "string" ? deptName.trim() : deptName, i === 0 ? req.user.id : null]
      );
    }
    
    // Add creator as admin in the first department
    await pool.execute(
      "INSERT INTO org_members (organization_id, user_id, email, role, status, department_id) VALUES (?, ?, ?, ?, 'approved', ?)",
      [id, req.user.id, req.user.email, creatorRole?.trim() || "admin", firstDeptId]
    );
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get departments for an org by invite code (public - used during invite code join)
app.get("/api/organizations/departments-by-code", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code?.trim()) return res.status(400).json({ error: "Code is required" });
    const [codes] = await pool.execute("SELECT organization_id FROM invite_codes WHERE code = ? AND used = FALSE", [code.trim()]);
    if (codes.length === 0) return res.status(400).json({ error: "Invalid or used invite code" });
    const [depts] = await pool.execute("SELECT id, name FROM departments WHERE organization_id = ? ORDER BY name", [codes[0].organization_id]);
    res.json(depts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get org detail
app.get("/api/organizations/:id", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM organizations WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get current user's role/permission level in an org
app.get("/api/organizations/:id/my-role", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const orgId = req.params.id;
    // Check if user is org creator (admin)
    const [org] = await pool.execute("SELECT created_by FROM organizations WHERE id = ?", [orgId]);
    if (org.length === 0) return res.status(404).json({ error: "Organization not found" });
    const isCreator = org[0].created_by === req.user.id;
    // Check if user is a department leader
    const [leaderDepts] = await pool.execute("SELECT id FROM departments WHERE organization_id = ? AND leader_user_id = ?", [orgId, req.user.id]);
    const isDeptLeader = leaderDepts.length > 0;
    // Get member role
    const [mem] = await pool.execute("SELECT role FROM org_members WHERE organization_id = ? AND user_id = ? AND (status = 'approved' OR status IS NULL)", [orgId, req.user.id]);
    const memberRole = mem.length > 0 ? mem[0].role : "member";
    // isSuperior = org creator or department leader (department manager and above)
    const isSuperior = isCreator || isDeptLeader;
    res.json({ isCreator, isDeptLeader, isSuperior, role: memberRole });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Apply to join org (pending approval from admin or dept leader)
app.post("/api/organizations/:id/apply", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { departmentId, role } = req.body || {};
    if (!departmentId) return res.status(400).json({ error: "Please select a department to join" });
    if (!role?.trim()) return res.status(400).json({ error: "Please enter your role/position" });
    
    // Check if the applicant is the org creator — auto-approve
    const [org] = await pool.execute("SELECT created_by FROM organizations WHERE id = ?", [req.params.id]);
    const isCreator = org.length > 0 && org[0].created_by === req.user.id;
    const status = isCreator ? "approved" : "pending";
    
    // Remove any existing record then insert
    await pool.execute("DELETE FROM org_members WHERE organization_id = ? AND user_id = ?", [req.params.id, req.user.id]);
    await pool.execute(
      "INSERT INTO org_members (organization_id, user_id, email, role, status, applied_department_id, department_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.params.id, req.user.id, req.user.email, role.trim(), status, departmentId, isCreator ? departmentId : null]
    );
    res.json({ success: true, status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get pending applications (admin sees all, dept leader sees their dept)
app.get("/api/organizations/:id/applications", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const [org] = await pool.execute("SELECT created_by FROM organizations WHERE id = ?", [req.params.id]);
    const isAdmin = org.length > 0 && org[0].created_by === req.user.id;
    
    if (isAdmin) {
      // Admin sees all pending applications
      const [rows] = await pool.execute("SELECT * FROM org_members WHERE organization_id = ? AND status = 'pending'", [req.params.id]);
      res.json(rows);
    } else {
      // Dept leader sees applications for their department
      const [leaderDepts] = await pool.execute("SELECT id FROM departments WHERE organization_id = ? AND leader_user_id = ?", [req.params.id, req.user.id]);
      if (leaderDepts.length === 0) return res.json([]);
      const deptIds = leaderDepts.map((d) => d.id);
      const placeholders = deptIds.map(() => "?").join(",");
      const [rows] = await pool.execute(
        `SELECT * FROM org_members WHERE organization_id = ? AND status = 'pending' AND applied_department_id IN (${placeholders})`,
        [req.params.id, ...deptIds]
      );
      res.json(rows);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Approve application (admin or dept leader of target department)
app.post("/api/organizations/:id/applications/:userId/approve", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const [org] = await pool.execute("SELECT created_by FROM organizations WHERE id = ?", [req.params.id]);
    const isAdmin = org.length > 0 && org[0].created_by === req.user.id;
    
    if (!isAdmin) {
      // Check if user is dept leader for the applied department
      const [application] = await pool.execute("SELECT applied_department_id FROM org_members WHERE organization_id = ? AND user_id = ? AND status = 'pending'", [req.params.id, req.params.userId]);
      if (application.length === 0) return res.status(404).json({ error: "Application not found" });
      const appliedDeptId = application[0].applied_department_id;
      if (appliedDeptId) {
        const [dept] = await pool.execute("SELECT leader_user_id FROM departments WHERE id = ?", [appliedDeptId]);
        if (dept.length === 0 || dept[0].leader_user_id !== req.user.id) {
          return res.status(403).json({ error: "Not authorized to approve this application" });
        }
      } else {
        return res.status(403).json({ error: "Only admin can approve applications without department" });
      }
    }

    // Get the applied department and set it
    const [application] = await pool.execute("SELECT applied_department_id FROM org_members WHERE organization_id = ? AND user_id = ? AND status = 'pending'", [req.params.id, req.params.userId]);
    const deptId = application.length > 0 ? application[0].applied_department_id : null;
    await pool.execute("UPDATE org_members SET status = 'approved', department_id = ? WHERE organization_id = ? AND user_id = ?", [deptId, req.params.id, req.params.userId]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reject application
app.post("/api/organizations/:id/applications/:userId/reject", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const [org] = await pool.execute("SELECT created_by FROM organizations WHERE id = ?", [req.params.id]);
    const isAdmin = org.length > 0 && org[0].created_by === req.user.id;
    
    if (!isAdmin) {
      const [application] = await pool.execute("SELECT applied_department_id FROM org_members WHERE organization_id = ? AND user_id = ? AND status = 'pending'", [req.params.id, req.params.userId]);
      if (application.length === 0) return res.status(404).json({ error: "Application not found" });
      const appliedDeptId = application[0].applied_department_id;
      if (appliedDeptId) {
        const [dept] = await pool.execute("SELECT leader_user_id FROM departments WHERE id = ?", [appliedDeptId]);
        if (dept.length === 0 || dept[0].leader_user_id !== req.user.id) {
          return res.status(403).json({ error: "Not authorized to reject this application" });
        }
      } else {
        return res.status(403).json({ error: "Only admin can reject applications without department" });
      }
    }
    await pool.execute("DELETE FROM org_members WHERE organization_id = ? AND user_id = ?", [req.params.id, req.params.userId]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List approved members
app.get("/api/organizations/:id/members", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT om.*, u.name, u.avatar FROM org_members om LEFT JOIN users u ON om.user_id = u.id WHERE om.organization_id = ? AND (om.status = 'approved' OR om.status IS NULL) ORDER BY om.joined_at",
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add member directly (by org creator)
app.post("/api/organizations/:id/members", async (req, res) => {
  try {
    const { email, departmentId } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: "email is required" });
    const [users] = await pool.execute("SELECT id FROM users WHERE email = ?", [email.trim()]);
    const userId = users.length > 0 ? users[0].id : `user_pending_${crypto.randomUUID().slice(0, 8)}`;
    if (users.length === 0) {
      await pool.execute("INSERT INTO users (id, email) VALUES (?, ?)", [userId, email.trim()]);
    }
    await pool.execute(
      "INSERT IGNORE INTO org_members (organization_id, user_id, email, role, status, department_id) VALUES (?, ?, ?, 'member', 'approved', ?)",
      [req.params.id, userId, email.trim(), departmentId || null]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove member
app.delete("/api/organizations/:id/members/:memberId", async (req, res) => {
  try {
    await pool.execute("DELETE FROM org_members WHERE organization_id = ? AND user_id = ?", [req.params.id, req.params.memberId]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Leave organization (current user leaves)
app.post("/api/organizations/:id/leave", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    // Prevent org creator from leaving (they must delete the org or transfer ownership)
    const [org] = await pool.execute("SELECT created_by FROM organizations WHERE id = ?", [req.params.id]);
    if (org.length > 0 && org[0].created_by === req.user.id) {
      return res.status(400).json({ error: "Organization creator cannot leave. Please transfer ownership or delete the organization." });
    }
    await pool.execute("DELETE FROM org_members WHERE organization_id = ? AND user_id = ?", [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete organization (only creator can delete)
app.delete("/api/organizations/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const [org] = await pool.execute("SELECT created_by FROM organizations WHERE id = ?", [req.params.id]);
    if (org.length === 0) return res.status(404).json({ error: "Organization not found" });
    if (org[0].created_by !== req.user.id) return res.status(403).json({ error: "Only the organization creator can delete it" });
    // Delete all related data
    await pool.execute("DELETE FROM org_members WHERE organization_id = ?", [req.params.id]);
    await pool.execute("DELETE FROM departments WHERE organization_id = ?", [req.params.id]);
    await pool.execute("DELETE FROM invite_codes WHERE organization_id = ?", [req.params.id]);
    await pool.execute("DELETE FROM organizations WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Department API ============
// List departments (tree structure)
app.get("/api/organizations/:id/departments", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM departments WHERE organization_id = ? ORDER BY created_at",
      [req.params.id]
    );
    // Build tree
    const map = new Map();
    const roots = [];
    for (const dept of rows) {
      map.set(dept.id, { ...dept, children: [] });
    }
    for (const dept of rows) {
      const node = map.get(dept.id);
      if (dept.parent_id && map.has(dept.parent_id)) {
        map.get(dept.parent_id).children.push(node);
      } else {
        roots.push(node);
      }
    }
    res.json(roots);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create department
app.post("/api/organizations/:id/departments", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { name, parentId } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    // Verify parent exists if specified
    if (parentId) {
      const [parent] = await pool.execute("SELECT id FROM departments WHERE id = ? AND organization_id = ?", [parentId, req.params.id]);
      if (parent.length === 0) return res.status(400).json({ error: "Parent department not found" });
    }
    const id = `dept-${crypto.randomUUID().slice(0, 8)}`;
    await pool.execute(
      "INSERT INTO departments (id, organization_id, name, parent_id) VALUES (?, ?, ?, ?)",
      [id, req.params.id, name.trim(), parentId || null]
    );
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update department (name, leader)
app.put("/api/organizations/:id/departments/:deptId", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { name, leaderUserId } = req.body;
    if (name !== undefined) {
      await pool.execute("UPDATE departments SET name = ? WHERE id = ? AND organization_id = ?", [name.trim(), req.params.deptId, req.params.id]);
    }
    if (leaderUserId !== undefined) {
      await pool.execute("UPDATE departments SET leader_user_id = ? WHERE id = ? AND organization_id = ?", [leaderUserId || null, req.params.deptId, req.params.id]);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete department (reassign members to parent or root)
app.delete("/api/organizations/:id/departments/:deptId", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    // Get the department to find its parent
    const [dept] = await pool.execute("SELECT parent_id FROM departments WHERE id = ? AND organization_id = ?", [req.params.deptId, req.params.id]);
    if (dept.length === 0) return res.status(404).json({ error: "Department not found" });
    const parentId = dept[0].parent_id || null;
    // Reassign members of this department to parent
    await pool.execute("UPDATE org_members SET department_id = ? WHERE organization_id = ? AND department_id = ?", [parentId, req.params.id, req.params.deptId]);
    // Reassign child departments to parent
    await pool.execute("UPDATE departments SET parent_id = ? WHERE organization_id = ? AND parent_id = ?", [parentId, req.params.id, req.params.deptId]);
    // Delete the department
    await pool.execute("DELETE FROM departments WHERE id = ? AND organization_id = ?", [req.params.deptId, req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get members of a department
app.get("/api/organizations/:id/departments/:deptId/members", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT om.*, u.name, u.avatar FROM org_members om LEFT JOIN users u ON om.user_id = u.id WHERE om.organization_id = ? AND om.department_id = ? AND (om.status = 'approved' OR om.status IS NULL)",
      [req.params.id, req.params.deptId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Move member to a different department
app.post("/api/organizations/:id/members/:userId/move", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { departmentId } = req.body;
    // Verify the department exists (or null for root)
    if (departmentId) {
      const [dept] = await pool.execute("SELECT id FROM departments WHERE id = ? AND organization_id = ?", [departmentId, req.params.id]);
      if (dept.length === 0) return res.status(400).json({ error: "Department not found" });
    }
    await pool.execute(
      "UPDATE org_members SET department_id = ? WHERE organization_id = ? AND user_id = ?",
      [departmentId || null, req.params.id, req.params.userId]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all users (for Room member selection)
app.get("/api/users", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT id, email, name FROM users ORDER BY created_at DESC");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Agent API ============
app.get("/api/agents", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM agents ORDER BY name");
    let result = rows.map((row) => ({
      ...row,
      config: typeof row.config === "string" ? JSON.parse(row.config) : row.config,
      rating: parseFloat(row.rating) || 5.0,
    }));
    
    // If user is logged in and filter requested, apply permission filtering
    if (req.user && req.query.userId) {
      const userId = req.query.userId;
      const orgId = req.query.organizationId;
      // Get user's department
      let userDeptId = null;
      if (orgId) {
        const [mem] = await pool.execute("SELECT department_id FROM org_members WHERE organization_id = ? AND user_id = ?", [orgId, userId]);
        if (mem.length > 0) userDeptId = mem[0].department_id;
      }

      // Check if user is org creator (has access to everything)
      let isOrgCreator = false;
      if (orgId) {
        const [org] = await pool.execute("SELECT created_by FROM organizations WHERE id = ?", [orgId]);
        isOrgCreator = org.length > 0 && org[0].created_by === userId;
      }

      // Check if user is a department leader (superior — has access to everything)
      let isDeptLeader = false;
      if (orgId) {
        const [leaderDepts] = await pool.execute("SELECT id FROM departments WHERE organization_id = ? AND leader_user_id = ?", [orgId, userId]);
        isDeptLeader = leaderDepts.length > 0;
      }

      // Org creator and dept leaders see all agents (hierarchical permission)
      if (!isOrgCreator && !isDeptLeader) {
        // Regular members — filter by permissions
        const filtered = [];
        for (const agent of result) {
          // Agent creator always sees their own agent
          if (agent.created_by === userId) { filtered.push(agent); continue; }
          const [perms] = await pool.execute("SELECT * FROM agent_permissions WHERE agent_id = ?", [agent.id]);
          if (perms.length === 0) { filtered.push(agent); continue; }
          if (perms.some((p) => p.target_type === "all")) { filtered.push(agent); continue; }
          if (perms.some((p) => p.target_type === "member" && p.target_id === userId)) { filtered.push(agent); continue; }
          if (userDeptId && perms.some((p) => p.target_type === "department" && p.target_id === userDeptId)) { filtered.push(agent); continue; }
        }
        result = filtered;
      }
    }
    // Attach user's own rating if logged in
    if (req.user) {
      const [userRatings] = await pool.execute("SELECT agent_id, score FROM agent_ratings WHERE user_id = ?", [req.user.id]);
      const ratingMap = Object.fromEntries(userRatings.map((r) => [r.agent_id, parseFloat(r.score)]));
      result = result.map((a) => ({ ...a, user_rating: ratingMap[a.id] || null }));
    }
    // Attach canEdit flag: org creator or department leader (hierarchical — creator + superiors)
    if (req.user && req.query.organizationId) {
      const orgId = req.query.organizationId;
      const [org] = await pool.execute("SELECT created_by FROM organizations WHERE id = ?", [orgId]);
      const isOrgCreator = org.length > 0 && (org[0].created_by === req.user.id || org[0].created_by === req.user.email);
      // Get departments where user is leader (check by user_id or email)
      const [leaderDepts] = await pool.execute(
        "SELECT id FROM departments WHERE organization_id = ? AND (leader_user_id = ? OR leader_user_id = ?)",
        [orgId, req.user.id, req.user.email]
      );
      const isDeptLeader = leaderDepts.length > 0;
      // Creator and all department leaders (superiors) can edit/delete and assign permissions
      const canEdit = isOrgCreator || isDeptLeader;
      result = result.map((a) => ({ ...a, canEdit }));
    } else {
      result = result.map((a) => ({ ...a, canEdit: false }));
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/agents/:id", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM agents WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Agent not found" });
    const agent = rows[0];
    agent.config = typeof agent.config === "string" ? JSON.parse(agent.config) : agent.config;
    res.json(agent);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/agents", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { name, description, type, inputFormat, outputFormat, provider, systemPrompt, visibility, organizationId } = req.body;
    if (!name?.trim() || !type?.trim()) return res.status(400).json({ error: "name and type are required" });
    const id = `agent-${Date.now()}`;
    const config = JSON.stringify({ systemPrompt: systemPrompt || "" });
    await pool.execute(
      "INSERT INTO agents (id, name, description, type, input_format, output_format, provider, config, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, name.trim(), description || "", type.trim(), inputFormat || "text", outputFormat || "text", provider || "deepseek", config, req.user.id]
    );
    // Set visibility permissions (default: department)
    // Also always add the creator as a member permission
    const orgId = organizationId || "";
    if (visibility === "all") {
      await pool.execute("INSERT INTO agent_permissions (agent_id, organization_id, target_type) VALUES (?, ?, 'all')", [id, orgId]);
    } else {
      // Default to department — find user's department
      let userDeptId = null;
      if (orgId) {
        const [mem] = await pool.execute("SELECT department_id FROM org_members WHERE organization_id = ? AND user_id = ?", [orgId, req.user.id]);
        if (mem.length > 0) userDeptId = mem[0].department_id;
      }
      if (userDeptId) {
        await pool.execute("INSERT INTO agent_permissions (agent_id, organization_id, target_type, target_id) VALUES (?, ?, 'department', ?)", [id, orgId, userDeptId]);
      } else {
        // No department found, default to all
        await pool.execute("INSERT INTO agent_permissions (agent_id, organization_id, target_type) VALUES (?, ?, 'all')", [id, orgId]);
      }
    }
    // Always add creator as explicit member permission
    await pool.execute("INSERT INTO agent_permissions (agent_id, organization_id, target_type, target_id) VALUES (?, ?, 'member', ?)", [id, orgId, req.user.id]);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update agent
app.put("/api/agents/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { name, description, type, outputFormat, provider, systemPrompt, visibility, organizationId } = req.body;
    // Permission check: only org creator or department leader can edit
    if (organizationId) {
      const [org] = await pool.execute("SELECT created_by FROM organizations WHERE id = ?", [organizationId]);
      const isOrgCreator = org.length > 0 && org[0].created_by === req.user.id;
      if (!isOrgCreator) {
        const [leaderDepts] = await pool.execute("SELECT id FROM departments WHERE organization_id = ? AND leader_user_id = ?", [organizationId, req.user.id]);
        if (leaderDepts.length === 0) return res.status(403).json({ error: "Only department leaders or org admin can edit agents" });
      }
    }
    const updates = [];
    const params = [];
    if (name !== undefined && name !== null) { updates.push("name = ?"); params.push(String(name).trim()); }
    if (description !== undefined && description !== null) { updates.push("description = ?"); params.push(String(description).trim()); }
    if (type !== undefined && type !== null) { updates.push("type = ?"); params.push(String(type).trim()); }
    if (outputFormat !== undefined && outputFormat !== null) { updates.push("output_format = ?"); params.push(String(outputFormat)); }
    if (provider !== undefined && provider !== null) { updates.push("provider = ?"); params.push(String(provider)); }
    if (systemPrompt !== undefined && systemPrompt !== null && String(systemPrompt).trim()) { updates.push("config = ?"); params.push(JSON.stringify({ systemPrompt: String(systemPrompt).trim() })); }
    if (updates.length > 0) {
      params.push(req.params.id);
      await pool.execute(`UPDATE agents SET ${updates.join(", ")} WHERE id = ?`, params);
    }
    // Update visibility/permissions if provided
    if (visibility) {
      const orgId = organizationId || "";
      await pool.execute("DELETE FROM agent_permissions WHERE agent_id = ?", [req.params.id]);
      if (visibility === "all") {
        await pool.execute("INSERT INTO agent_permissions (agent_id, organization_id, target_type) VALUES (?, ?, 'all')", [req.params.id, orgId]);
      } else {
        // department — find user's department
        let userDeptId = null;
        if (orgId) {
          const [mem] = await pool.execute("SELECT department_id FROM org_members WHERE organization_id = ? AND user_id = ?", [orgId, req.user.id]);
          if (mem.length > 0) userDeptId = mem[0].department_id;
        }
        if (userDeptId) {
          await pool.execute("INSERT INTO agent_permissions (agent_id, organization_id, target_type, target_id) VALUES (?, ?, 'department', ?)", [req.params.id, orgId, userDeptId]);
        } else {
          await pool.execute("INSERT INTO agent_permissions (agent_id, organization_id, target_type) VALUES (?, ?, 'all')", [req.params.id, orgId]);
        }
      }
    }
    res.json({ success: true });
  } catch (e) {
    console.error("[AGENT UPDATE ERROR]", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/agents/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    // Permission check: only org creator or department leader can delete
    const [perms] = await pool.execute("SELECT organization_id FROM agent_permissions WHERE agent_id = ? LIMIT 1", [req.params.id]);
    if (perms.length > 0 && perms[0].organization_id) {
      const orgId = perms[0].organization_id;
      const [org] = await pool.execute("SELECT created_by FROM organizations WHERE id = ?", [orgId]);
      const isOrgCreator = org.length > 0 && org[0].created_by === req.user.id;
      if (!isOrgCreator) {
        const [leaderDepts] = await pool.execute("SELECT id FROM departments WHERE organization_id = ? AND leader_user_id = ?", [orgId, req.user.id]);
        if (leaderDepts.length === 0) return res.status(403).json({ error: "Only department leaders or org admin can delete agents" });
      }
    }
    // Cascade: delete workflows that use this agent
    const [affectedSteps] = await pool.execute("SELECT DISTINCT workflow_id FROM workflow_steps WHERE agent_id = ?", [req.params.id]);
    for (const row of affectedSteps) {
      await pool.execute("DELETE FROM workflow_steps WHERE workflow_id = ?", [row.workflow_id]);
      await pool.execute("DELETE FROM workflow_templates WHERE id = ?", [row.workflow_id]);
      await pool.execute("DELETE FROM workflow_permissions WHERE workflow_id = ?", [row.workflow_id]);
    }
    await pool.execute("DELETE FROM agents WHERE id = ?", [req.params.id]);
    await pool.execute("DELETE FROM agent_permissions WHERE agent_id = ?", [req.params.id]);
    res.json({ success: true, deletedWorkflows: affectedSteps.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Agent permissions
app.get("/api/agents/:id/permissions", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM agent_permissions WHERE agent_id = ?", [req.params.id]);
    // If no permissions set, default is 'all'
    if (rows.length === 0) return res.json([{ target_type: "all", target_id: null }]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/agents/:id/permissions", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { permissions, organizationId } = req.body;
    // Get agent creator to ensure they're always included
    const [agentRows] = await pool.execute("SELECT created_by FROM agents WHERE id = ?", [req.params.id]);
    const creatorId = agentRows.length > 0 ? agentRows[0].created_by : null;
    
    // permissions: Array<{ targetType: 'all' | 'department' | 'member', targetId?: string }>
    await pool.execute("DELETE FROM agent_permissions WHERE agent_id = ?", [req.params.id]);
    if (!permissions || permissions.length === 0 || permissions.some((p) => p.targetType === "all")) {
      await pool.execute("INSERT INTO agent_permissions (agent_id, organization_id, target_type) VALUES (?, ?, 'all')", [req.params.id, organizationId || ""]);
    } else {
      const insertedMembers = new Set();
      for (const p of permissions) {
        if (p.targetType === "member" && p.targetId) insertedMembers.add(p.targetId);
        await pool.execute(
          "INSERT INTO agent_permissions (agent_id, organization_id, target_type, target_id) VALUES (?, ?, ?, ?)",
          [req.params.id, organizationId || "", p.targetType, p.targetId || null]
        );
      }
      // Always ensure creator has member permission
      if (creatorId && !insertedMembers.has(creatorId)) {
        await pool.execute(
          "INSERT INTO agent_permissions (agent_id, organization_id, target_type, target_id) VALUES (?, ?, 'member', ?)",
          [req.params.id, organizationId || "", creatorId]
        );
      }
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Agent share endpoint removed — permissions are now hierarchical (creator + superiors auto-have access)
// Permissions are managed by org creator and department leaders only

// ============ Agent Rating API ============
app.post("/api/agents/:id/rate", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { score } = req.body;
    const s = parseFloat(score);
    if (isNaN(s) || s < 1 || s > 5) return res.status(400).json({ error: "Score must be between 1 and 5" });
    // Check if user already rated — each person can only rate once
    const [existing] = await pool.execute("SELECT id FROM agent_ratings WHERE agent_id = ? AND user_id = ?", [req.params.id, req.user.id]);
    if (existing.length > 0) return res.status(409).json({ error: "You have already rated this agent" });
    // Insert rating
    await pool.execute(
      "INSERT INTO agent_ratings (agent_id, user_id, score) VALUES (?, ?, ?)",
      [req.params.id, req.user.id, s]
    );
    // Recalculate average
    const [avg] = await pool.execute("SELECT AVG(score) as avg_score FROM agent_ratings WHERE agent_id = ?", [req.params.id]);
    const newRating = avg[0]?.avg_score ? Math.round(parseFloat(avg[0].avg_score) * 10) / 10 : 5.0;
    await pool.execute("UPDATE agents SET rating = ? WHERE id = ?", [newRating, req.params.id]);
    res.json({ success: true, rating: newRating });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Agent Chat API (persistent context in DB) ============
app.post("/api/agents/:id/chat", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { message, history } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "message required" });

    const [agents] = await pool.execute("SELECT * FROM agents WHERE id = ?", [req.params.id]);
    if (agents.length === 0) return res.status(404).json({ error: "Agent not found" });
    const agent = agents[0];
    const config = typeof agent.config === "string" ? JSON.parse(agent.config) : agent.config;

    // Load agent knowledge base (relevance-matched, filtered by organization)
    let knowledgeContext = "";
    let knowledgeImages = [];
    try {
      // Get user's organization
      let orgId = req.body.organizationId || null;
      if (!orgId && req.user) {
        const [orgs] = await pool.execute(
          "SELECT organization_id FROM org_members WHERE user_id = ? AND status = 'approved' LIMIT 1",
          [req.user.id]
        );
        if (orgs.length > 0) orgId = orgs[0].organization_id;
      }
      
      let kbRows;
      try {
        if (orgId) {
          [kbRows] = await pool.execute(
            "SELECT name, summary, content FROM agent_knowledge WHERE agent_id = ? AND (organization_id = ? OR organization_id IS NULL OR organization_id = '')",
            [req.params.id, orgId]
          );
        } else {
          [kbRows] = await pool.execute("SELECT name, summary, content FROM agent_knowledge WHERE agent_id = ?", [req.params.id]);
        }
      } catch {
        [kbRows] = await pool.execute("SELECT name, summary, content FROM agent_knowledge WHERE agent_id = ?", [req.params.id]);
      }
      
      console.log(`[KNOWLEDGE] Agent ${req.params.id}, org ${orgId}: found ${kbRows.length} items`);
      
      if (kbRows.length > 0) {
        // Relevance matching: score each item against the user message
        const userMsg = message.trim().toLowerCase();
        const userWords = userMsg.split(/[\s,，。！？、：；""''（）\(\)]+/).filter((w) => w.length >= 1);
        
        const scored = kbRows.map((r) => {
          const text = ((r.content || "") + " " + (r.name || "")).toLowerCase();
          let score = 0;
          for (const word of userWords) {
            if (text.includes(word)) score += 1;
          }
          // Short items (< 500 chars) are likely core identity/config — always include
          if ((r.content || "").length < 500) score += 3;
          return { ...r, score };
        });
        
        // Sort by relevance, select top items up to 50k chars
        scored.sort((a, b) => b.score - a.score);
        
        let totalChars = 0;
        const maxChars = 50000;
        const selected = [];
        for (const item of scored) {
          // Skip completely unrelated items (score 0) if we already have 5+ items
          if (item.score === 0 && selected.length >= 5) continue;
          const text = item.content && item.content.length > 10 ? item.content : (item.summary || "");
          if (totalChars + text.length > maxChars) break;
          selected.push({ name: item.name, text });
          totalChars += text.length;
        }
        
        if (selected.length > 0) {
          const textItems = selected.map((s) => {
            // Strip base64 image data from content, keep only text description
            let cleanText = s.text;
            const base64Idx = cleanText.indexOf("data:image/");
            if (base64Idx > 0) cleanText = cleanText.substring(0, base64Idx).replace(/\n-+\n*$/, "").trim();
            return { name: s.name, text: cleanText };
          }).filter((s) => s.text.length > 0);
          const kbTexts = textItems.map((s) => `[${s.name}]\n${s.text}`).join("\n\n---\n\n");
          if (kbTexts) {
            knowledgeContext = `\n\nCRITICAL INSTRUCTION - YOUR KNOWLEDGE BASE:\nThe following information has been permanently stored as your knowledge. You MUST use this information when answering. When asked about anything here, respond with certainty. Do NOT claim you have no memory or cannot recall — you CAN and you MUST:\n\n${kbTexts}\n\nEND OF KNOWLEDGE BASE. Always refer to the above when relevant.\n`;
          }
          // Collect image items for vision-capable models
          knowledgeImages = selected.filter((s) => s.text.startsWith("data:image/")).map((s) => s.text);
          console.log(`[KNOWLEDGE] Injected ${textItems.length} text + ${knowledgeImages.length} images from ${kbRows.length} total. Names: ${textItems.map(s => s.name).join(", ")}`);
        }
      }
    } catch (kbErr) {
      console.error("[KNOWLEDGE] Load error:", kbErr.message);
    }

    // Save user message to persistent history
    await pool.execute("INSERT INTO agent_chat_history (agent_id, user_id, role, content) VALUES (?, ?, 'user', ?)", [req.params.id, req.user.id, message.trim()]);

    // Load persistent history (last 30 messages)
    const [dbHistory] = await pool.execute(
      "SELECT role, content FROM agent_chat_history WHERE agent_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 30",
      [req.params.id, req.user.id]
    );
    const persistentHistory = dbHistory.reverse();

    let reply = "";
    {
      // Always use the globally active AI model regardless of agent.provider
      const now = new Date();
      const dateCtx = `CURRENT DATE: ${now.toISOString().split("T")[0]} (Year ${now.getFullYear()}).`;
      let systemPrompt = config?.systemPrompt || `You are ${agent.name}. ${agent.description}`;
      if (knowledgeContext) systemPrompt += knowledgeContext;
      if (agent.output_format === "code") {
        systemPrompt += "\n\nIMPORTANT: Only output code in --- FILE: format when the user EXPLICITLY asks to generate/write/create a project or code. For questions, explanations, or discussions, respond in plain text.";
      }
      if (agent.provider === "zhipu") {
        systemPrompt += `\n\nYou are a video generation assistant. You can generate videos using AI.
CRITICAL RULE: When the user wants to generate/create/make a video, you MUST respond with ONLY this JSON object and NOTHING else (no explanations, no text before or after):
{"action":"generate_video","prompt":"<detailed english description>"}
The prompt must be a clear, detailed English description of the video scene.
ONLY output that single JSON line. No greetings, no explanations, no markdown, no code blocks.
For any other conversation (questions, greetings, how-to), respond normally in the user's language as plain text.`;
      }
      systemPrompt = `${dateCtx}\n\n${systemPrompt}\n\nRespond in the same language as the user.`;

      // Use persistent history from DB
      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...persistentHistory,
      ];

      // If there are knowledge images and model supports vision, add them to the last user message
      if (knowledgeImages.length > 0) {
        // Convert last user message to multimodal format with images
        const lastMsg = apiMessages[apiMessages.length - 1];
        if (lastMsg && lastMsg.role === "user") {
          const content = [
            { type: "text", text: lastMsg.content },
            ...knowledgeImages.slice(0, 3).map((img) => ({ type: "image_url", image_url: { url: img } })),
          ];
          apiMessages[apiMessages.length - 1] = { role: "user", content };
        }
      }

      // Determine which AI model to use — from user's personal model settings
      let aiUrl = "";
      let aiKey = "";
      let aiModel = "";

      try {
        await ensureUserModels(req.user.id);
        const [activeModel] = await pool.execute("SELECT * FROM ai_model_settings WHERE user_id = ? AND enabled = TRUE LIMIT 1", [req.user.id]);
        if (activeModel.length === 0) {
          return res.status(500).json({ error: "No AI model enabled. Please enable one in AI Model Settings" });
        }
        if (!activeModel[0].api_key) {
          return res.status(500).json({ error: "Active model has no API Key. Please configure it in AI Model Settings" });
        }
        aiUrl = activeModel[0].api_url;
        aiKey = activeModel[0].api_key;
        aiModel = activeModel[0].model_name;
      } catch (dbErr) {
        return res.status(500).json({ error: "Failed to read AI model config: " + dbErr.message });
      }

      console.log(`[CHAT] Using model: ${aiModel} at ${aiUrl}`);
      const aiRes = await fetch(aiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
        body: JSON.stringify({ model: aiModel, messages: apiMessages, max_tokens: 16384 }),
      });
      const aiData = await aiRes.json();
      if (!aiRes.ok) {
        console.error(`[CHAT] AI API error ${aiRes.status}:`, JSON.stringify(aiData).slice(0, 500));
        reply = `AI call failed (${aiRes.status}): ${aiData.error?.message || aiData.message || JSON.stringify(aiData).slice(0, 200)}`;
      } else {
        reply = aiData.choices?.[0]?.message?.content || "No response";
        if (reply === "No response") {
          console.error("[CHAT] Empty response from AI:", JSON.stringify(aiData).slice(0, 500));
        }
      }

      // If zhipu agent decided to generate video, return task ID for async polling
      if (agent.provider === "zhipu") {
        const jsonMatch = reply.match(/\{[\s\S]*"action"\s*:\s*"generate_video"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.action === "generate_video" && parsed.prompt) {
              const genResponse = await fetch(`${ZHIPU_BASE}/videos/generations`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${ZHIPU_API_KEY}`,
                },
                body: JSON.stringify({ model: "cogvideox-3", prompt: parsed.prompt.slice(0, 500), quality: "speed", with_audio: true, size: "1920x1080", fps: 30, duration: 5 }),
              });
              if (!genResponse.ok) {
                reply = `Video generation submission failed: ${genResponse.status}`;
              } else {
                const genData = await genResponse.json();
                const taskId = genData.id || genData.task_id || "";
                if (taskId) {
                  reply = JSON.stringify({ type: "video_pending", taskId, prompt: parsed.prompt });
                } else {
                  reply = "Video generation submission failed: no task ID returned";
                }
              }
            }
          } catch { /* JSON parse failed, keep reply as-is */ }
        }
      }
    }

    // Save assistant reply to persistent history
    await pool.execute("INSERT INTO agent_chat_history (agent_id, user_id, role, content) VALUES (?, ?, 'assistant', ?)", [req.params.id, req.user.id, reply]);

    res.json({ reply });
  } catch (e) {
    console.error("[CHAT ERROR]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Get chat history for an agent
app.get("/api/agents/:id/chat/history", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const [rows] = await pool.execute(
      "SELECT role, content, created_at FROM agent_chat_history WHERE agent_id = ? AND user_id = ? ORDER BY created_at ASC",
      [req.params.id, req.user.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Clear chat history for an agent
app.delete("/api/agents/:id/chat/history", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    await pool.execute("DELETE FROM agent_chat_history WHERE agent_id = ? AND user_id = ?", [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Download code output as zip (from client-provided content)
app.post("/api/agents/:id/chat/download", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.includes("--- FILE:")) {
      return res.status(400).json({ error: "No file content" });
    }
    const [agents] = await pool.execute("SELECT name FROM agents WHERE id = ?", [req.params.id]);
    const agentName = agents.length > 0 ? agents[0].name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "_") : "output";

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(agentName)}_output.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => console.error("Zip error:", err));
    archive.pipe(res);

    const fileRegex = /--- FILE:\s*(.+?)\s*---[\r\n]+([\s\S]*?)(?=[\r\n]+--- END FILE ---|[\r\n]+--- FILE:|$)/g;
    let match;
    while ((match = fileRegex.exec(content)) !== null) {
      archive.append(Buffer.from(match[2], "utf-8"), { name: match[1].trim() });
    }
    await archive.finalize();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Workflow Template API ============
app.get("/api/workflows", async (req, res) => {
  try {
    const [templates] = await pool.execute("SELECT * FROM workflow_templates ORDER BY is_prebuilt DESC, created_at DESC");
    // Attach step count
    let result = [];
    for (const t of templates) {
      const [steps] = await pool.execute("SELECT COUNT(*) as cnt FROM workflow_steps WHERE workflow_id = ?", [t.id]);
      result.push({ ...t, stepCount: steps[0].cnt });
    }
    
    // If userId provided, filter by permissions
    if (req.query.userId) {
      const userId = req.query.userId;
      const orgId = req.query.organizationId;
      let userDeptId = null;
      if (orgId) {
        const [mem] = await pool.execute("SELECT department_id FROM org_members WHERE organization_id = ? AND user_id = ?", [orgId, userId]);
        if (mem.length > 0) userDeptId = mem[0].department_id;
      }
      const filtered = [];
      for (const wf of result) {
        const [perms] = await pool.execute("SELECT * FROM workflow_permissions WHERE workflow_id = ?", [wf.id]);
        if (perms.length === 0) { filtered.push(wf); continue; }
        if (perms.some((p) => p.target_type === "all")) { filtered.push(wf); continue; }
        if (perms.some((p) => p.target_type === "member" && p.target_id === userId)) { filtered.push(wf); continue; }
        if (userDeptId && perms.some((p) => p.target_type === "department" && p.target_id === userDeptId)) { filtered.push(wf); continue; }
      }
      result = filtered;
    }
    // Attach canEdit flag: org creator or department leader
    if (req.user && req.query.organizationId) {
      const orgId = req.query.organizationId;
      const [org] = await pool.execute("SELECT created_by FROM organizations WHERE id = ?", [orgId]);
      const isOrgCreator = org.length > 0 && (org[0].created_by === req.user.id || org[0].created_by === req.user.email);
      const [leaderDepts] = await pool.execute(
        "SELECT id FROM departments WHERE organization_id = ? AND (leader_user_id = ? OR leader_user_id = ?)",
        [orgId, req.user.id, req.user.email]
      );
      const canEdit = isOrgCreator || leaderDepts.length > 0;
      result = result.map((wf) => ({ ...wf, canEdit }));
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/workflows/:id", async (req, res) => {
  try {
    const [templates] = await pool.execute("SELECT * FROM workflow_templates WHERE id = ?", [req.params.id]);
    if (templates.length === 0) return res.status(404).json({ error: "Not found" });
    const [steps] = await pool.execute("SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order", [req.params.id]);
    res.json({ ...templates[0], steps });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/workflows", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { name, description, organizationId, visibility, steps } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    if (!steps || !Array.isArray(steps) || steps.length < 2) {
      return res.status(400).json({ error: "At least 2 steps are required" });
    }
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (!s.name?.trim() || !s.agentId?.trim()) {
        return res.status(400).json({ error: `Step ${i + 1}: name and agentId are required` });
      }
    }
    const id = `wf-${crypto.randomUUID().slice(0, 8)}`;
    await pool.execute(
      "INSERT INTO workflow_templates (id, organization_id, name, description, is_prebuilt) VALUES (?, ?, ?, ?, FALSE)",
      [id, organizationId || null, name.trim(), description || ""]
    );
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await pool.execute(
        "INSERT INTO workflow_steps (workflow_id, step_order, name, agent_id, description, output_description) VALUES (?, ?, ?, ?, ?, ?)",
        [id, i + 1, s.name.trim(), s.agentId.trim(), s.description || "", s.outputDescription || ""]
      );
    }
    // Set visibility permissions
    const orgId = organizationId || "";
    if (visibility === "all") {
      await pool.execute("INSERT INTO workflow_permissions (workflow_id, organization_id, target_type) VALUES (?, ?, 'all')", [id, orgId]);
    } else {
      let userDeptId = null;
      if (orgId) {
        const [mem] = await pool.execute("SELECT department_id FROM org_members WHERE organization_id = ? AND user_id = ?", [orgId, req.user.id]);
        if (mem.length > 0) userDeptId = mem[0].department_id;
      }
      if (userDeptId) {
        await pool.execute("INSERT INTO workflow_permissions (workflow_id, organization_id, target_type, target_id) VALUES (?, ?, 'department', ?)", [id, orgId, userDeptId]);
      } else {
        await pool.execute("INSERT INTO workflow_permissions (workflow_id, organization_id, target_type) VALUES (?, ?, 'all')", [id, orgId]);
      }
    }
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/workflows/:id", async (req, res) => {
  try {
    const { name, description, steps } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    if (!steps || !Array.isArray(steps) || steps.length < 2) {
      return res.status(400).json({ error: "At least 2 steps are required" });
    }
    await pool.execute("UPDATE workflow_templates SET name = ?, description = ? WHERE id = ?", [name.trim(), description || "", req.params.id]);
    await pool.execute("DELETE FROM workflow_steps WHERE workflow_id = ?", [req.params.id]);
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await pool.execute(
        "INSERT INTO workflow_steps (workflow_id, step_order, name, agent_id, description, output_description) VALUES (?, ?, ?, ?, ?, ?)",
        [req.params.id, i + 1, s.name?.trim() || "", s.agentId?.trim() || "", s.description || "", s.outputDescription || ""]
      );
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/workflows/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    // Permission check: only org creator or department leader can delete
    const [perms] = await pool.execute("SELECT organization_id FROM workflow_permissions WHERE workflow_id = ? LIMIT 1", [req.params.id]);
    const [wf] = await pool.execute("SELECT organization_id FROM workflow_templates WHERE id = ?", [req.params.id]);
    const orgId = perms.length > 0 ? perms[0].organization_id : (wf.length > 0 ? wf[0].organization_id : "");
    if (orgId) {
      const [org] = await pool.execute("SELECT created_by FROM organizations WHERE id = ?", [orgId]);
      const isOrgCreator = org.length > 0 && (org[0].created_by === req.user.id || org[0].created_by === req.user.email);
      if (!isOrgCreator) {
        const [leaderDepts] = await pool.execute(
          "SELECT id FROM departments WHERE organization_id = ? AND (leader_user_id = ? OR leader_user_id = ?)",
          [orgId, req.user.id, req.user.email]
        );
        if (leaderDepts.length === 0) return res.status(403).json({ error: "Only department leaders or org admin can delete workflows" });
      }
    }
    await pool.execute("DELETE FROM workflow_steps WHERE workflow_id = ?", [req.params.id]);
    await pool.execute("DELETE FROM workflow_templates WHERE id = ?", [req.params.id]);
    await pool.execute("DELETE FROM workflow_permissions WHERE workflow_id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Workflow permissions
app.get("/api/workflows/:id/permissions", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM workflow_permissions WHERE workflow_id = ?", [req.params.id]);
    if (rows.length === 0) return res.json([{ target_type: "all", target_id: null }]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/workflows/:id/permissions", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { permissions, organizationId } = req.body;
    await pool.execute("DELETE FROM workflow_permissions WHERE workflow_id = ?", [req.params.id]);
    if (!permissions || permissions.length === 0 || permissions.some((p) => p.targetType === "all")) {
      await pool.execute("INSERT INTO workflow_permissions (workflow_id, organization_id, target_type) VALUES (?, ?, 'all')", [req.params.id, organizationId || ""]);
    } else {
      for (const p of permissions) {
        await pool.execute(
          "INSERT INTO workflow_permissions (workflow_id, organization_id, target_type, target_id) VALUES (?, ?, ?, ?)",
          [req.params.id, organizationId || "", p.targetType, p.targetId || null]
        );
      }
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Task Execution API ============
app.get("/api/tasks", async (req, res) => {
  try {
    const orgId = req.query.organizationId;
    let rows;
    if (orgId) {
      [rows] = await pool.execute("SELECT t.*, wt.name as workflow_name FROM tasks t LEFT JOIN workflow_templates wt ON t.workflow_id = wt.id WHERE t.organization_id = ? ORDER BY t.created_at DESC", [orgId]);
    } else {
      [rows] = await pool.execute("SELECT t.*, wt.name as workflow_name FROM tasks t LEFT JOIN workflow_templates wt ON t.workflow_id = wt.id ORDER BY t.created_at DESC");
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/tasks/:id", async (req, res) => {
  try {
    const [tasks] = await pool.execute("SELECT t.*, wt.name as workflow_name FROM tasks t LEFT JOIN workflow_templates wt ON t.workflow_id = wt.id WHERE t.id = ?", [req.params.id]);
    if (tasks.length === 0) return res.status(404).json({ error: "Not found" });
    const [steps] = await pool.execute("SELECT ts.*, a.output_format as agent_output_format FROM task_steps ts LEFT JOIN agents a ON ts.agent_id = a.id WHERE ts.task_id = ? ORDER BY ts.step_order", [req.params.id]);
    const [guardrails] = await pool.execute("SELECT * FROM task_guardrails WHERE task_id = ? ORDER BY step_order, id", [req.params.id]);
    // Group guardrails by step_order
    const guardrailsByStep = {};
    for (const g of guardrails) {
      if (!guardrailsByStep[g.step_order]) guardrailsByStep[g.step_order] = [];
      guardrailsByStep[g.step_order].push(g);
    }
    const stepsWithGuardrails = steps.map((s) => ({ ...s, guardrails: guardrailsByStep[s.step_order] || [] }));
    res.json({ ...tasks[0], steps: stepsWithGuardrails });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Download task deliverable (all steps packaged as zip)
app.get("/api/tasks/:id/download", async (req, res) => {
  try {
    const [tasks] = await pool.execute("SELECT t.*, wt.name as workflow_name FROM tasks t LEFT JOIN workflow_templates wt ON t.workflow_id = wt.id WHERE t.id = ?", [req.params.id]);
    if (tasks.length === 0) return res.status(404).json({ error: "Not found" });
    const [steps] = await pool.execute("SELECT step_order, name, status, output FROM task_steps WHERE task_id = ? ORDER BY step_order", [req.params.id]);
    
    console.log(`[DOWNLOAD] Task ${req.params.id}: ${steps.length} steps`);
    for (const s of steps) {
      console.log(`  Step ${s.step_order} "${s.name}": status=${s.status}, output=${s.output ? s.output.length + " chars" : "NULL"}`);
    }
    
    if (steps.length === 0) return res.status(404).json({ error: "No steps found" });
    
    const taskName = (tasks[0].workflow_name || "project").replace(/[^a-zA-Z0-9\u4e00-\u9fff-]/g, "_");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(taskName)}.zip"`);
    
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => { console.error("Archive error:", err); });
    archive.pipe(res);
    
    // Add README at root first
    const readme = `# ${tasks[0].workflow_name || "Project"} - Deliverable\n\nGenerated: ${new Date().toISOString()}\nTask ID: ${req.params.id}\n\n## Structure\n\n- /source_code/ — Final runnable project (open index.html in browser)\n- /documents/ — Requirements, design docs, test reports\n- README.md — This file\n\n## How to run\n\nOpen source_code/index.html in your browser.\n`;
    archive.append(Buffer.from(readme, "utf-8"), { name: "README.md" });
    
    // Find the latest code output (tester fixes override developer)
    let latestCodeOutput = null;
    for (const step of steps) {
      if (step.output && step.output.includes("--- FILE:")) {
        latestCodeOutput = step.output;
      }
    }
    
    // Add final code to /source_code/ folder
    if (latestCodeOutput) {
      const outputStr = typeof latestCodeOutput === "string" ? latestCodeOutput : String(latestCodeOutput);
      const fileRegex = /--- FILE:\s*(.+?)\s*---[\r\n]+([\s\S]*?)(?=[\r\n]+--- END FILE ---|[\r\n]+--- FILE:|$)/g;
      let match;
      while ((match = fileRegex.exec(outputStr)) !== null) {
        archive.append(Buffer.from(match[2], "utf-8"), { name: `source_code/${match[1].trim()}` });
      }
    }
    
    // Add text outputs (requirements, design, etc.) to /documents/
    for (const step of steps) {
      const output = step.output;
      if (!output || (typeof output === "string" && output.trim().length === 0)) continue;
      const outputStr = typeof output === "string" ? output : String(output);
      
      // Skip code steps — already handled above
      if (outputStr.includes("--- FILE:")) continue;
      
      const docName = `${String(step.step_order).padStart(2, "0")}_${step.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "_")}.md`;
      archive.append(Buffer.from(`# ${step.name}\n\n${outputStr}`, "utf-8"), { name: `documents/${docName}` });
    }
    
    await archive.finalize();
  } catch (e) {
    console.error("Download error:", e);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

app.post("/api/tasks", async (req, res) => {
  try {
    const { workflowId, organizationId, initialInput } = req.body;
    if (!workflowId || !initialInput?.trim()) {
      return res.status(400).json({ error: "workflowId and initialInput are required" });
    }
    if (!req.user) return res.status(401).json({ error: "Not logged in" });

    // Get workflow steps
    const [wfSteps] = await pool.execute("SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order", [workflowId]);
    if (wfSteps.length === 0) return res.status(400).json({ error: "Workflow has no steps" });

    const taskId = `task-${crypto.randomUUID().slice(0, 8)}`;
    await pool.execute(
      "INSERT INTO tasks (id, workflow_id, organization_id, created_by, initial_input, status) VALUES (?, ?, ?, ?, ?, 'running')",
      [taskId, workflowId, organizationId || "", req.user.id, initialInput.trim()]
    );

    // Create task steps and generate guardrails per agent via AI
    // First, look up agent details for guardrail generation
    const agentIds = [...new Set(wfSteps.map((s) => s.agent_id))];
    const agentMap = {};
    for (const aid of agentIds) {
      const [rows] = await pool.execute("SELECT id, name, description, type FROM agents WHERE id = ?", [aid]);
      if (rows.length > 0) agentMap[aid] = rows[0];
    }

    // Generate guardrails for each step using AI
    let guardrailsPerStep = {};
    try {
      await ensureUserModels(req.user.id);
      const [userModel] = await pool.execute("SELECT * FROM ai_model_settings WHERE user_id = ? AND enabled = TRUE LIMIT 1", [req.user.id]);
      if (userModel.length > 0 && userModel[0].api_key) {
        const stepsDesc = wfSteps.map((s) => {
          const agent = agentMap[s.agent_id];
          return `Step ${s.step_order}: "${s.name}" — Agent: ${agent ? agent.name : s.agent_id} (${agent ? agent.type : "unknown"}) — ${agent ? agent.description : s.description || ""}`;
        }).join("\n");

        const grRes = await fetch(userModel[0].api_url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${userModel[0].api_key}` },
          body: JSON.stringify({
            model: userModel[0].model_name,
            messages: [
              { role: "system", content: `You are a trust & safety guardrail designer for an AI agent workflow platform called "Continental". For each workflow step, generate 3 to 5 guardrail checks that the VETA (Verification, Evaluation, Trust, Accountability) system should validate before the agent runs.

IMPORTANT: Each step MUST have exactly 3 to 5 checks. Never more than 5. Keep labels SHORT (2-4 words max).

Each guardrail check has a short snake_case name and a short human-readable label (2-4 words).

Common check types (pick the ones relevant to each agent):
- identity_verification, credential_check, role_authorization
- content_policy, output_policy, compliance_review
- data_scope_boundary, data_classification, pii_filter
- tool_access_control, api_permission, sandbox_isolation
- budget_limit, cost_estimation, rate_limit
- human_approval, audit_trail, escalation_check

Different agents need DIFFERENT checks.

Output ONLY valid JSON: { "1": [{"name":"xxx","label":"Xxx Yyy"}, ...], "2": [...], ... }
Keys are step_order numbers as strings. Each array has 3-5 items. Labels must be 2-4 words. No extra text.` },
              { role: "user", content: stepsDesc },
            ],
            max_tokens: 2048,
            temperature: 0.3,
          }),
        });
        if (grRes.ok) {
          const grData = await grRes.json();
          const raw = grData.choices?.[0]?.message?.content || "";
          // Extract JSON from response
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            guardrailsPerStep = JSON.parse(jsonMatch[0]);
          }
        }
      }
    } catch (e) {
      console.error("[GUARDRAIL AI] Failed to generate guardrails:", e.message);
    }

    // Fallback: if AI didn't generate, use simple defaults
    const defaultChecks = [
      { name: "identity", label: "Identity" },
      { name: "policy", label: "Policy" },
      { name: "data_scope", label: "Data Scope" },
      { name: "tool_permission", label: "Tool Permission" },
    ];

    for (const step of wfSteps) {
      const input = step.step_order === 1 ? initialInput.trim() : null;
      const status = step.step_order === 1 ? "running" : "pending";
      await pool.execute(
        "INSERT INTO task_steps (task_id, step_order, name, agent_id, description, status, input, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [taskId, step.step_order, step.name, step.agent_id, step.description || null, status, input, status === "running" ? new Date() : null]
      );
      // Get AI-generated or fallback guardrail checks
      const aiChecks = guardrailsPerStep[String(step.step_order)];
      const checks = (Array.isArray(aiChecks) && aiChecks.length >= 3) ? aiChecks.slice(0, 5) : defaultChecks;
      for (const gc of checks) {
        if (!gc.name || !gc.label) continue;
        const gcStatus = step.step_order === 1 ? "pending" : "locked";
        await pool.execute(
          "INSERT INTO task_guardrails (task_id, step_order, check_name, check_label, status) VALUES (?, ?, ?, ?, ?)",
          [taskId, step.step_order, gc.name, gc.label, gcStatus]
        );
      }
    }

    // Start execution asynchronously
    executeTask(taskId, req.user.id).catch((err) => console.error(`Task ${taskId} execution error:`, err));

    res.json({ success: true, id: taskId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    await pool.execute("DELETE FROM task_guardrails WHERE task_id = ?", [req.params.id]);
    await pool.execute("DELETE FROM task_steps WHERE task_id = ?", [req.params.id]);
    await pool.execute("DELETE FROM tasks WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Execution Engine ============
// (Rating is handled by user votes, not auto-calculated)

async function executeTask(taskId, userId) {
  const [taskRows] = await pool.execute("SELECT * FROM tasks WHERE id = ?", [taskId]);
  if (taskRows.length === 0) return;
  const taskUserId = userId || taskRows[0].created_by;

  const [steps] = await pool.execute("SELECT * FROM task_steps WHERE task_id = ? ORDER BY step_order", [taskId]);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Get current input
    let input;
    if (i === 0) {
      input = taskRows[0].initial_input;
    } else {
      // Get previous step's output
      const [prevStep] = await pool.execute("SELECT output FROM task_steps WHERE task_id = ? AND step_order = ?", [taskId, step.step_order - 1]);
      input = prevStep[0]?.output || "";
    }

    // Mark step as running with dynamic progress message
    const progressMsg = step.description ? `${step.description}...` : `${step.name} in progress...`;
    await pool.execute("UPDATE task_steps SET status = 'running', input = ?, progress = ?, started_at = UTC_TIMESTAMP() WHERE task_id = ? AND step_order = ?", [input, progressMsg, taskId, step.step_order]);

    // Unlock VETA guardrail checks — set to pending first (visual indicator)
    await pool.execute("UPDATE task_guardrails SET status = 'pending' WHERE task_id = ? AND step_order = ? AND status = 'locked'", [taskId, step.step_order]);

    try {
      // Execute agent FIRST (generate content)
      let output = await executeAgent(step.agent_id, input, taskUserId);

      // FIX LOOP: If this is a tester/QA step and output contains code, run test→fix cycles
      const isTesterStep = step.agent_id === "agent-tester" || step.name.toLowerCase().match(/test|qa|review|验收/);
      if (isTesterStep && output && output.includes("--- FILE:")) {
        const MAX_FIX_ROUNDS = 3;
        let currentCode = output;
        
        // Find the developer agent in this workflow (previous step or by type)
        let devAgentId = "agent-developer";
        for (let j = i - 1; j >= 0; j--) {
          const prevStep = steps[j];
          if (prevStep.agent_id === "agent-developer" || prevStep.name.toLowerCase().match(/develop|code|implement/)) {
            devAgentId = prevStep.agent_id;
            break;
          }
        }
        
        for (let round = 0; round < MAX_FIX_ROUNDS; round++) {
          const hasBugs = /bug|fix|error|issue|problem|black\s*screen|不能|无法|修复|错误|incorrect|wrong/i.test(currentCode);
          if (!hasBugs) {
            await pool.execute("UPDATE task_steps SET progress = ? WHERE task_id = ? AND step_order = ?", [`No bugs found, done`, taskId, step.step_order]);
            break;
          }
          
          console.log(`[FIX] Task ${taskId}: Round ${round + 1}/${MAX_FIX_ROUNDS}`);
          await pool.execute("UPDATE task_steps SET progress = ? WHERE task_id = ? AND step_order = ?", [`Fix loop: round ${round + 1}/${MAX_FIX_ROUNDS} — fixing bugs...`, taskId, step.step_order]);
          
          // Send to developer to fix
          const fixPrompt = `Round ${round + 1} fix: The QA team found bugs. Here is the current code with issues:\n\n${currentCode.slice(0, 7000)}\n\nFix ALL mentioned bugs. Output the COMPLETE corrected project using --- FILE: format. The page must display correctly with no errors.`;
          try {
            const fixedOutput = await executeAgent(devAgentId, fixPrompt, taskUserId);
            if (fixedOutput && fixedOutput.includes("--- FILE:")) {
              await pool.execute("UPDATE task_steps SET progress = ? WHERE task_id = ? AND step_order = ?", [`Fix loop: round ${round + 1}/${MAX_FIX_ROUNDS} — re-testing...`, taskId, step.step_order]);
              // Run tester again on the fixed code
              const retestOutput = await executeAgent(step.agent_id, fixedOutput, taskUserId);
              if (retestOutput && retestOutput.includes("--- FILE:")) {
                currentCode = retestOutput;
              } else {
                currentCode = fixedOutput;
                break;
              }
            } else {
              break;
            }
          } catch { break; }
        }
        output = currentCode;
      }

      // Mark step as completed
      await pool.execute("UPDATE task_steps SET status = 'completed', progress = 'Done', output = ?, completed_at = NOW() WHERE task_id = ? AND step_order = ?", [output, taskId, step.step_order]);

      // Run VETA guardrail checks AFTER generation completes — real AI verification
      const [stepGuardrails] = await pool.execute("SELECT check_name, check_label FROM task_guardrails WHERE task_id = ? AND step_order = ? ORDER BY id", [taskId, step.step_order]);
      
      // Get the user's active AI model for verification
      let verifyModel = null;
      try {
        await ensureUserModels(taskUserId);
        const [models] = await pool.execute("SELECT * FROM ai_model_settings WHERE user_id = ? AND enabled = TRUE LIMIT 1", [taskUserId]);
        if (models.length > 0 && models[0].api_key) verifyModel = models[0];
      } catch { /* ignore */ }

      for (const gc of stepGuardrails) {
        await pool.execute("UPDATE task_guardrails SET status = 'evaluating', started_at = UTC_TIMESTAMP() WHERE task_id = ? AND step_order = ? AND check_name = ?", [taskId, step.step_order, gc.check_name]);
        
        let checkResult = "passed";
        let reason = "";

        if (verifyModel) {
          try {
            const verifyRes = await fetch(verifyModel.api_url, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${verifyModel.api_key}` },
              body: JSON.stringify({
                model: verifyModel.model_name,
                messages: [
                  { role: "system", content: `You are a VETA (Verification, Evaluation, Trust, Accountability) guardrail checker for an AI workflow platform. You must evaluate whether an AI agent's output passes a specific safety/quality check.

Evaluate the check: "${gc.check_label}" (${gc.check_name})

Rules:
- Be practical and reasonable. Most well-formed outputs should PASS.
- Only FAIL if there is a clear, specific violation.
- Respond in the SAME language as the content being checked.
- Keep your reason SHORT (one sentence, max 30 words).

You MUST respond with EXACTLY this JSON format, nothing else:
{"result": "passed", "reason": "brief reason"}
or
{"result": "failed", "reason": "brief reason why it failed"}` },
                  { role: "user", content: `Agent output to verify (first 3000 chars):\n\n${(output || "").slice(0, 3000)}` }
                ],
                max_tokens: 200,
                temperature: 0.3,
              }),
            });
            if (verifyRes.ok) {
              const verifyData = await verifyRes.json();
              const raw = verifyData.choices?.[0]?.message?.content || "";
              try {
                const jsonMatch = raw.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  checkResult = parsed.result === "failed" ? "failed" : "passed";
                  reason = parsed.reason || "";
                }
              } catch { reason = raw.slice(0, 200); }
            }
          } catch (e) {
            console.log(`[VETA] Check ${gc.check_name} AI call failed: ${e.message}`);
            reason = "Verification service unavailable, auto-passed";
          }
        } else {
          reason = "No AI model available, auto-passed";
        }

        // Controlled pace: 1.5-2.5s per check so UI can follow
        await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
        
        await pool.execute(
          "UPDATE task_guardrails SET status = ?, result_reason = ?, completed_at = UTC_TIMESTAMP() WHERE task_id = ? AND step_order = ? AND check_name = ?",
          [checkResult, reason, taskId, step.step_order, gc.check_name]
        );

        // If a guardrail check fails, log but don't block (VETA is advisory)
        if (checkResult === "failed") {
          console.log(`[VETA] Check FAILED: ${gc.check_name} for task ${taskId} step ${step.step_order}: ${reason}`);
        }
      }
    } catch (err) {
      // Mark step as failed
      await pool.execute("UPDATE task_steps SET status = 'failed', progress = 'Failed', error = ?, completed_at = NOW() WHERE task_id = ? AND step_order = ?", [err.message || "Unknown error", taskId, step.step_order]);
      // Mark task as failed
      await pool.execute("UPDATE tasks SET status = 'failed' WHERE id = ?", [taskId]);
      return;
    }
  }

  // All steps completed
  await pool.execute("UPDATE tasks SET status = 'completed', completed_at = NOW() WHERE id = ?", [taskId]);
}

async function executeAgent(agentId, input, userId) {
  const [agents] = await pool.execute("SELECT * FROM agents WHERE id = ?", [agentId]);
  if (agents.length === 0) throw new Error(`Agent ${agentId} not found`);

  const agent = agents[0];
  const config = typeof agent.config === "string" ? JSON.parse(agent.config) : (agent.config || {});

  // Load agent knowledge base
  let knowledgeContext = "";
  try {
    const [kbRows] = await pool.execute("SELECT name, summary, content FROM agent_knowledge WHERE agent_id = ?", [agentId]);
    if (kbRows.length > 0) {
      const kbTexts = kbRows.map((r) => {
        const text = r.content && r.content.length > 10 ? r.content : r.summary;
        return `[${r.name}]\n${text}`;
      }).join("\n\n---\n\n");
      knowledgeContext = `\n\nCRITICAL: The following is YOUR personal knowledge base. Treat this as your own knowledge and memory. Answer directly when asked about anything here:\n\n${kbTexts}\n\n`;
    }
  } catch { /* ignore */ }

  if (agent.provider === "zhipu") {
    return await callZhipuVideoAgent(input);
  } else {
    return await callDeepSeekAgent((config.systemPrompt || "") + knowledgeContext, input, "deepseek", userId);
  }
}

async function callDeepSeekAgent(systemPrompt, userInput, provider = "deepseek", userId = null) {
  const now = new Date();
  const dateContext = `CURRENT DATE: ${now.toISOString().split("T")[0]} (Year ${now.getFullYear()}). Use this for any date-related calculations.`;
  const langInstruction = "IMPORTANT: You must respond in the same language as the user's input. If the user writes in Chinese, respond in Chinese. If in English, respond in English.";

  // Use the user's personal active model from DB
  let aiUrl = "";
  let aiKey = "";
  let aiModel = "";

  const [activeModel] = userId
    ? await pool.execute("SELECT * FROM ai_model_settings WHERE user_id = ? AND enabled = TRUE LIMIT 1", [userId])
    : await pool.execute("SELECT * FROM ai_model_settings WHERE enabled = TRUE LIMIT 1");
  if (activeModel.length === 0) {
    throw new Error("No AI model enabled. Please enable one in AI Model Settings");
  }
  if (!activeModel[0].api_key) {
    throw new Error("Active model has no API Key. Please configure it in AI Model Settings");
  }
  aiUrl = activeModel[0].api_url;
  aiKey = activeModel[0].api_key;
  aiModel = activeModel[0].model_name;

  const response = await fetch(aiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiKey}`,
    },
    body: JSON.stringify({
      model: aiModel,
      messages: [
        { role: "system", content: `${dateContext}\n\n${systemPrompt}\n\n${langInstruction}` },
        { role: "user", content: userInput },
      ],
      temperature: 0.7,
      max_tokens: 16384,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callZhipuVideoAgent(prompt) {
  // Submit video generation
  const genResponse = await fetch(`${ZHIPU_BASE}/videos/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ZHIPU_API_KEY}`,
    },
    body: JSON.stringify({ model: "cogvideox-3", prompt: prompt.slice(0, 500) }),
  });

  if (!genResponse.ok) {
    const err = await genResponse.text();
    throw new Error(`Zhipu video error: ${genResponse.status} - ${err}`);
  }

  const genData = await genResponse.json();
  const requestId = genData.id || genData.task_id || "";
  if (!requestId) throw new Error("No task ID returned from Zhipu");

  // Poll for completion (max 10 min)
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 5000));

    const statusResponse = await fetch(`${ZHIPU_BASE}/async-result/${requestId}`, {
      headers: { Authorization: `Bearer ${ZHIPU_API_KEY}` },
    });

    if (!statusResponse.ok) continue;

    const statusData = await statusResponse.json();
    if (statusData.task_status === "SUCCESS") {
      const results = statusData.video_result || [];
      if (results.length > 0) return results[0].url;
      throw new Error("Video generation completed but no URL");
    }
    if (statusData.task_status === "FAIL") {
      throw new Error(statusData.message || "Video generation failed");
    }
  }

  throw new Error("Video generation timed out");
}

// ============ Video Generation API (Zhipu CogVideoX-3) ============
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || "";
const ZHIPU_BASE = "https://open.bigmodel.cn/api/paas/v4";

app.post("/api/video/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const response = await fetch(`${ZHIPU_BASE}/videos/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: "cogvideox-3",
        prompt: prompt.trim(),
        quality: "speed",
        with_audio: true,
        size: "1920x1080",
        fps: 30,
        duration: 5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Zhipu API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error?.message || errorJson.message || errorMsg;
      } catch {}
      return res.status(500).json({ error: errorMsg });
    }

    const data = await response.json();
    res.json({ id: data.id || data.task_id || "" });
  } catch (e) {
    res.status(500).json({ error: e.message || "Submission failed" });
  }
});

app.post("/api/video/status", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id || !id.trim()) {
      return res.status(400).json({ error: "id is required" });
    }

    const response = await fetch(`${ZHIPU_BASE}/async-result/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ZHIPU_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Query status failed: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error?.message || errorJson.message || errorMsg;
      } catch {}
      return res.status(500).json({ error: errorMsg });
    }

    const data = await response.json();

    let videoUrl;
    if (data.task_status === "SUCCESS") {
      const results = data.video_result || [];
      if (results.length > 0) {
        videoUrl = results[0].url;
      }
    }

    res.json({
      id,
      status: data.task_status,
      video_url: videoUrl,
      error: data.task_status === "FAIL" ? (data.message || "Generation failed") : undefined,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Query failed" });
  }
});

// ============ DeepSeek Proxy API ============
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || "";
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

app.post("/api/deepseek/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `DeepSeek API error: ${response.status} - ${errorText}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || "DeepSeek call failed" });
  }
});

// ============ Invite Code API ============
app.post("/api/organizations/:id/invite-codes", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    // Only org creator or department leaders can generate invite codes
    const [org] = await pool.execute("SELECT name, created_by FROM organizations WHERE id = ?", [req.params.id]);
    if (org.length === 0) return res.status(404).json({ error: "Organization not found" });
    const isCreator = org[0].created_by === req.user.id;
    const [leaderDepts] = await pool.execute("SELECT id FROM departments WHERE organization_id = ? AND leader_user_id = ?", [req.params.id, req.user.id]);
    if (!isCreator && leaderDepts.length === 0) return res.status(403).json({ error: "Only department leaders and above can generate invite codes" });
    const orgName = org[0].name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "").slice(0, 10);
    const code = `${orgName}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    await pool.execute(
      "INSERT INTO invite_codes (code, organization_id, created_by) VALUES (?, ?, ?)",
      [code, req.params.id, req.user.id]
    );
    res.json({ success: true, code });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/organizations/:id/invite-codes", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const [rows] = await pool.execute(
      "SELECT * FROM invite_codes WHERE organization_id = ? ORDER BY created_at DESC",
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Join org by invite code
app.post("/api/organizations/join-by-code", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { code, departmentId } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: "Invite code is required" });
    if (!departmentId?.trim()) return res.status(400).json({ error: "Please select a department" });
    // Find unused invite code
    const [codes] = await pool.execute("SELECT * FROM invite_codes WHERE code = ? AND used = FALSE", [code.trim()]);
    if (codes.length === 0) return res.status(400).json({ error: "Invalid or already used invite code" });
    const inviteCode = codes[0];
    // Verify department belongs to the org
    const [deptCheck] = await pool.execute("SELECT id FROM departments WHERE id = ? AND organization_id = ?", [departmentId.trim(), inviteCode.organization_id]);
    if (deptCheck.length === 0) return res.status(400).json({ error: "Invalid department" });
    // Mark code as used
    await pool.execute("UPDATE invite_codes SET used = TRUE, used_by = ?, used_at = NOW() WHERE id = ?", [req.user.id, inviteCode.id]);
    // Add user to org as approved member with role 'member'
    await pool.execute("DELETE FROM org_members WHERE organization_id = ? AND user_id = ?", [inviteCode.organization_id, req.user.id]);
    await pool.execute(
      "INSERT INTO org_members (organization_id, user_id, email, role, status, department_id) VALUES (?, ?, ?, 'member', 'approved', ?)",
      [inviteCode.organization_id, req.user.id, req.user.email, departmentId.trim()]
    );
    res.json({ success: true, organizationId: inviteCode.organization_id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Agent Knowledge Base (Feeding) API ============
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max (for video/audio)

app.get("/api/agents/:id/knowledge", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    // Filter by user's organization
    let orgId = "";
    try {
      const [orgs] = await pool.execute("SELECT organization_id FROM org_members WHERE user_id = ? AND status = 'approved' LIMIT 1", [req.user.id]);
      if (orgs.length > 0) orgId = orgs[0].organization_id;
    } catch { /* ignore */ }
    
    let rows;
    try {
      [rows] = await pool.execute(
        "SELECT id, agent_id, name, type, content, summary, created_at, created_by FROM agent_knowledge WHERE agent_id = ? AND (organization_id = ? OR organization_id IS NULL OR organization_id = '') ORDER BY created_at DESC",
        [req.params.id, orgId]
      );
    } catch {
      // Fallback if organization_id column doesn't exist
      [rows] = await pool.execute(
        "SELECT id, agent_id, name, type, content, summary, created_at, created_by FROM agent_knowledge WHERE agent_id = ? ORDER BY created_at DESC",
        [req.params.id]
      );
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Debug endpoint: view all raw knowledge for an agent (for testing)
app.get("/api/agents/:id/knowledge/debug", async (req, res) => {
  try {
    let rows;
    try {
      [rows] = await pool.execute("SELECT id, agent_id, organization_id, name, type, content, summary, created_at FROM agent_knowledge WHERE agent_id = ? ORDER BY created_at DESC", [req.params.id]);
    } catch {
      [rows] = await pool.execute("SELECT id, agent_id, name, type, content, summary, created_at FROM agent_knowledge WHERE agent_id = ? ORDER BY created_at DESC", [req.params.id]);
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Text-based knowledge feeding
app.post("/api/agents/:id/knowledge", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { name, type, content, organizationId } = req.body;
    if (!name?.trim() || !content?.trim()) return res.status(400).json({ error: "name and content are required" });
    
    // Get user's org if not provided
    let orgId = organizationId || "";
    if (!orgId) {
      try {
        const [orgs] = await pool.execute("SELECT organization_id FROM org_members WHERE user_id = ? AND status = 'approved' LIMIT 1", [req.user.id]);
        if (orgs.length > 0) orgId = orgs[0].organization_id;
      } catch { /* ignore */ }
    }

    const trimmedContent = content.trim();
    let summary = trimmedContent.slice(0, 500);
    try {
      summary = await analyzeKnowledge(trimmedContent, req.user.id);
    } catch (analyzeErr) {
      console.error("[KNOWLEDGE] Analyze failed:", analyzeErr.message);
    }
    const id = `kb-${crypto.randomUUID().slice(0, 8)}`;
    await pool.execute(
      "INSERT INTO agent_knowledge (id, agent_id, organization_id, name, type, content, summary, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, req.params.id, orgId, name.trim(), type || "text", trimmedContent, summary, req.user.id]
    );
    res.json({ success: true, id, summary });
  } catch (e) {
    console.error("[KNOWLEDGE POST ERROR]", e.message, e.stack);
    res.status(500).json({ error: "Feed failed: " + (e.message || "database error") });
  }
});

// File upload knowledge feeding (PDF, TXT, documents, images)
app.post("/api/agents/:id/knowledge/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    if (!req.file) return res.status(400).json({ error: "Please upload a file" });
    
    // Fix Chinese filename encoding (multer gives latin1-encoded originalname)
    let fileName = req.file.originalname;
    try {
      fileName = Buffer.from(req.file.originalname, "latin1").toString("utf-8");
    } catch {
      // If that fails, try decoding as-is
    }
    const mimeType = req.file.mimetype;
    let textContent = "";

    if (mimeType.startsWith("text/") || fileName.endsWith(".txt") || fileName.endsWith(".md") || fileName.endsWith(".csv") || fileName.endsWith(".json")) {
      // Plain text files — try UTF-8 first, fallback to GBK (common on Windows Chinese systems)
      textContent = req.file.buffer.toString("utf-8");
      // Check if it looks like garbage (indicates wrong encoding)
      const garbleRatio = textContent.replace(/[\x00-\x7F\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\n\r\t ]/g, "").length / Math.max(textContent.length, 1);
      if (garbleRatio > 0.3) {
        // Likely GBK encoded, try decoding with iconv
        try {
          textContent = iconv.decode(req.file.buffer, "gbk");
        } catch {
          // Keep UTF-8 result
        }
      }
    } else if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
      // PDF — convert pages to images and use AI vision to read
      const base64 = req.file.buffer.toString("base64");
      const pdfDataUrl = `data:application/pdf;base64,${base64}`;
      // Try pdf-parse first for text extraction
      try {
        const parser = new pdfParse.PDFParse({ data: req.file.buffer, verbosity: 0 });
        const result = await parser.getText();
        const rawText = (result.text || "").trim();
        const cjkChars = rawText.match(/[\u4e00-\u9fff]/g)?.length || 0;
        const totalChars = rawText.replace(/\s/g, "").length;
        // If we got meaningful text (not just numbers/garbage), use it
        if (rawText.length > 10 && (totalChars === 0 || cjkChars / totalChars > 0.05 || !/[\u4e00-\u9fff]/.test(fileName))) {
          textContent = rawText;
        }
      } catch { /* pdf-parse failed */ }
      // If text extraction failed or was garbage, try AI vision
      if (!textContent.trim()) {
        try {
          await ensureUserModels(req.user.id);
          const [activeModel] = await pool.execute("SELECT * FROM ai_model_settings WHERE user_id = ? AND enabled = TRUE LIMIT 1", [req.user.id]);
          if (activeModel.length > 0 && activeModel[0].api_key) {
            const visionRes = await fetch(activeModel[0].api_url, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${activeModel[0].api_key}` },
              body: JSON.stringify({
                model: activeModel[0].model_name,
                messages: [{ role: "user", content: [
                  { type: "text", text: "Extract ALL text from this PDF page image. Output ONLY the exact text content. If Chinese, output Chinese characters." },
                  { type: "image_url", image_url: { url: pdfDataUrl } }
                ] }],
                max_tokens: 4096,
              }),
            });
            if (visionRes.ok) {
              const d = await visionRes.json();
              textContent = d.choices?.[0]?.message?.content || "";
            }
          }
        } catch { /* vision failed */ }
      }
      if (!textContent.trim()) {
        return res.status(400).json({ error: "Cannot extract text from this PDF. Please copy text from the PDF and paste it below." });
      }
    } else if (fileName.endsWith(".docx") || mimeType.includes("officedocument.wordprocessingml")) {
      // DOCX — use mammoth to extract text
      try {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        textContent = result.value || "";
        if (!textContent.trim()) return res.status(400).json({ error: "DOCX content is empty" });
      } catch (docErr) {
        return res.status(400).json({ error: "DOCX parse failed: " + docErr.message });
      }
    } else if (fileName.endsWith(".doc") || mimeType.includes("msword")) {
      return res.status(400).json({ error: "Old .doc format not supported. Please save as .docx and re-upload." });
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || mimeType.includes("spreadsheetml") || mimeType.includes("ms-excel")) {
      // Excel — use xlsx to extract all sheet data as text
      try {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const texts = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          if (csv.trim()) texts.push(`[Sheet: ${sheetName}]\n${csv}`);
        }
        textContent = texts.join("\n\n");
        if (!textContent.trim()) return res.status(400).json({ error: "Excel file is empty" });
      } catch (xlsErr) {
        return res.status(400).json({ error: "Excel parse failed: " + xlsErr.message });
      }
    } else if (fileName.endsWith(".pptx") || mimeType.includes("presentationml")) {
      // PPTX — unzip and extract text from XML slides
      try {
        const zip = new AdmZip(req.file.buffer);
        const texts = [];
        const slideEntries = zip.getEntries().filter(e => e.entryName.match(/ppt\/slides\/slide\d+\.xml/)).sort((a, b) => a.entryName.localeCompare(b.entryName));
        for (const entry of slideEntries) {
          const xml = entry.getData().toString("utf-8");
          // Extract text between <a:t> tags
          const matches = xml.match(/<a:t>([^<]*)<\/a:t>/g);
          if (matches) {
            const slideText = matches.map(m => m.replace(/<\/?a:t>/g, "")).join(" ");
            const slideNum = entry.entryName.match(/slide(\d+)/)?.[1];
            if (slideText.trim()) texts.push(`[Slide ${slideNum}]\n${slideText}`);
          }
        }
        textContent = texts.join("\n\n");
        if (!textContent.trim()) return res.status(400).json({ error: "PPTX has no text content" });
      } catch (pptErr) {
        return res.status(400).json({ error: "PPTX parse failed: " + pptErr.message });
      }
    } else if (fileName.endsWith(".ppt")) {
      return res.status(400).json({ error: "Old .ppt format not supported. Please save as .pptx and re-upload." });
    } else if (mimeType.startsWith("audio/") || fileName.match(/\.(mp3|wav|m4a|ogg|flac|aac|wma)$/i)) {
      // Audio — transcribe with Whisper (tries all available models)
      textContent = await transcribeAudio(req.file.buffer, mimeType, fileName, req.user.id);
      if (!textContent.trim()) {
        return res.status(400).json({ error: "无法转录音频。所有已配置的AI模型均不支持语音转文字(Whisper)。请在AI模型设置中添加OpenAI并填写API Key，或手动转录后粘贴文本。" });
      }
    } else if (mimeType.startsWith("video/") || fileName.match(/\.(mp4|mov|avi|mkv|webm|flv)$/i)) {
      // Video — extract audio with ffmpeg, then transcribe
      if (!ffmpegPath) {
        return res.status(400).json({ error: "服务器未安装ffmpeg，无法处理视频文件。请提取音频后上传音频文件。" });
      }
      let tempVideoPath, tempAudioPath;
      try {
        const tmpDir = tmpdir();
        const uid = crypto.randomUUID().slice(0, 8);
        tempVideoPath = join(tmpDir, `vid_${uid}_input`);
        tempAudioPath = join(tmpDir, `aud_${uid}.mp3`);
        await writeFile(tempVideoPath, req.file.buffer);
        // Extract audio using ffmpeg-static
        await new Promise((resolve, reject) => {
          execFile(ffmpegPath, [
            "-i", tempVideoPath,
            "-vn", "-acodec", "libmp3lame", "-ab", "128k", "-ar", "16000", "-ac", "1",
            "-y", tempAudioPath
          ], { timeout: 120000 }, (err, stdout, stderr) => {
            if (err) reject(new Error("ffmpeg failed: " + (err.message || stderr)));
            else resolve();
          });
        });
        const { readFile: fsReadFile } = await import("fs/promises");
        const audioBuffer = await fsReadFile(tempAudioPath);
        textContent = await transcribeAudio(audioBuffer, "audio/mpeg", "audio.mp3", req.user.id);
      } catch (videoErr) {
        console.error("[VIDEO EXTRACT ERROR]", videoErr.message);
      } finally {
        try { if (tempVideoPath) await unlink(tempVideoPath); } catch {}
        try { if (tempAudioPath) await unlink(tempAudioPath); } catch {}
      }
      if (!textContent.trim()) {
        return res.status(400).json({ error: "无法转录视频音频。所有已配置的AI模型均不支持语音转文字(Whisper)。请在AI模型设置中添加OpenAI并填写API Key，或手动转录后粘贴文本。" });
      }
    } else if (mimeType.startsWith("image/")) {
      // Images — store as base64 and try to describe with AI vision
      const base64 = req.file.buffer.toString("base64");
      const imageDataUrl = `data:${mimeType};base64,${base64}`;
      const id = `kb-${crypto.randomUUID().slice(0, 8)}`;
      let orgId = "";
      try {
        const [orgs] = await pool.execute("SELECT organization_id FROM org_members WHERE user_id = ? AND status = 'approved' LIMIT 1", [req.user.id]);
        if (orgs.length > 0) orgId = orgs[0].organization_id;
      } catch { /* ignore */ }

      // Try to get AI description using the active model's vision capability
      let summary = `[Image: ${fileName}] Requires a vision-capable AI model to read content`;
      let contentToStore = "";
      try {
        await ensureUserModels(req.user.id);
        const [activeModel] = await pool.execute("SELECT * FROM ai_model_settings WHERE user_id = ? AND enabled = TRUE LIMIT 1", [req.user.id]);
        if (activeModel.length > 0 && activeModel[0].api_key) {
          const visionRes = await fetch(activeModel[0].api_url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${activeModel[0].api_key}` },
            body: JSON.stringify({
              model: activeModel[0].model_name,
              messages: [{ role: "user", content: [{ type: "text", text: "Extract ALL text from this image. Output ONLY the exact text content, nothing else. No descriptions, no explanations, no formatting notes. Just the text as written." }, { type: "image_url", image_url: { url: imageDataUrl } }] }],
              max_tokens: 2048,
            }),
          });
          if (visionRes.ok) {
            const visionData = await visionRes.json();
            const description = visionData.choices?.[0]?.message?.content;
            if (description) {
              summary = description;
              contentToStore = description;
            }
          } else {
            console.log("[IMAGE VISION] Model does not support vision or returned error:", visionRes.status);
          }
        }
      } catch (visionErr) {
        console.log("[IMAGE VISION] Vision call failed:", visionErr.message);
      }

      if (!contentToStore) {
        return res.status(400).json({ error: "Current AI model cannot read images. Please switch to a vision-capable model (e.g. GPT-4o) or describe the image content manually via text feed." });
      }

      await pool.execute(
        "INSERT INTO agent_knowledge (id, agent_id, organization_id, name, type, content, summary, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, req.params.id, orgId, fileName, "image", contentToStore, summary, req.user.id]
      );
      return res.json({ success: true, id, summary, fileName });
    } else {
      // Other files — try to read as text
      try {
        const raw = req.file.buffer.toString("utf-8").slice(0, 100000);
        // Check if content looks like valid text (not mostly garbage)
        const printableRatio = raw.replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\n\r\t]/g, "").length / raw.length;
        if (printableRatio < 0.7) {
          return res.status(400).json({ error: "File content not recognized as valid text. Please copy and paste the content instead" });
        }
        textContent = raw;
      } catch {
        return res.status(400).json({ error: "Cannot read file content. Please try pasting text instead" });
      }
    }

    if (!textContent.trim()) {
      return res.status(400).json({ error: "Cannot extract text from file" });
    }

    const summary = await analyzeKnowledge(textContent, req.user.id);
    const id = `kb-${crypto.randomUUID().slice(0, 8)}`;
    const fileType = mimeType.startsWith("image/") ? "image" : mimeType === "application/pdf" ? "pdf" : mimeType.startsWith("audio/") ? "audio" : mimeType.startsWith("video/") ? "video" : "document";
    
    // Get user's org
    let orgId = "";
    try {
      const [orgs] = await pool.execute("SELECT organization_id FROM org_members WHERE user_id = ? AND status = 'approved' LIMIT 1", [req.user.id]);
      if (orgs.length > 0) orgId = orgs[0].organization_id;
    } catch { /* ignore */ }
    
    await pool.execute(
      "INSERT INTO agent_knowledge (id, agent_id, organization_id, name, type, content, summary, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, req.params.id, orgId, fileName, fileType, textContent, summary, req.user.id]
    );
    res.json({ success: true, id, summary, fileName });
  } catch (e) {
    console.error("[KNOWLEDGE UPLOAD ERROR]", e.message, e.stack);
    res.status(500).json({ error: "File feed failed: " + (e.message || "database error") });
  }
});

// Helper: transcribe audio buffer using Whisper API (tries all available models + Groq free fallback)
async function transcribeAudio(audioBuffer, audioMimeType, audioFileName, userId) {
  // Collect all candidate Whisper endpoints
  const candidates = [];
  
  // 1. User's configured models (all, not just enabled)
  try {
    await ensureUserModels(userId);
    const [allModels] = await pool.execute("SELECT * FROM ai_model_settings WHERE user_id = ? ORDER BY enabled DESC", [userId]);
    for (const m of allModels) {
      if (!m.api_key) continue;
      const baseUrl = m.api_url.replace(/\/chat\/completions$/, "");
      candidates.push({ key: m.api_key, url: baseUrl + "/audio/transcriptions", name: m.name });
      const altBase = baseUrl.replace(/\/v1$/, "");
      if (altBase !== baseUrl) {
        candidates.push({ key: m.api_key, url: altBase + "/v1/audio/transcriptions", name: m.name + " (alt)" });
      }
    }
  } catch { /* ignore */ }

  // 2. Env OPENAI_API_KEY
  const envOpenaiKey = process.env.OPENAI_API_KEY || "";
  if (envOpenaiKey) {
    candidates.push({ key: envOpenaiKey, url: "https://api.openai.com/v1/audio/transcriptions", name: "OpenAI (env)" });
  }

  // 3. Groq free Whisper (env GROQ_API_KEY)
  const groqKey = process.env.GROQ_API_KEY || "";
  if (groqKey) {
    candidates.push({ key: groqKey, url: "https://api.groq.com/openai/v1/audio/transcriptions", name: "Groq Whisper", model: "whisper-large-v3" });
  }

  for (const c of candidates) {
    try {
      const formData = new FormData();
      formData.append("file", new Blob([audioBuffer], { type: audioMimeType }), audioFileName);
      formData.append("model", c.model || "whisper-1");
      const res = await fetch(c.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${c.key}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.text || "";
        if (text.trim()) {
          console.log(`[WHISPER] Transcribed via ${c.name}: ${text.length} chars`);
          return text;
        }
      } else {
        console.log(`[WHISPER] ${c.name} returned ${res.status}`);
      }
    } catch (e) {
      console.log(`[WHISPER] ${c.name} failed: ${e.message}`);
    }
  }

  // 4. Last resort: try active AI model's chat completions with audio description prompt
  //    (for models that support audio/multimodal input via base64)
  try {
    await ensureUserModels(userId);
    const [activeModel] = await pool.execute("SELECT * FROM ai_model_settings WHERE user_id = ? AND enabled = TRUE LIMIT 1", [userId]);
    if (activeModel.length > 0 && activeModel[0].api_key) {
      const base64Audio = Buffer.from(audioBuffer).toString("base64");
      const audioDataUrl = `data:${audioMimeType};base64,${base64Audio}`;
      const chatRes = await fetch(activeModel[0].api_url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${activeModel[0].api_key}` },
        body: JSON.stringify({
          model: activeModel[0].model_name,
          messages: [{ role: "user", content: [
            { type: "text", text: "Please transcribe the following audio file into text. Output ONLY the exact transcription, nothing else. If it's in Chinese, output Chinese characters." },
            { type: "input_audio", input_audio: { data: base64Audio, format: audioMimeType.includes("mp3") ? "mp3" : "wav" } }
          ] }],
          max_tokens: 4096,
        }),
      });
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        const text = chatData.choices?.[0]?.message?.content || "";
        if (text.trim() && text.length > 5) {
          console.log(`[AUDIO-CHAT] Transcribed via chat completions: ${text.length} chars`);
          return text;
        }
      }
    }
  } catch { /* chat completions audio fallback failed */ }

  return "";
}

// Helper: analyze knowledge content with the active AI model
async function analyzeKnowledge(content, userId) {
  let summary = content.slice(0, 500);
  try {
    let activeModelRows;
    if (userId) {
      await ensureUserModels(userId);
      [activeModelRows] = await pool.execute("SELECT * FROM ai_model_settings WHERE user_id = ? AND enabled = TRUE LIMIT 1", [userId]);
    } else {
      [activeModelRows] = await pool.execute("SELECT * FROM ai_model_settings WHERE user_id IS NULL AND enabled = TRUE LIMIT 1");
    }
    const activeModel = activeModelRows;
    if (activeModel.length > 0 && activeModel[0].api_key) {
      const analyzeRes = await fetch(activeModel[0].api_url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${activeModel[0].api_key}` },
        body: JSON.stringify({
          model: activeModel[0].model_name,
          messages: [
            { role: "system", content: "You are a knowledge analyst. Summarize the following document into a concise knowledge description (max 300 words) that can be used as context for an AI agent. Focus on key facts, capabilities, and domain knowledge. Respond in the same language as the input." },
            { role: "user", content: content.slice(0, 8000) },
          ],
          max_tokens: 1024,
        }),
      });
      if (analyzeRes.ok) {
        const analyzeData = await analyzeRes.json();
        summary = analyzeData.choices?.[0]?.message?.content || summary;
      } else {
        console.error("[KNOWLEDGE ANALYZE] AI returned error:", analyzeRes.status, await analyzeRes.text().catch(() => ""));
      }
    } else {
      console.log("[KNOWLEDGE ANALYZE] No active model with API key, using raw content as summary");
    }
  } catch (e) {
    console.error("[KNOWLEDGE ANALYZE] Error:", e.message);
  }
  return summary;
}

app.delete("/api/agents/:id/knowledge/:kbId", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    await pool.execute("DELETE FROM agent_knowledge WHERE id = ? AND agent_id = ?", [req.params.kbId, req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ AI Model Settings API (per-user) ============

// Helper: ensure the user has their own model copies (cloned from presets)
async function ensureUserModels(userId) {
  const [existing] = await pool.execute("SELECT id FROM ai_model_settings WHERE user_id = ?", [userId]);
  if (existing.length === 0) {
    // Clone preset models for this user
    const [presets] = await pool.execute("SELECT * FROM ai_model_settings WHERE user_id IS NULL");
    for (const p of presets) {
      const newId = `model-${userId.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await pool.execute(
        "INSERT INTO ai_model_settings (id, name, provider, api_url, api_key, model_name, enabled, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [newId, p.name, p.provider, p.api_url, p.api_key || '', p.model_name, p.enabled, userId]
      );
    }
  } else {
    // Migrate: if user still has old ChatGPT model, update to Qwen
    await pool.execute(
      "UPDATE ai_model_settings SET name = 'qwen3.8-max', provider = 'qwen3.8-max', api_url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model_name = 'qwen3.8-max' WHERE user_id = ? AND (provider = 'openai' OR provider = 'qwen') AND name IN ('ChatGPT', 'Qwen')",
      [userId]
    ).catch(() => {});
    // Also fix existing qwen models with wrong name/provider
    await pool.execute(
      "UPDATE ai_model_settings SET name = 'qwen3.8-max', provider = 'qwen3.8-max', model_name = 'qwen3.8-max' WHERE user_id = ? AND provider IN ('qwen', 'qwen3.8-max') AND (name != 'qwen3.8-max' OR model_name != 'qwen3.8-max')",
      [userId]
    ).catch(() => {});
    // Sync: if user's models have empty api_key, fill from matching preset
    const [emptyKeyModels] = await pool.execute("SELECT id, provider FROM ai_model_settings WHERE user_id = ? AND (api_key = '' OR api_key IS NULL)", [userId]);
    if (emptyKeyModels.length > 0) {
      const [presets] = await pool.execute("SELECT provider, api_key FROM ai_model_settings WHERE user_id IS NULL AND api_key IS NOT NULL AND api_key != ''");
      for (const m of emptyKeyModels) {
        const preset = presets.find(p => p.provider === m.provider);
        if (preset) {
          await pool.execute("UPDATE ai_model_settings SET api_key = ? WHERE id = ? AND user_id = ?", [preset.api_key, m.id, userId]);
        }
      }
    }
  }
}

app.get("/api/settings/ai-models", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    await ensureUserModels(req.user.id);
    const [rows] = await pool.execute("SELECT * FROM ai_model_settings WHERE user_id = ? ORDER BY name", [req.user.id]);
    // Mask API keys for security
    const result = rows.map((r) => ({ ...r, api_key: r.api_key ? "••••" + r.api_key.slice(-4) : "" }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/settings/ai-models", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { name, provider, api_url, api_key, model_name } = req.body;
    if (!name?.trim() || !api_url?.trim() || !model_name?.trim()) {
      return res.status(400).json({ error: "Name, API URL, and model name are required" });
    }
    const id = `model-${req.user.id.slice(0, 8)}-${Date.now()}`;
    await pool.execute(
      "INSERT INTO ai_model_settings (id, name, provider, api_url, api_key, model_name, enabled, user_id) VALUES (?, ?, ?, ?, ?, ?, FALSE, ?)",
      [id, name.trim(), provider?.trim() || "custom", api_url.trim(), api_key || "", model_name.trim(), req.user.id]
    );
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get active model name for a user (used by agent cards to display real-time model)
app.get("/api/settings/ai-models/active", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    await ensureUserModels(req.user.id);
    const [rows] = await pool.execute("SELECT name, provider, model_name FROM ai_model_settings WHERE user_id = ? AND enabled = TRUE LIMIT 1", [req.user.id]);
    if (rows.length === 0) return res.json({ name: "No Model", provider: "none", model_name: "" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/settings/ai-models/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    // Ensure the model belongs to the current user
    const [ownership] = await pool.execute("SELECT id FROM ai_model_settings WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    if (ownership.length === 0) return res.status(403).json({ error: "Not your model" });
    const { api_key, enabled, name, api_url, model_name, provider } = req.body;
    const updates = [];
    const params = [];
    if (api_key !== undefined) { updates.push("api_key = ?"); params.push(api_key); }
    if (name !== undefined) { updates.push("name = ?"); params.push(name.trim()); }
    if (api_url !== undefined) { updates.push("api_url = ?"); params.push(api_url.trim()); }
    if (model_name !== undefined) { updates.push("model_name = ?"); params.push(model_name.trim()); }
    if (provider !== undefined) { updates.push("provider = ?"); params.push(provider.trim()); }
    if (enabled !== undefined) {
      if (enabled) {
        // Check if this model has an API key set before enabling
        const [current] = await pool.execute("SELECT api_key FROM ai_model_settings WHERE id = ?", [req.params.id]);
        const currentKey = current.length > 0 ? current[0].api_key : "";
        const finalKey = api_key !== undefined ? api_key : currentKey;
        if (!finalKey) {
          return res.status(400).json({ error: "Please set the API Key before enabling this model" });
        }
        // Disable all other models for this user
        await pool.execute("UPDATE ai_model_settings SET enabled = FALSE WHERE user_id = ? AND id != ?", [req.user.id, req.params.id]);
      }
      updates.push("enabled = ?"); params.push(enabled ? 1 : 0);
    }
    if (updates.length > 0) {
      params.push(req.params.id);
      await pool.execute(`UPDATE ai_model_settings SET ${updates.join(", ")} WHERE id = ?`, params);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/settings/ai-models/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    // Ensure the model belongs to the current user
    const [ownership] = await pool.execute("SELECT id, enabled FROM ai_model_settings WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    if (ownership.length === 0) return res.status(403).json({ error: "Not your model" });
    // Don't allow deleting the currently enabled model
    if (ownership[0].enabled) {
      return res.status(400).json({ error: "Cannot delete the active model. Switch to another model first" });
    }
    await pool.execute("DELETE FROM ai_model_settings WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Conversational Workflow Creation API ============
app.post("/api/workflows/ai-create", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const { description, organizationId } = req.body;
    if (!description?.trim()) return res.status(400).json({ error: "description is required" });
    // Get all available agents
    const [allAgents] = await pool.execute("SELECT id, name, description, type FROM agents ORDER BY name");
    const agentList = allAgents.map((a) => `- ${a.name} (id: ${a.id}): ${a.description}`).join("\n");
    // Ask AI to design the workflow using the user's active model
    await ensureUserModels(req.user.id);
    const [userModel] = await pool.execute("SELECT * FROM ai_model_settings WHERE user_id = ? AND enabled = TRUE LIMIT 1", [req.user.id]);
    if (userModel.length === 0 || !userModel[0].api_key) {
      return res.status(400).json({ error: "No AI model configured. Please set up your API key in AI Model Settings." });
    }
    const aiRes = await fetch(userModel[0].api_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userModel[0].api_key}` },
      body: JSON.stringify({
        model: userModel[0].model_name,
        messages: [
          { role: "system", content: `You are a workflow designer. Given a user's goal, design a workflow using available agents. If no existing agent fits a step, create a new one.

Available agents:
${agentList}

Output JSON format:
{
  "name": "workflow name",
  "description": "workflow description",
  "steps": [
    { "name": "step name", "agentId": "existing-agent-id or null", "newAgent": { "name": "...", "description": "...", "type": "...", "systemPrompt": "..." } or null, "description": "what this step does" }
  ]
}

Rules:
1. Use existing agents when possible (match by agentId)
2. If a step needs an agent that doesn't exist, set agentId to null and fill newAgent
3. Minimum 2 steps
4. Respond in the same language as the user
5. Output ONLY valid JSON, no other text` },
          { role: "user", content: description.trim() },
        ],
        max_tokens: 4096,
      }),
    });
    if (!aiRes.ok) return res.status(500).json({ error: "AI analysis failed" });
    const aiData = await aiRes.json();
    let reply = aiData.choices?.[0]?.message?.content || "";
    // Extract JSON from reply
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: "AI did not return valid workflow design" });
    const design = JSON.parse(jsonMatch[0]);
    // Auto-create missing agents
    for (const step of design.steps) {
      if (!step.agentId && step.newAgent) {
        const newId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        const config = JSON.stringify({ systemPrompt: step.newAgent.systemPrompt || "" });
        await pool.execute(
          "INSERT INTO agents (id, name, description, type, input_format, output_format, provider, config) VALUES (?, ?, ?, ?, 'text', 'text', 'deepseek', ?)",
          [newId, step.newAgent.name, step.newAgent.description || "", step.newAgent.type || "custom", config]
        );
        // Set permissions to all
        await pool.execute("INSERT INTO agent_permissions (agent_id, organization_id, target_type) VALUES (?, ?, 'all')", [newId, organizationId || ""]);
        step.agentId = newId;
        step.createdAgent = step.newAgent.name;
      }
    }
    res.json(design);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start server
const PORT = 3001;
initTables()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 API Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to init database:", err.message);
    process.exit(1);
  });
