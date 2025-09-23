"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const fs_1 = __importDefault(require("fs"));
// Create an MCP server
const server = new mcp_js_1.McpServer({
    name: "demo-server",
    version: "1.0.0"
});
const UserSchema = zod_1.z.object({
    name: zod_1.z.string(),
    email: zod_1.z.string().email()
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
    console.log("server connected");
};
main();
//# sourceMappingURL=index.js.map