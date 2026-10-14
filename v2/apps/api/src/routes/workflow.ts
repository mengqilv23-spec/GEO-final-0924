import type { FastifyInstance } from "fastify";
import {
  briefKnowledgeItems,
  briefs,
  contentVersions,
  knowledgeItems,
  projectMembers,
  projects,
  reviewRecords,
  strategies,
  strategyEvents,
  taskEvents,
  tasks,
  websiteReturns
} from "@geo/db";
import {
  transitionStrategy,
  transitionTask,
  type ActorRole,
  type ServiceMode,
  type Strategy,
  type StrategyEvent,
  type StrategyStatus,
  type StrategyType,
  type Task,
  type TaskEvent,
  type TaskStatus,
  type TaskType
} from "@geo/domain";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getActor, type ActorContext } from "../context.js";
import { db } from "../db.js";

const idSchema = z.object({ strategyId: z.string().uuid() });
const projectIdSchema = z.object({ projectId: z.string().uuid() });
const taskIdSchema = z.object({ taskId: z.string().uuid() });
const strategyActionSchema = z.object({
  event: z.enum(["ops_confirmed", "client_confirmed", "ignore"]),
  comment: z.string().max(2000).optional(),
  idempotencyKey: z.string().min(8).max(120)
});
const taskActionSchema = z.object({
  event: z.enum([
    "website_started",
    "website_succeeded",
    "website_failed",
    "brief_confirmed",
    "content_generated",
    "ops_content_approved",
    "client_final_confirmed",
    "website_approved",
    "website_rejected",
    "ignore"
  ]),
  comment: z.string().max(5000).optional(),
  idempotencyKey: z.string().min(8).max(120),
  handledByType: z.enum(["person", "system"]).optional(),
  handledByName: z.string().max(200).optional(),
  attempt: z.number().int().positive().optional()
});
const briefSchema = z.object({
  goal: z.string().max(5000).default(""),
  audience: z.string().max(1000).default(""),
  buyerStage: z.enum(["需求评估", "方案寻找"]),
  outputType: z.string().max(1000).default(""),
  instruction: z.string().max(10000).default(""),
  useWebSearch: z.boolean().default(false),
  knowledgeItemIds: z.array(z.string().uuid()).default([])
});
const contentSchema = z.object({
  body: z.string().min(1),
  source: z.enum(["knowledge_base", "manual", "web"]),
  changeSummary: z.string().max(1000).optional(),
  idempotencyKey: z.string().min(8).max(120)
});

async function assertProjectAccess(
  projectId: string,
  actor: ActorContext
): Promise<void> {
  if (actor.role === "website") return;
  if (!actor.userId) throw new Error("Authenticated user is required");

  const [member] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, actor.userId),
        eq(projectMembers.role, actor.role)
      )
    )
    .limit(1);

  if (!member) throw new Error("Actor does not belong to this project");
}

function asStrategy(
  row: typeof strategies.$inferSelect,
  serviceMode: ServiceMode
): Strategy {
  return {
    id: row.id,
    type: row.type as StrategyType,
    serviceMode,
    status: row.status as StrategyStatus,
    assigneeRole: row.assigneeRole as ActorRole
  };
}

function asTask(
  row: typeof tasks.$inferSelect,
  serviceMode: ServiceMode
): Task {
  return {
    id: row.id,
    sequence: row.sequence,
    sourceRef: row.sourceRef,
    title: row.title,
    type: row.type as TaskType,
    serviceMode,
    status: row.status as TaskStatus,
    assigneeRole: row.assigneeRole as ActorRole
  };
}

function reviewDecision(event: TaskEvent) {
  if (event === "ignore") return "ignored" as const;
  if (event === "website_rejected" || event === "website_failed") return "rejected" as const;
  if (
    event === "brief_confirmed" ||
    event === "ops_content_approved" ||
    event === "client_final_confirmed" ||
    event === "website_approved" ||
    event === "website_succeeded"
  ) return "approved" as const;
  return "submitted" as const;
}

