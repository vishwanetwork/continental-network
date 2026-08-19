import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import crypto from "crypto";
import { config } from "dotenv";
import { getOAuthConfig } from "./oauth-config.mjs";
config();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ============ Google OAuth Configuration ============
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const { googleRedirectUri: GOOGLE_REDIRECT_URI, publicAppUrl: PUBLIC_APP_URL } = getOAuthConfig();

// Simple in-memory session store (use Redis/DB in production)
const sessions = new Map();

const pool = mysql.createPool({
  host: "gateway01.ap-northeast-1.prod.aws.tidbcloud.com",
  port: 4000,
  user: "2maWvN2xTnrKcsy.root",
  password: "8Ianj13vRmQJje0L",
  waitForConnections: true,
  connectionLimit: 10,
  ssl: { rejectUnauthorized: true },
});

// Initialize table schema
async function initTables() {
  const conn = await pool.getConnection();
  try {
    await conn.execute("CREATE DATABASE IF NOT EXISTS workflow");
    await conn.execute("USE workflow");
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS departments (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        parent_id VARCHAR(64) DEFAULT NULL,
        description VARCHAR(512) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS members (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        role VARCHAR(128) DEFAULT '',
        department_id VARCHAR(64) NOT NULL,
        email VARCHAR(256) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        description TEXT,
        type VARCHAR(64) NOT NULL,
        capabilities JSON,
        status VARCHAR(32) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS agent_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        target_type VARCHAR(16) NOT NULL,
        target_id VARCHAR(64) NOT NULL,
        target_name VARCHAR(128) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_assignment (agent_id, target_type, target_id)
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_bases (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS kb_documents (
        id VARCHAR(64) PRIMARY KEY,
        kb_id VARCHAR(64) NOT NULL,
        name VARCHAR(256) NOT NULL,
        content LONGTEXT,
        type VARCHAR(32) DEFAULT 'text',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(256) NOT NULL UNIQUE,
        name VARCHAR(128) DEFAULT '',
        avatar VARCHAR(512) DEFAULT '',
        google_id VARCHAR(128) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Tables initialized");
  } finally {
    conn.release();
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

app.use((req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies["session_id"];
  if (sessionId && sessions.has(sessionId)) {
    req.user = sessions.get(sessionId);
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
    sessions.set(sessionId, {
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

app.post("/api/auth/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies["session_id"];
  if (sessionId) sessions.delete(sessionId);
  res.setHeader("Set-Cookie", "session_id=; Path=/; HttpOnly; Max-Age=0");
  res.json({ success: true });
});

// ============ Departments API ============
app.get("/api/departments", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM departments ORDER BY created_at");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/departments", async (req, res) => {
  try {
    const { id, name, parentId, description } = req.body;
    await pool.execute(
      "INSERT INTO departments (id, name, parent_id, description) VALUES (?, ?, ?, ?)",
      [id, name, parentId || null, description || null]
    );
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/departments", async (req, res) => {
  try {
    const { id, name, description } = req.body;
    await pool.execute("UPDATE departments SET name = ?, description = ? WHERE id = ?", [name, description || null, id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/departments", async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "id required" });
    await pool.execute("DELETE FROM departments WHERE parent_id = ?", [id]);
    await pool.execute("DELETE FROM departments WHERE id = ?", [id]);
    await pool.execute("DELETE FROM members WHERE department_id = ?", [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Members API ============
app.get("/api/members", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM members ORDER BY created_at");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/members", async (req, res) => {
  try {
    const { id, name, role, departmentId, email } = req.body;
    await pool.execute(
      "INSERT INTO members (id, name, role, department_id, email) VALUES (?, ?, ?, ?, ?)",
      [id, name, role || "", departmentId, email || null]
    );
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/members", async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "id required" });
    await pool.execute("DELETE FROM members WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Agent API ============
app.get("/api/agents", async (req, res) => {
  try {
    const [agents] = await pool.execute("SELECT * FROM agents ORDER BY created_at");
    const [assignments] = await pool.execute("SELECT * FROM agent_assignments");
    const result = agents.map((agent) => ({
      ...agent,
      capabilities: typeof agent.capabilities === "string" ? JSON.parse(agent.capabilities) : agent.capabilities,
      assignedTo: assignments
        .filter((a) => a.agent_id === agent.id)
        .map((a) => ({ targetType: a.target_type, targetId: a.target_id, targetName: a.target_name })),
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/agents", async (req, res) => {
  try {
    const { id, name, description, type, capabilities, status } = req.body;
    await pool.execute(
      "INSERT INTO agents (id, name, description, type, capabilities, status) VALUES (?, ?, ?, ?, ?, ?)",
      [id, name, description || "", type, JSON.stringify(capabilities || []), status || "active"]
    );
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/agents", async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "id required" });
    await pool.execute("DELETE FROM agent_assignments WHERE agent_id = ?", [id]);
    await pool.execute("DELETE FROM agents WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Agent Assignment API ============
app.post("/api/agents/assign", async (req, res) => {
  try {
    const { agentId, targetType, targetId, targetName } = req.body;
    await pool.execute(
      "INSERT IGNORE INTO agent_assignments (agent_id, target_type, target_id, target_name) VALUES (?, ?, ?, ?)",
      [agentId, targetType, targetId, targetName || ""]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/agents/assign", async (req, res) => {
  try {
    const { agentId, targetId } = req.query;
    if (!agentId || !targetId) return res.status(400).json({ error: "agentId and targetId required" });
    await pool.execute("DELETE FROM agent_assignments WHERE agent_id = ? AND target_id = ?", [agentId, targetId]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

// 启动
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
