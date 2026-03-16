import 'dotenv/config';
import { Composio } from '@composio/core';
import { Agent, run } from '@openai/agents';
import { OpenAIAgentsProvider } from '@composio/openai-agents';

// Validate required environment variables
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const COMPOSIO_EXTERNAL_USER_ID = process.env.COMPOSIO_EXTERNAL_USER_ID;

if (!COMPOSIO_API_KEY) {
  console.error('Missing COMPOSIO_API_KEY in environment variables.');
  console.error('Set it in your .env file or export it: export COMPOSIO_API_KEY=ak_...');
  process.exit(1);
}

if (!COMPOSIO_EXTERNAL_USER_ID) {
  console.error('Missing COMPOSIO_EXTERNAL_USER_ID in environment variables.');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in environment variables.');
  console.error('Set it in your .env file or export it: export OPENAI_API_KEY=sk-...');
  process.exit(1);
}

// Initialize Composio with OpenAI Agents provider
const composio = new Composio({
  apiKey: COMPOSIO_API_KEY,
  provider: new OpenAIAgentsProvider(),
});

// Create a tool router session
const session = await composio.create(COMPOSIO_EXTERNAL_USER_ID);

// Get tools from the session (native)
const tools = await session.tools();

// Create agent with tools
const agent = new Agent({
  name: 'Email Manager',
  model: 'gpt-4o',
  instructions: 'You are a helpful assistant. Use Composio tools to execute tasks.',
  tools: tools,
});

// Run the agent
const prompt =
  process.argv[2] ||
  "Send an email to unitegroup.in@gmail.com with the subject 'Hello from Composio' and the body 'This is a test email!'";

console.log(`Running agent with prompt: ${prompt}`);
const result = await run(agent, prompt);

console.log('Received response from agent');
if (result.finalOutput) {
  console.log(result.finalOutput);
}