export async function workflowRoutes(app: FastifyInstance) {
  app.get("/api/v2/projects/:projectId/strategies", async request => {
    const { projectId } = projectIdSchema.parse(request.params);
    const actor = getActor(request);

    await assertProjectAccess(projectId, actor);

    return db
      .select({
        id: strategies.id,
        sequence: strategies.sequence,
        type: strategies.type,
        title: strategies.title,
        description: strategies.description,
        status: strategies.status,
        assigneeRole: strategies.assigneeRole,
        ignoredReason: strategies.ignoredReason,
        updatedAt: strategies.updatedAt
      })
      .from(strategies)
      .where(eq(strategies.projectId, projectId))
      .orderBy(asc(strategies.sequence));
  });

  app.get("/api/v2/projects/:projectId/tasks", async request => {
    const { projectId } = projectIdSchema.parse(request.params);
    const actor = getActor(request);

    await assertProjectAccess(projectId, actor);

    return db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.sequence));
  });

  app.get("/api/v2/tasks/:taskId/brief", async request => {
    const { taskId } = taskIdSchema.parse(request.params);
    const actor = getActor(request);

    const [task] = await db.select().from(tasks)
      .where(eq(tasks.id, taskId)).limit(1);
    if (!task) throw new Error("Task not found");
    await assertProjectAccess(task.projectId, actor);

    const [brief] = await db.select().from(briefs)
      .where(eq(briefs.taskId, taskId)).limit(1);

    const selectedKnowledgeItems = brief
      ? await db
          .select({ id: briefKnowledgeItems.knowledgeItemId })
          .from(briefKnowledgeItems)
          .where(eq(briefKnowledgeItems.briefId, brief.id))
      : [];

    const availableKnowledgeItems = await db
      .select()
      .from(knowledgeItems)
      .where(eq(knowledgeItems.projectId, task.projectId))
      .orderBy(desc(knowledgeItems.updatedAt));

    return {
      brief: brief ?? null,
      knowledgeItemIds: selectedKnowledgeItems.map(item => item.id),
      availableKnowledgeItems
    };
  });

  app.post("/api/v2/strategies/:strategyId/actions", async request => {
    const { strategyId } = idSchema.parse(request.params);
    const body = strategyActionSchema.parse(request.body);
    const actor = getActor(request);

    if (body.event === "ignore" && !body.comment?.trim()) {
      throw new Error("Ignore requires a reason");
    }

    return db.transaction(async tx => {
      const [existing] = await tx
        .select({ id: strategyEvents.id })
        .from(strategyEvents)
        .where(eq(strategyEvents.idempotencyKey, body.idempotencyKey))
        .limit(1);

      const [record] = await tx
        .select({ strategy: strategies, serviceMode: projects.serviceMode })
        .from(strategies)
        .innerJoin(projects, eq(strategies.projectId, projects.id))
        .where(eq(strategies.id, strategyId))
        .limit(1);

      if (!record) throw new Error("Strategy not found");
      await assertProjectAccess(record.strategy.projectId, actor);
      if (existing) return { strategy: record.strategy, idempotent: true };

      const current = asStrategy(record.strategy, record.serviceMode as ServiceMode);
      const next = transitionStrategy(current, body.event as StrategyEvent, actor.role);

      const [updated] = await tx
        .update(strategies)
        .set({
          status: next.status,
          assigneeRole: next.assigneeRole,
          confirmedByUserId: body.event === "ignore" ? null : actor.userId,
          confirmedAt: body.event === "ignore" ? null : new Date(),
          ignoredByUserId: body.event === "ignore" ? actor.userId : null,
          ignoredReason: body.event === "ignore" ? body.comment ?? null : null,
          ignoredAt: body.event === "ignore" ? new Date() : null,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(strategies.id, strategyId),
            eq(strategies.status, record.strategy.status)
          )
        )
        .returning();

      if (!updated) throw new Error("Strategy changed; refresh and retry");

      await tx.insert(strategyEvents).values({
        strategyId,
        actorUserId: actor.userId,
        actorRole: actor.role,
        event: body.event,
        fromStatus: record.strategy.status,
        toStatus: next.status,
        comment: body.comment,
        idempotencyKey: body.idempotencyKey
      });

      return { strategy: updated, idempotent: false };
    });
  });

  app.put("/api/v2/tasks/:taskId/brief", async request => {
    const { taskId } = taskIdSchema.parse(request.params);
    const body = briefSchema.parse(request.body);
    const actor = getActor(request);

    const [record] = await db
      .select({ task: tasks })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!record) throw new Error("Task not found");
    await assertProjectAccess(record.task.projectId, actor);

    if (record.task.assigneeRole !== actor.role) {
      throw new Error("Only the current assignee can edit this Brief");
    }
    if (!["pending_ops_brief", "pending_client_brief"].includes(record.task.status)) {
      throw new Error("Brief is not editable in the current state");
    }

    if (body.knowledgeItemIds.length > 0) {
      const available = await db
        .select({ id: knowledgeItems.id })
        .from(knowledgeItems)
        .where(
          and(
            eq(knowledgeItems.projectId, record.task.projectId),
            eq(knowledgeItems.status, "available"),
            inArray(knowledgeItems.id, body.knowledgeItemIds)
          )
        );

      if (available.length !== new Set(body.knowledgeItemIds).size) {
        throw new Error("One or more knowledge items are unavailable");
      }
    }

    return db.transaction(async tx => {
      const [saved] = await tx
        .insert(briefs)
        .values({
          taskId,
          goal: body.goal,
          audience: body.audience,
          buyerStage: body.buyerStage,
          outputType: body.outputType,
          instruction: body.instruction,
          useWebSearch: body.useWebSearch,
          savedByUserId: actor.userId
        })
        .onConflictDoUpdate({
          target: briefs.taskId,
          set: {
            goal: body.goal,
            audience: body.audience,
            buyerStage: body.buyerStage,
            outputType: body.outputType,
            instruction: body.instruction,
            useWebSearch: body.useWebSearch,
            savedByUserId: actor.userId,
            version: sql`${briefs.version} + 1`,
            updatedAt: new Date()
          }
        })
        .returning();

      await tx.delete(briefKnowledgeItems)
        .where(eq(briefKnowledgeItems.briefId, saved.id));

      if (body.knowledgeItemIds.length > 0) {
        await tx.insert(briefKnowledgeItems).values(
          body.knowledgeItemIds.map(knowledgeItemId => ({
            briefId: saved.id,
            knowledgeItemId,
            selectedByUserId: actor.userId
          }))
        );
      }

      return { brief: saved, knowledgeItemIds: body.knowledgeItemIds };
    });
  });

  app.put("/api/v2/tasks/:taskId/content", async request => {
    const { taskId } = taskIdSchema.parse(request.params);
    const body = contentSchema.parse(request.body);
    const actor = getActor(request);

    return db.transaction(async tx => {
      const [duplicate] = await tx
        .select({ id: taskEvents.id })
        .from(taskEvents)
        .where(eq(taskEvents.idempotencyKey, body.idempotencyKey))
        .limit(1);

      const [task] = await tx.select().from(tasks)
        .where(eq(tasks.id, taskId)).limit(1);
      if (!task) throw new Error("Task not found");
      await assertProjectAccess(task.projectId, actor);
      if (duplicate) return { idempotent: true };

      const editableStates = [
        "pending_ops_content_review",
        "pending_client_content_review",
        "pending_client_final_confirmation",
        "returned_to_ops",
        "returned_to_client"
      ];
      if (task.assigneeRole !== actor.role || !editableStates.includes(task.status)) {
        throw new Error("Content is not editable by this actor in the current state");
      }

      const [latest] = await tx
        .select({ version: contentVersions.version })
        .from(contentVersions)
        .where(eq(contentVersions.taskId, taskId))
        .orderBy(desc(contentVersions.version))
        .limit(1);

      const [version] = await tx.insert(contentVersions).values({
        taskId,
        version: (latest?.version ?? 0) + 1,
        body: body.body,
        source: body.source,
        savedByUserId: actor.userId,
        savedByRole: actor.role,
        changeSummary: body.changeSummary
      }).returning();

      await tx.insert(taskEvents).values({
        taskId,
        actorUserId: actor.userId,
        actorRole: actor.role,
        event: "content_saved",
        fromStatus: task.status,
        toStatus: task.status,
        payload: { contentVersionId: version.id },
        idempotencyKey: body.idempotencyKey
      });

      await tx.insert(reviewRecords).values({
        taskId,
        contentVersionId: version.id,
        actorUserId: actor.userId,
        actorRole: actor.role,
        decision: "saved",
        fromStatus: task.status,
        toStatus: task.status,
        comment: body.changeSummary
      });

      return { contentVersion: version, idempotent: false };
    });
  });

  app.post("/api/v2/tasks/:taskId/actions", async request => {
    const { taskId } = taskIdSchema.parse(request.params);
    const body = taskActionSchema.parse(request.body);
    const actor = getActor(request);

    if (body.event === "ignore" && !body.comment?.trim()) {
      throw new Error("Ignore requires a reason");
    }
    if (body.event === "website_rejected" && !body.comment?.trim()) {
      throw new Error("Website rejection requires a modification comment");
    }

    const websiteEvents = [
      "website_started",
      "website_succeeded",
      "website_failed",
      "website_approved",
      "website_rejected"
    ];
    if (websiteEvents.includes(body.event) && !body.attempt) {
      throw new Error("Website events require a submission attempt number");
    }

    return db.transaction(async tx => {
      const [duplicate] = await tx
        .select({ id: taskEvents.id })
        .from(taskEvents)
        .where(eq(taskEvents.idempotencyKey, body.idempotencyKey))
        .limit(1);

      const [record] = await tx
        .select({ task: tasks, serviceMode: projects.serviceMode })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(eq(tasks.id, taskId))
        .limit(1);

      if (!record) throw new Error("Task not found");
      await assertProjectAccess(record.task.projectId, actor);
      if (duplicate) return { task: record.task, idempotent: true };

      const current = asTask(record.task, record.serviceMode as ServiceMode);
      const next = transitionTask(current, body.event as TaskEvent, actor.role);

      const [updated] = await tx.update(tasks).set({
        status: next.status,
        assigneeRole: next.assigneeRole,
        latestWebsiteFeedback:
          body.event === "website_rejected" ? body.comment ?? null : record.task.latestWebsiteFeedback,
        completedAt: next.status === "completed" ? new Date() : null,
        updatedAt: new Date()
      }).where(
        and(eq(tasks.id, taskId), eq(tasks.status, record.task.status))
      ).returning();

      if (!updated) throw new Error("Task changed; refresh and retry");

      await tx.insert(taskEvents).values({
        taskId,
        actorUserId: actor.userId,
        actorRole: actor.role,
        event: body.event,
        fromStatus: record.task.status,
        toStatus: next.status,
        payload: body.comment ? { comment: body.comment } : undefined,
        idempotencyKey: body.idempotencyKey
      });

      await tx.insert(reviewRecords).values({
        taskId,
        actorUserId: actor.userId,
        actorRole: actor.role,
        decision: reviewDecision(body.event as TaskEvent),
        fromStatus: record.task.status,
        toStatus: next.status,
        comment: body.comment
      });

      if (websiteEvents.includes(body.event)) {
        const result =
          body.event === "website_started" ? "processing" :
          body.event === "website_succeeded" || body.event === "website_approved" ? "approved" :
          body.event === "website_rejected" ? "rejected" : "failed";

        await tx.insert(websiteReturns).values({
          taskId,
          attempt: body.attempt!,
          result,
          summary: body.comment ?? result,
          handledByType: body.handledByType ?? "system",
          handledByName: body.handledByName ?? "官网系统",
          rawPayload: body
        }).onConflictDoUpdate({
          target: [websiteReturns.taskId, websiteReturns.attempt],
          set: {
            result,
            summary: body.comment ?? result,
            handledByType: body.handledByType ?? "system",
            handledByName: body.handledByName ?? "官网系统",
            rawPayload: body,
            handledAt: new Date()
          }
        });
      }

      return { task: updated, idempotent: false };
    });
  });

  app.get("/api/v2/tasks/:taskId/history", async request => {
    const { taskId } = taskIdSchema.parse(request.params);
    const actor = getActor(request);

    const [task] = await db.select().from(tasks)
      .where(eq(tasks.id, taskId)).limit(1);
    if (!task) throw new Error("Task not found");
    await assertProjectAccess(task.projectId, actor);

    const [events, reviews, versions, returns] = await Promise.all([
      db.select().from(taskEvents)
        .where(eq(taskEvents.taskId, taskId))
        .orderBy(taskEvents.createdAt),
      db.select().from(reviewRecords)
        .where(eq(reviewRecords.taskId, taskId))
        .orderBy(reviewRecords.createdAt),
      db.select().from(contentVersions)
        .where(eq(contentVersions.taskId, taskId))
        .orderBy(desc(contentVersions.version)),
      db.select().from(websiteReturns)
        .where(eq(websiteReturns.taskId, taskId))
        .orderBy(websiteReturns.attempt)
    ]);

    return { events, reviews, versions, websiteReturns: returns };
  });
}
