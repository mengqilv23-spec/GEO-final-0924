import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  initialStrategyStatus,
  initialTaskAssignee,
  initialTaskStatus,
  strategyStatusLabels,
  workflowLabels,
  type ServiceMode,
  type TaskType
} from "@geo/domain";

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true, service: "geo-v2-api" }));

  app.get("/api/v2/workflows", async () => {
    const types: TaskType[] = [
      "technical_repair",
      "website_content",
      "external_content"
    ];
    const modes: ServiceMode[] = ["agent", "managed"];

    return {
      modes: Object.fromEntries(
        modes.map(mode => [
          mode,
          {
            initialStrategyStatus: initialStrategyStatus(mode),
            tasks: Object.fromEntries(
              types.map(type => [
                type,
                {
                  initialStatus: initialTaskStatus(mode, type),
                  initialAssignee: initialTaskAssignee(mode, type)
                }
              ])
            )
          }
        ])
      ),
      strategyLabels: strategyStatusLabels,
      taskLabels: workflowLabels
    };
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: "0.0.0.0" });
}

start().catch(error => {
  console.error(error);
  process.exit(1);
});
