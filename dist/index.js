"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const fs_1 = __importDefault(require("fs"));
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const google_1 = require("@ai-sdk/google");
// Create an MCP server
const server = new mcp_js_1.McpServer({
    name: "demo-server",
    version: "1.0.0"
});
const UserSchema = zod_1.z.object({
    name: zod_1.z.string(),
    email: zod_1.z.string().email()
});
const google = (0, google_1.createGoogleGenerativeAI)({
    apiKey: process.env.GOOGLE_API_KEY,
});
server.registerTool("create_user", {
    title: "Create User Tool",
    description: "Add new User",
    inputSchema: { name: zod_1.z.string(), email: zod_1.z.string().email() }
}, async (user) => {
    const id = await createUser({
        name: user.name,
        email: user.email
    });
    return {
        content: [{ type: "text", text: `User ${id} created with email` }]
    };
});
server.tool("create_random_user", "Create Random User", {
    title: "Create Random User Tool",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
}, async () => {
    const res = await server.server.request({
        method: "sampling/createMessage",
        params: {
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: "Generate fake user data. The user should have a realistic Burmese name, email, address, and phone number. Return this data as a JSON object with no other text or formatter so it can be used with JSON.parse.",
                    },
                },
            ],
            maxTokens: 1024,
        },
    }, types_js_1.CreateMessageResultSchema);
    console.log("Response from model:", res);
    if (res.content.type !== "text") {
        throw new Error("Invalid response from model");
    }
    try {
        const parsed = JSON.parse(res.content.text.trim().replace(/^```json/, '').replace(/```$/, '').trim());
        const id = await createUser(parsed);
        console.log("Created user with id:", id);
        return {
            content: [{ type: "text", text: `User ${id} created with email` }]
        };
    }
    catch (e) {
        return {
            content: [{ type: "text", text: `Error creating user: ${e}, ${JSON.stringify(res)}` }]
        };
    }
    // const id = await createUser(JSON.parse(res.content.text));
});
server.resource("User", 'users://all', {
    description: "A list of all users",
    title: "User List",
    mimetype: "application/json",
}, async (uri, params) => {
    const users = await getUsers();
    return {
        contents: [
            {
                uri: uri.href,
                mimetype: "application/json",
                text: JSON.stringify(users, null, 2)
            }
        ]
    };
});
// server.resource
server.prompt("generate-fake-user", "Generate a fake user", {
    name: zod_1.z.string(),
}, ({ name }) => {
    return {
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `Generate fake user data for ${name}. The user name is ${name}. The user should have a realistic email, address, and phone number. Return this data as a JSON object with no other text or formatter so it can be used with JSON.parse.`,
                },
            }
        ]
    };
});
const getUsers = async () => {
    const users = await fs_1.default.readFileSync("./dummy-db/user.json", "utf-8");
    return JSON.parse(users);
};
const createUser = async (user) => {
    const users = await fs_1.default.readFileSync("./dummy-db/user.json", "utf-8");
    const parsedUsers = JSON.parse(users);
    console.log(parsedUsers);
    const userList = parsedUsers;
    const id = (userList.length + 1).toString().padStart(3, '0');
    const newUser = { id, ...user };
    userList.push(newUser);
    fs_1.default.writeFileSync("./dummy-db/user.json", JSON.stringify(userList, null, 2));
    return id;
};
// Start receiving messages on stdin and sending messages on stdout
const transport = new stdio_js_1.StdioServerTransport();
const main = async () => {
    console.log("starting server");
    await server.connect(transport);
    console.log("transport connected");
    ~console.log("server connected");
};
main();
//# sourceMappingURL=index.js.map