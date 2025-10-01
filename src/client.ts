import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { confirm, input, select } from "@inquirer/prompts"
import { CreateMessageRequestSchema, Prompt, PromptMessage, Tool } from "@modelcontextprotocol/sdk/types";
import { ToolSet, generateText, tool as aiTool, jsonSchema } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";



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

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY!,
});

const main = async () => {
  console.log("starting client");
  await mcp.connect(transport);
  console.log("client connected");
  const [{ tools }, { resources }, { resourceTemplates }, { prompts }] =
    await Promise.all([
      mcp.listTools(),
      mcp.listResources(),
      mcp.listResourceTemplates(),
      mcp.listPrompts(),
    ])

    mcp.setRequestHandler(CreateMessageRequestSchema, async request => {
      const texts: string[] = []
      console.log(request, "request")
      for (const message of request.params.messages) {
        const text = await handleServerMessagePrompt(message)
        if (text != null) texts.push(text)
      }
  
      return {
        role: "user",
        model: "gemini-2.0-flash",
        stopReason: "endTurn",
        content: {
          type: "text",
          text: texts.join("\n"),
        },
      }
    })


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
        const avaiableResources = [
          ...resources.map((resource) => ({
            name: resource.name,
            value: resource.uri,
            description: resource.description,
          })),
          ...resourceTemplates.map((template) => ({
            name: template.name,
            value: template.uri,
            description: template.description,
          })),
        ];

        console.log(avaiableResources, "avaiableResources ====");

        const resourceUri = await select({
          message: "Select a resource",
          choices: avaiableResources
        })
        const uri = resources.find(r => r.uri === resourceUri)?.uri ?? resourceTemplates.find(r => r.uriTemplate === resourceUri)?.uriTemplate;
        console.log(uri, "uri");

        if (uri == null) {
          console.error("Resource not found.")
        } else {
          await handleResource(uri);
        }
        break;
      case "Prompts":
        const promptName = await select({
          message: "Select a prompt",
          choices: prompts.map(prompt => ({
            name: prompt.name,
            value: prompt.name,
            description: prompt.description,
          })),
        })
        const prompt = prompts.find(p => p.name === promptName)
        if (prompt == null) {
          console.error("Prompt not found.")
        } else {
          await handlePrompt(prompt)
        }
        break
      case "Query":
        await handleQuery(tools)
        break
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

async function handlePrompt(prompt: Prompt) {
  const args: Record<string, string> = {}
  for (const arg of prompt.arguments ?? []) {
    args[arg.name] = await input({
      message: `Enter value for ${arg.name}:`,
    })
  }

  const response = await mcp.getPrompt({
    name: prompt.name,
    arguments: args,
  })
  for (const message of response.messages) {
    console.log(await handleServerMessagePrompt(message))
  }
}

async function handleServerMessagePrompt(message: PromptMessage) {
  if (message.content.type !== "text") return;

  console.log("Message from prompt:", message.content.text);

  const run = await confirm({
    message: "Do you want to run this?",
    default: true
  });

  if (!run) return;

  const { text } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt: message.content.text,
  })
  return text;
}

async function handleQuery(tools: Tool[]) {
  const query = await input({
    message: "Enter your query:",
  });

  const { text, toolResults } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt: query,
    tools: {
      create_user: {
        description: "Create a user",
        inputSchema: jsonSchema(tools[0].inputSchema),
        execute: async (args: any) => {
          const res = await mcp.callTool({
            name: tools[0].name,
            arguments: args,
          })
          console.log(res, "create user")
          return res;

        },
      },
      create_random_user: {
        description: "Create a random user",
        inputSchema: jsonSchema(tools[1].inputSchema),
        execute: async (args: any) => {
          const res = await mcp.callTool({
            name: tools[1].name,
            arguments: args,
          })
          console.log(res, "create random user")
          return res;
        },
      },
    },
  })
  console.log(text || (toolResults[0] as any)?.result?.content[0]?.text || "No text generated.");
  console.log(text, "text");
}

main();