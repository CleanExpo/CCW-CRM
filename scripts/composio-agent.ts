import { Composio } from "@composio/core";
import { Agent, run } from "@openai/agents";
import { OpenAIAgentsProvider } from "@composio/openai-agents";

// Initialize Composio with OpenAI Agents provider
const composio = new Composio({
  apiKey: "ak_Bgzgar_dPkuw7qmFWl_p",
  provider: new OpenAIAgentsProvider(),
});

const externalUserId = "pg-test-d0909a46-5eb8-4218-b41c-f1718e588b1f";

// Create a tool router session
const session = await composio.create(externalUserId);

// Get tools from the session (native)
const tools = await session.tools();

// Create agent with tools
const agent = new Agent({
  name: "Email Manager",
  model: "gpt-4o",
  instructions:
    "You are a helpful assistant. Use Composio tools to execute tasks.",
  tools: tools,
});

// Run the agent
console.log(`🔄 Running agent...`);
const result = await run(
  agent,
  "Send an email to unitegroup.in@gmail.com with the subject 'Hello from Composio' and the body 'This is a test email!'"
);

console.log(`✅ Received response from agent`);
if (result.finalOutput) {
  console.log(result.finalOutput);
}
