import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadMcpWorkspace } from "@/lib/crm/mcp-snapshot";
import { createLeadsMcpServer } from "./create-leads-mcp-server";
import { loadOrCreateLocalTls } from "./local-tls";

function applyCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, mcp-session-id, mcp-protocol-version, Last-Event-ID",
  );
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");
}

async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const host = req.headers.host ?? "127.0.0.1";
  const url = new URL(req.url ?? "/", `http://${host}`);
  if (url.pathname !== "/mcp" && url.pathname !== "/") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found. MCP endpoint is POST/GET /mcp");
    return;
  }

  const server = createLeadsMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}

async function serveRemote(): Promise<void> {
  const host = process.env.MCP_HOST?.trim() || "0.0.0.0";
  const port = Number(process.env.MCP_PORT || 3334);
  const useHttp = process.argv.includes("--http") || process.env.MCP_PLAIN_HTTP === "1";
  const onRequest = (req: IncomingMessage, res: ServerResponse) => {
    void handleHttp(req, res).catch((err) => {
      const message = err instanceof Error ? err.message : "MCP request failed.";
      if (!res.headersSent) {
        applyCors(res);
        res.writeHead(500, { "Content-Type": "application/json" });
      }
      if (!res.writableEnded) res.end(JSON.stringify({ error: message }));
    });
  };

  const protocol = useHttp ? "http" : "https";
  const origin = `${protocol}://127.0.0.1:${port}`;
  const url = `${origin}/mcp`;

  const listener = useHttp
    ? createHttpServer(onRequest)
    : createHttpsServer(await loadOrCreateLocalTls(), onRequest);

  listener.listen(port, host, () => {
    void (async () => {
      const snap = await loadMcpWorkspace();
      const modules = snap.workspace.modules.map((m) => `${m.pluralLabel} (${m.records.length})`).join(", ") || "none";
      console.error(`Sirrus CRM MCP — open, no auth (${protocol.toUpperCase()})`);
    console.error(`  URL:    ${url}`);
    if (!useHttp) {
      console.error(`  TLS:    self-signed localhost cert (first visit may need Trust)`);
    }
    console.error(`  Source: ${snap.source} · ${snap.path}`);
    console.error(`  Modules: ${modules}`);
    console.error(`  Claude Desktop remote connector:`);
    console.error(
      JSON.stringify(
        {
          mcpServers: {
            "sirrus-leads": {
              url,
            },
          },
        },
        null,
        2,
      ),
      );
    })();
  });
}

async function serveStdio(): Promise<void> {
  const server = createLeadsMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Sirrus Leads MCP listening on stdio (no auth).");
}

const stdio = process.argv.includes("--stdio");
if (stdio) {
  void serveStdio();
} else {
  void serveRemote();
}
