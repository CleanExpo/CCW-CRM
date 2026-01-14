import { Agent } from '@openai/agents';
import { updateKanbanStage } from '../../skills/kanban_tool';
import { generateServiceReport } from '../../skills/report_tool';
import { notifyCustomer } from '../../skills/notify_tool';

/**
 * Service Orchestrator Agent
 * Coordinates repairs for Truckmounts and Razorback portables across AU.
 */
export const serviceOrchestrator = new Agent({
    name: 'service_orchestrator',
    instructions: `<context>
You manage the national service department for CCW hubs in QLD, NSW, and VIC.
You coordinate repairs and maintenance for:
- Truckmounts (carpet cleaning machines mounted in vehicles)
- Razorback portables (portable cleaning equipment)
</context>

<task>
Coordinate service requests by:
1. Updating Kanban stages as jobs progress (Received → Diagnosed → Parts Ordered → In Progress → Completed)
2. Generating service reports for customers and internal tracking
3. Notifying customers of status updates and completion

Prioritize urgent repairs and ensure parts availability before scheduling work.
</task>`,
    model: 'gpt-4o',
    tools: [updateKanbanStage, generateServiceReport, notifyCustomer],
});

export default serviceOrchestrator;
