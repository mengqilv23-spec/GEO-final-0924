export type ServiceMode = "agent" | "managed";
export type ActorRole = "client" | "ops" | "agent" | "website";

export type StrategyType =
  | "website_content_strategy"
  | "gap_content_strategy";

export type StrategyStatus =
  | "pending_ops_confirmation"
  | "pending_client_confirmation"
  | "confirmed"
  | "ignored";

export type StrategyEvent =
  | "ops_confirmed"
  | "client_confirmed";

export interface Strategy {
  id: string;
  type: StrategyType;
  serviceMode: ServiceMode;
  status: StrategyStatus;
  assigneeRole: ActorRole;
}

export type TaskType =
  | "technical_repair"
  | "website_content"
  | "external_content";

export type TaskStatus =
  | "submitted_to_website"
  | "website_processing"
  | "website_returned_success"
  | "website_returned_failed"
  | "pending_ops_brief"
  | "pending_client_brief"
  | "content_generating"
  | "pending_ops_content_review"
  | "pending_client_content_review"
  | "pending_client_final_confirmation"
  | "pending_website_review"
  | "returned_to_ops"
  | "returned_to_client"
  | "completed"
  | "ignored";

export type TaskEvent =
  | "website_started"
  | "website_succeeded"
  | "website_failed"
  | "brief_confirmed"
  | "content_generated"
  | "content_saved"
  | "ops_content_approved"
  | "client_final_confirmed"
  | "website_approved"
  | "website_rejected"
  | "ignore";

export interface Task {
  id: string;
  sequence: number;
  sourceRef: string;
  title: string;
  type: TaskType;
  serviceMode: ServiceMode;
  status: TaskStatus;
  assigneeRole: ActorRole;
}

export interface Finding {
  id: string;
  sequence: number;
  taskType: TaskType;
  checkItem: string;
  description: string;
  priority: "P0" | "P1" | "P2";
}

export interface Brief {
  id: string;
  findingId: string;
  taskId: string;
  knowledgeIds: string[];
  instruction: string;
  confirmedBy?: ActorRole;
}

export interface ContentDocument {
  id: string;
  taskId: string;
  body: string;
  source: "knowledge_base" | "manual" | "web";
  editable: true;
  version: number;
  savedBy: ActorRole;
  savedAt: string;
}

export interface QualityResult {
  documentId: string;
  documentVersion: number;
  passed: number;
  total: number;
  issues: Array<{
    code: string;
    message: string;
    severity: "info" | "warning" | "error";
  }>;
}

export interface AuditRecord {
  taskId: string;
  actor: ActorRole;
  action: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  createdAt: string;
}

export interface WebsiteReturn {
  taskId: string;
  result: "approved" | "rejected";
  summary: string;
  handledAt: string;
}

export interface Transition<Event, Status> {
  event: Event;
  to: Status;
  actor: ActorRole;
  nextAssignee: ActorRole;
}

export function initialStrategyStatus(mode: ServiceMode): StrategyStatus {
  return mode === "managed"
    ? "pending_ops_confirmation"
    : "pending_client_confirmation";
}

export function availableStrategyTransitions(
  strategy: Strategy,
  actor: ActorRole
): Array<Transition<StrategyEvent, StrategyStatus>> {
  const transitions: Array<Transition<StrategyEvent, StrategyStatus>> = [];

  if (strategy.status === "pending_ops_confirmation" && strategy.serviceMode === "managed") {
    transitions.push(
      { event: "ops_confirmed", to: "pending_client_confirmation", actor: "ops", nextAssignee: "client" }
    );
  }

  if (strategy.status === "pending_client_confirmation") {
    transitions.push(
      { event: "client_confirmed", to: "confirmed", actor: "client", nextAssignee: "client" }
    );
  }

  return transitions.filter(item => item.actor === actor);
}

export function transitionStrategy(
  strategy: Strategy,
  event: StrategyEvent,
  actor: ActorRole
): Strategy {
  const next = availableStrategyTransitions(strategy, actor)
    .find(item => item.event === event);

  if (!next) {
    throw new Error(
      `Invalid strategy transition: ${strategy.status} + ${event} by ${actor}`
    );
  }

  return {
    ...strategy,
    status: next.to,
    assigneeRole: next.nextAssignee
  };
}

export function initialTaskStatus(
  mode: ServiceMode,
  type: TaskType
): TaskStatus {
  if (type === "technical_repair") return "submitted_to_website";
  return mode === "managed" ? "pending_ops_brief" : "pending_client_brief";
}

export function initialTaskAssignee(
  mode: ServiceMode,
  type: TaskType
): ActorRole {
  if (type === "technical_repair") return "website";
  return mode === "managed" ? "ops" : "client";
}

function transition(
  event: TaskEvent,
  to: TaskStatus,
  actor: ActorRole,
  nextAssignee: ActorRole
): Transition<TaskEvent, TaskStatus> {
  return { event, to, actor, nextAssignee };
}

