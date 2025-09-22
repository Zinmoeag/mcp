import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create an MCP server
const server = new McpServer({
  name: "demo-server",
  version: "1.0.0"
});

// Add an addition tool
server.registerTool("add",
  {
    title: "Addition Tool",
    description: "Add two numbers",
    inputSchema: { a: z.number(), b: z.number() }
  },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);

// Add a dynamic greeting resource
server.registerResource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  { 
    title: "Greeting Resource",      // Display name for UI
    description: "Dynamic greeting generator"
  },
  async (uri, { name }) => ({
    contents: [{
      uri: uri.href,
      text: `Hello, ${name}!`
    }]
  })
);

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email()
});

server.tool("create user", "Create a new user", {
    id: z.string(),
    name: z.string(),
    email: z.string().email()
  }, {
    title: "Create User",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  }, async (params) => {
    try {
        console.log("creating user");
        return {
            content: [{
                type: "text",
                text: "User created"
            }]
        }
    } catch (error) {
        console.error(error);
        return {
            content: [{
                type: "text",
                text: "Error creating user"
            }]
        }
    }
  });

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
const main = async () => {
  console.log("starting server");
  await server.connect(transport);
  console.log("transport connected");
  console.log("server connected");
}

main();