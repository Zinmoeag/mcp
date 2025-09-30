import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import { confirm, input, select } from "@inquirer/prompts"
import { Tool } from "@modelcontextprotocol/sdk/types";


const mcp = new Client({
    name: "demo-client",
    version: "1.0.0"
}, {
    capabilities: {
        sampling: {}
    }
});

const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    stderr: "ignore",
})

const main = async () => {
    console.log("starting client");
    await mcp.connect(transport);
    console.log("client connected");
    const [{ tools }, { resources}] =
    await Promise.all([
      mcp.listTools(),
      mcp.listResources(),
    //   mcp.listPrompts(),
    //   mcp.listResourceTemplates(),
    ])


    while (true) {
        const option = await select({
            message: "What do you want to do?",
            choices: ["Query", "Tools", "Resources", "Prompts"]
        })

        switch (option) {
            case "Tools":
                const toolName = await select({
                message: "Select a tool",
                choices: tools.map((tool) => ({
                    name: tool.annotations?.title || tool.name,
                    value: tool.name,
                    description: tool.description,
                })),
                })
                const tool = tools.find(t => t.name === toolName)
                if (tool == null) {
                console.error("Tool not found.")
                } else {
                  await handleTool(tool)
                }
                break;
            case "Resources":
                const resourceUri = await select({
                    message: "Select a resource",
                    choices: [
                        ...resources.map((resource) => ({
                            name: resource.name,
                            value: resource.uri,
                            description: resource.description,
                        })),
                    ]
                })
                const uri = resources.find(r => r.uri === resourceUri)?.uri;
                console.log(uri, "uri");

                if (uri == null) {
                    console.error("Resource not found.")
                } else {
                    await handleResource(uri);
                }
        }
    }
}

async function handleTool(tool: Tool) {
  const args: Record<string, string> = {}
  for (const [key, value] of Object.entries(
    tool.inputSchema.properties ?? {}
  )) {
    args[key] = await input({
      message: `Enter value for ${key} (${(value as { type: string }).type}):`,
    })
  }

  const res = await mcp.callTool({
    name: tool.name,
    arguments: args,
  })

  console.log((res.content as [{ text: string }])[0].text)
}

async function handleResource(uri: string) {
  let finalUri = uri;
  const paramMatches = uri.match(/{([^}]+)}/g);

  if (paramMatches != null) {
    for (const paramMatch of paramMatches) {
      const paramName = paramMatch.replace("{", "").replace("}", "")
      const paramValue = await input({
        message: `Enter value for ${paramName}:`,
      })
      finalUri = finalUri.replace(paramMatch, paramValue)
    }
  }

  const res = await mcp.readResource({
    uri: finalUri
  })
  console.log(
    JSON.stringify(JSON.parse(res.contents[0].text as string), null, 2)
  )
}

main();