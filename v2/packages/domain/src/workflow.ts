export type ServiceMode = "agent" | "managed";
export type ActorRole = "client" | "ops" | "agent" | "website";

export type TaskType =
  | "technical_repair"
  | "website_content"
  | "external_content";

export type TaskStatus =
  | "submitted_to_website"
  | "website_processing"
  | "website_returned_success"
  | "website_returned_failed"
  | "brief_pending"
  | "content_generating"
  | "article_review"
  | "final_confirmation"
  | "website_verification"
  | "completed"
  | "ignored";

export type TaskEvent =
  | "website_started"
  | "website_succeeded"
  | "website_failed"
  | "brief_confirmed"
  | "content_generated"
  | "article_approved"
  | "final_confirmed"
  | "website_verified"
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
}

export interface QualityResult {
  documentId: string;
  passed: number;
  total: number;
  issues: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }>;
}

export interface AuditRecord {
  taskId: string;
  actor: ActorRole;
  action: string;
  createdAt: string;
}

export interface WebsiteReturn {
  taskId: string;
  success: boolean;
  summary: string;
  handledAt: string;
}

type Transition = {
  event: TaskEvent;
  to: TaskStatus;
  actors: ActorRole[];
};

const transitions: Record<TaskType, Partial<Record<TaskStatus, Transition[]>>> = {
  technical_repair: {
    submitted_to_website: [
      { event: "website_started", to: "website_processing", actors: ["website"] },
      { event: "website_succeeded", to: "website_returned_success", actors: ["website"] },
      { event: "website_failed", to: "website_returned_failed", actors: ["website"] },
      { event: "ignore", to: "ignored", actors: ["client", "ops"] }
    ],
    website_processing: [
      { event: "website_succeeded", to: "website_returned_success", actors: ["website"] },
      { event: "website_failed", to: "website_returned_failed", actors: ["website"] }
    ]
  },
  website_content: {
    brief_pending: [
      { event: "brief_confirmed", to: "content_generating", actors: ["client", "ops"] },
      { event: "ignore", to: "ignored", actors: ["client", "ops"] }
    ],
    content_generating: [
      { event: "content_generated", to: "article_review", actors: ["agent"] }
    ],
    article_review: [
      { event: "article_approved", to: "final_confirmation", actors: ["client", "ops"] }
    ],
    final_confirmation: [
      { event: "final_confirmed", to: "website_verification", actors: ["client", "ops"] }
    ],
    website_verification: [
      { event: "website_verified", to: "completed", actors: ["website"] }
    ]
  },
  external_content: {
    brief_pending: [
      { event: "brief_confirmed", to: "content_generating", actors: ["client", "ops"] },
      { event: "ignore", to: "ignored", actors: ["client", "ops"] }
    ],
    content_generating: [
      { event: "content_generated", to: "article_review", actors: ["agent"] }
    ],
    article_review: [
      { event: "article_approved", to: "final_confirmation", actors: ["client", "ops"] }
    ],
    final_confirmation: [
      { event: "final_confirmed", to: "completed", actors: ["client", "ops"] }
    ]
  }
};

export function initialTaskStatus(type: TaskType): TaskStatus {
  return type === "technical_repair" ? "submitted_to_website" : "brief_pending";
}

export function reviewerFor(mode: ServiceMode, type: TaskType): ActorRole {
  if (type === "technical_repair") return "website";
  return mode === "managed" ? "ops" : "client";
}

export function availableTransitions(task: Task, actor: ActorRole): Transition[] {
  return (transitions[task.type][task.status] ?? []).filter(item =>
    item.actors.includes(actor)
  );
}

export function transitionTask(task: Task, event: TaskEvent, actor: ActorRole): Task {
  const next = availableTransitions(task, actor).find(item => item.event === event);
  if (!next) {
    throw new Error(`Invalid transition: ${task.type}/${task.status} + ${event} by ${actor}`);
  }
  return { ...task, status: next.to };
}

export function primaryAction(task: Task, actor: ActorRole): string {
  if (task.type === "technical_repair") return "查看详情";
  if (task.status === "completed") return task.type === "external_content" ? "复制内容" : "查看结果";
  return availableTransitions(task, actor).length > 0 ? "审核" : "查看详情";
}

export const workflowLabels: Record<TaskStatus, string> = {
  submitted_to_website: "已提交官网",
  website_processing: "官网处理中",
  website_returned_success: "处理成功",
  website_returned_failed: "处理失败",
  brief_pending: "待确认 Brief",
  content_generating: "内容生成中",
  article_review: "文章待审核",
  final_confirmation: "待确认最终稿",
  website_verification: "待官网核验",
  completed: "已完成",
  ignored: "已忽略"
};
