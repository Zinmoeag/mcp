"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const prompts_1 = require("@inquirer/prompts");
const ai_1 = require("ai");
const google_1 = require("@ai-sdk/google");
const mcp = new index_js_1.Client({
    name: "demo-client",
    version: "1.0.0"
}, {
    capabilities: {
        sampling: {}
    }
});
const transport = new stdio_js_1.StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    stderr: "ignore",
});
const google = (0, google_1.createGoogleGenerativeAI)({
    apiKey: process.env.GOOGLE_API_KEY,
});
const main = async () => {
    console.log("starting client");
    await mcp.connect(transport);
    console.log("client connected");
    const [{ tools }, { resources }, { resourceTemplates }, { prompts }] = await Promise.all([
        mcp.listTools(),
        mcp.listResources(),
        mcp.listResourceTemplates(),
        mcp.listPrompts(),
    ]);
    while (true) {
        const option = await (0, prompts_1.select)({
            message: "What do you want to do?",
            choices: ["Query", "Tools", "Resources", "Prompts"]
        });
        switch (option) {
            case "Tools":
                const toolName = await (0, prompts_1.select)({
                    message: "Select a tool",
                    choices: tools.map((tool) => ({
                        name: tool.annotations?.title || tool.name,
                        value: tool.name,
                        description: tool.description,
                    })),
                });
                const tool = tools.find(t => t.name === toolName);
                if (tool == null) {
                    console.error("Tool not found.");
                }
                else {
                    await handleTool(tool);
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
                const resourceUri = await (0, prompts_1.select)({
                    message: "Select a resource",
                    choices: avaiableResources
                });
                const uri = resources.find(r => r.uri === resourceUri)?.uri ?? resourceTemplates.find(r => r.uriTemplate === resourceUri)?.uriTemplate;
                console.log(uri, "uri");
                if (uri == null) {
                    console.error("Resource not found.");
                }
                else {
                    await handleResource(uri);
                }
                break;
            case "Prompts":
                const promptName = await (0, prompts_1.select)({
                    message: "Select a prompt",
                    choices: prompts.map(prompt => ({
                        name: prompt.name,
                        value: prompt.name,
                        description: prompt.description,
                    })),
                });
                const prompt = prompts.find(p => p.name === promptName);
                if (prompt == null) {
                    console.error("Prompt not found.");
                }
                else {
                    await handlePrompt(prompt);
                }
                break;
        }
    }
};
async function handleTool(tool) {
    const args = {};
    for (const [key, value] of Object.entries(tool.inputSchema.properties ?? {})) {
        args[key] = await (0, prompts_1.input)({
            message: `Enter value for ${key} (${value.type}):`,
        });
    }
    const res = await mcp.callTool({
        name: tool.name,
        arguments: args,
    });
    console.log(res.content[0].text);
}
async function handleResource(uri) {
    let finalUri = uri;
    const paramMatches = uri.match(/{([^}]+)}/g);
    if (paramMatches != null) {
        for (const paramMatch of paramMatches) {
            const paramName = paramMatch.replace("{", "").replace("}", "");
            const paramValue = await (0, prompts_1.input)({
                message: `Enter value for ${paramName}:`,
            });
            finalUri = finalUri.replace(paramMatch, paramValue);
        }
    }
    const res = await mcp.readResource({
        uri: finalUri
    });
    console.log(JSON.stringify(JSON.parse(res.contents[0].text), null, 2));
}
async function handlePrompt(prompt) {
    const args = {};
    for (const arg of prompt.arguments ?? []) {
        args[arg.name] = await (0, prompts_1.input)({
            message: `Enter value for ${arg.name}:`,
        });
    }
    const response = await mcp.getPrompt({
        name: prompt.name,
        arguments: args,
    });
    for (const message of response.messages) {
        console.log(await handleServerMessagePrompt(message));
    }
}
async function handleServerMessagePrompt(message) {
    if (message.content.type !== "text")
        return;
    console.log("Message from prompt:", message.content.text);
    const run = await (0, prompts_1.confirm)({
        message: "Do you want to run this?",
        default: true
    });
    if (!run)
        return;
    const { text } = await (0, ai_1.generateText)({
        model: google("gemini-2.0-flash"),
        prompt: message.content.text,
    });
    return text;
}
main();
//# sourceMappingURL=client.js.map