import mysql from "mysql2/promise";

async function test() {
  // 尝试不同配置
  const configs = [
    { label: "SSL + sha2", ssl: { rejectUnauthorized: false }, authPlugins: undefined },
    { label: "SSL disabled", ssl: undefined, authPlugins: undefined },
    { label: "mysql_native_password", ssl: undefined, authPlugins: { mysql_native_password: () => () => Buffer.from("cGy4Hy5iND4ZDmsM") } },
  ];

  for (const cfg of configs) {
    try {
      console.log(`\nTrying: ${cfg.label} ...`);
      const conn = await mysql.createConnection({
        host: "44.248.155.24",
        port: 3306,
        user: "workflow",
        password: "cGy4Hy5iND4ZDmsM",
        database: "workflow",
        connectTimeout: 10000,
        ssl: cfg.ssl,
      });
      console.log(`✅ Connected with: ${cfg.label}`);
      const [rows] = await conn.execute("SHOW TABLES");
      console.log("Tables:", rows);
      await conn.end();
      return;
    } catch (e) {
      console.log(`  ❌ ${e.code}: ${e.message}`);
    }
  }

  // 最后试试纯 TCP 连通性
  console.log("\n--- TCP connectivity test ---");
  const net = await import("net");
  const socket = net.default.createConnection({ host: "44.248.155.24", port: 3306, timeout: 5000 });
  socket.on("connect", () => {
    console.log("✅ TCP connection established");
  });
  socket.on("data", (data) => {
    console.log("Server greeting (first 100 bytes):", data.slice(0, 100).toString("hex"));
    console.log("As text:", data.slice(0, 100).toString("utf8").replace(/[^\x20-\x7E]/g, "."));
    socket.end();
  });
  socket.on("error", (e) => {
    console.log("❌ TCP error:", e.message);
  });
  socket.on("timeout", () => {
    console.log("❌ TCP timeout");
    socket.end();
  });
}

test();
