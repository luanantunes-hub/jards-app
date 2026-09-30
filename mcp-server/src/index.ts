import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { tools, callTool } from "./tools.js";

const server = new McpServer({
  name: "jards",
  version: "0.1.0",
});

for (const tool of tools) {
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: tool.schema },
    async (args) => callTool(tool.name, args as Record<string, unknown>)
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Jards MCP server rodando (stdio).");
}

main().catch((err) => {
  console.error("Falha ao iniciar o Jards MCP server:", err);
  process.exit(1);
});
