/**
 * Example Linear API script for updating issues.
 *
 * Setup:
 * 1. Copy this file to update-linear.js
 * 2. Create .linear-api-key in project root with:
 *    LINEAR_API_KEY=your_actual_key_here
 * 3. Run: node scripts/update-linear.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load from .linear-api-key file (recommended - gitignored)
let apiKey = null;
const configPath = path.join(__dirname, '..', '.linear-api-key');

if (fs.existsSync(configPath)) {
  const config = fs.readFileSync(configPath, 'utf8');
  const lines = config.split('\n');
  for (const line of lines) {
    if (line.includes('=') && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key.trim() === 'LINEAR_API_KEY') {
        apiKey = value.trim();
        break;
      }
    }
  }
}

// Fallback to environment variable
if (!apiKey) {
  apiKey = process.env.LINEAR_API_KEY;
}

if (!apiKey || apiKey === 'YOUR_LINEAR_API_KEY_HERE') {
  console.error('ERROR: LINEAR_API_KEY not configured!');
  console.error('Please create .linear-api-key file or set LINEAR_API_KEY environment variable');
  process.exit(1);
}

function makeRequest(query, variables) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });

    const options = {
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function updateLinear() {
  try {
    // Search for Phase 5 Week 1 tasks
    const searchQuery = `
      query SearchIssues {
        issues(filter: {
          or: [
            { title: { contains: "Phase 5" } }
            { title: { contains: "Week 1" } }
            { title: { contains: "Risk" } }
            { title: { contains: "Security" } }
            { title: { contains: "E2E" } }
            { title: { contains: "Coverage" } }
          ]
        }) {
          nodes {
            id
            title
            identifier
            state { name id }
            description
          }
        }
      }
    `;

    console.log('🔍 Searching for Phase 5 Week 1 tasks...');
    const searchResult = await makeRequest(searchQuery);

    if (searchResult.errors) {
      console.log('❌ GraphQL errors:', JSON.stringify(searchResult.errors, null, 2));
      return;
    }

    if (searchResult.data?.issues?.nodes?.length > 0) {
      console.log(`✅ Found ${searchResult.data.issues.nodes.length} issue(s):\n`);

      for (const issue of searchResult.data.issues.nodes) {
        console.log(`  ${issue.identifier}: ${issue.title}`);
        console.log(`     State: ${issue.state.name}`);
      }

      // Identify which tasks should be marked Done
      const completedTasks = ['Risk Assessor', 'Risk Assessment', 'E2E Test', 'Security Test'];

      // Get Done state ID
      const statesQuery = `
        query GetStates {
          workflowStates(filter: { name: { eq: "Done" } }) {
            nodes {
              id
              name
            }
          }
        }
      `;

      const statesResult = await makeRequest(statesQuery);

      if (statesResult.errors) {
        console.log('❌ GraphQL errors:', JSON.stringify(statesResult.errors, null, 2));
        return;
      }

      const doneState = statesResult.data?.workflowStates?.nodes[0];

      if (doneState) {
        console.log(`\n✅ Found Done state: ${doneState.name} (${doneState.id})\n`);

        // Update completed tasks
        for (const issue of searchResult.data.issues.nodes) {
          const shouldComplete = completedTasks.some((task) =>
            issue.title.toLowerCase().includes(task.toLowerCase())
          );

          if (shouldComplete && issue.state.name !== 'Done') {
            console.log(`🔄 Updating ${issue.identifier} to Done...`);

            const updateQuery = `
              mutation UpdateIssue($issueId: String!, $stateId: String!) {
                issueUpdate(id: $issueId, input: { stateId: $stateId }) {
                  success
                  issue {
                    id
                    title
                    state { name }
                  }
                }
              }
            `;

            const updateResult = await makeRequest(updateQuery, {
              issueId: issue.id,
              stateId: doneState.id,
            });

            if (updateResult.errors) {
              console.log(
                `❌ Failed to update ${issue.identifier}:`,
                JSON.stringify(updateResult.errors, null, 2)
              );
            } else if (updateResult.data?.issueUpdate?.success) {
              console.log(`✅ Updated ${issue.identifier} to Done`);
            }
          } else if (issue.state.name === 'Done') {
            console.log(`✓  ${issue.identifier} already Done`);
          }
        }
      } else {
        console.log('❌ Done state not found');
      }
    } else {
      console.log('❌ No Phase 5 Week 1 issues found');
      console.log('Search result:', JSON.stringify(searchResult, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

updateLinear();
