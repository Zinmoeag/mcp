"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const prompts_1 = require("@inquirer/prompts");
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
const main = async () => {
    console.log("starting client");
    await mcp.connect(transport);
    console.log("client connected");
    const [{ tools }, { resources }, { resourceTemplates }] = await Promise.all([
        mcp.listTools(),
        mcp.listResources(),
        mcp.listResourceTemplates(),
        //   mcp.listPrompts(),
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
main();
//# sourceMappingURL=client.js.map