export function allTaskTransitions(
  task: Task
): Array<Transition<TaskEvent, TaskStatus>> {
  const managed = task.serviceMode === "managed";
  const websiteContent = task.type === "website_content";

  if (task.type === "technical_repair") {
    if (task.status === "submitted_to_website") {
      return [
        transition("website_started", "website_processing", "website", "website"),
        transition("website_succeeded", "website_returned_success", "website", "website"),
        transition("website_failed", "website_returned_failed", "website", "website")
      ];
    }

    if (task.status === "website_processing") {
      return [
        transition("website_succeeded", "website_returned_success", "website", "website"),
        transition("website_failed", "website_returned_failed", "website", "website")
      ];
    }

    return [];
  }

  switch (task.status) {
    case "pending_ops_brief":
      return managed
        ? [
            transition("brief_confirmed", "content_generating", "ops", "agent"),
            transition("ignore", "ignored", "ops", "ops")
          ]
        : [];

    case "pending_client_brief":
      return !managed
        ? [
            transition("brief_confirmed", "content_generating", "client", "agent"),
            transition("ignore", "ignored", "client", "client")
          ]
        : [];

    case "content_generating":
      return [
        transition(
          "content_generated",
          managed ? "pending_ops_content_review" : "pending_client_content_review",
          "agent",
          managed ? "ops" : "client"
        )
      ];

    case "pending_ops_content_review":
      return managed
        ? [
            transition("content_saved", "pending_ops_content_review", "ops", "ops"),
            transition("ops_content_approved", "pending_client_final_confirmation", "ops", "client"),
            transition("ignore", "ignored", "ops", "ops")
          ]
        : [];

    case "pending_client_content_review":
      return !managed
        ? [
            transition("content_saved", "pending_client_content_review", "client", "client"),
            transition(
              "client_final_confirmed",
              websiteContent ? "pending_website_review" : "completed",
              "client",
              websiteContent ? "website" : "client"
            ),
            transition("ignore", "ignored", "client", "client")
          ]
        : [];

    case "pending_client_final_confirmation":
      return managed
        ? [
            transition("content_saved", "pending_client_final_confirmation", "client", "client"),
            transition(
              "client_final_confirmed",
              websiteContent ? "pending_website_review" : "completed",
              "client",
              websiteContent ? "website" : "client"
            ),
            transition("ignore", "ignored", "client", "client")
          ]
        : [];

    case "pending_website_review":
      return websiteContent
        ? [
            transition("website_approved", "completed", "website", "website"),
            transition(
              "website_rejected",
              managed ? "returned_to_ops" : "returned_to_client",
              "website",
              managed ? "ops" : "client"
            )
          ]
        : [];

    case "returned_to_ops":
      return managed && websiteContent
        ? [
            transition("content_saved", "returned_to_ops", "ops", "ops"),
            transition("ops_content_approved", "pending_client_final_confirmation", "ops", "client")
          ]
        : [];

    case "returned_to_client":
      return !managed && websiteContent
        ? [
            transition("content_saved", "returned_to_client", "client", "client"),
            transition("client_final_confirmed", "pending_website_review", "client", "website")
          ]
        : [];

    default:
      return [];
  }
}

export function availableTaskTransitions(
  task: Task,
  actor: ActorRole
): Array<Transition<TaskEvent, TaskStatus>> {
  return allTaskTransitions(task).filter(item => item.actor === actor);
}

export function transitionTask(
  task: Task,
  event: TaskEvent,
  actor: ActorRole
): Task {
  const next = availableTaskTransitions(task, actor)
    .find(item => item.event === event);

  if (!next) {
    throw new Error(
      `Invalid task transition: ${task.type}/${task.status} + ${event} by ${actor}`
    );
  }

  return {
    ...task,
    status: next.to,
    assigneeRole: next.nextAssignee
  };
}

const actionLabels: Partial<Record<TaskEvent, string>> = {
  brief_confirmed: "确认 Brief",
  content_saved: "保存修改",
  ops_content_approved: "提交客户确认",
  client_final_confirmed: "确认并提交",
  website_approved: "审核通过",
  website_rejected: "退回修改",
  ignore: "忽略"
};

export function primaryAction(task: Task, actor: ActorRole): string {
  if (task.type === "technical_repair") return "查看详情";
  if (task.status === "completed") {
    return task.type === "external_content" ? "复制内容" : "查看结果";
  }

  const action = availableTaskTransitions(task, actor)
    .find(item => item.event !== "content_saved");

  return action ? actionLabels[action.event] ?? "处理" : "查看详情";
}

export const strategyStatusLabels: Record<StrategyStatus, string> = {
  pending_ops_confirmation: "待运营确认策略",
  pending_client_confirmation: "待客户确认策略",
  confirmed: "策略已确认",
  ignored: "已忽略"
};

export const workflowLabels: Record<TaskStatus, string> = {
  submitted_to_website: "已提交官网",
  website_processing: "官网处理中",
  website_returned_success: "处理成功",
  website_returned_failed: "处理失败",
  pending_ops_brief: "待运营审核 Brief",
  pending_client_brief: "待客户审核 Brief",
  content_generating: "内容生成中",
  pending_ops_content_review: "待运营审核内容",
  pending_client_content_review: "待客户审核内容",
  pending_client_final_confirmation: "待客户确认最终稿",
  pending_website_review: "待官网审核",
  returned_to_ops: "官网退回 · 待运营修改",
  returned_to_client: "官网退回 · 待客户修改",
  completed: "已完成",
  ignored: "已忽略"
};
