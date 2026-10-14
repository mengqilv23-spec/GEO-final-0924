import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const serviceModeEnum = pgEnum("service_mode", ["agent", "managed"]);
export const actorRoleEnum = pgEnum("actor_role", ["client", "ops", "agent", "website"]);
export const strategyTypeEnum = pgEnum("strategy_type", [
  "website_content_strategy",
  "gap_content_strategy"
]);
export const strategyStatusEnum = pgEnum("strategy_status", [
  "pending_ops_confirmation",
  "pending_client_confirmation",
  "confirmed",
  "ignored"
]);
export const taskTypeEnum = pgEnum("task_type", [
  "technical_repair",
  "website_content",
  "external_content"
]);
export const taskStatusEnum = pgEnum("task_status", [
  "submitted_to_website",
  "website_processing",
  "website_returned_success",
  "website_returned_failed",
  "pending_ops_brief",
  "pending_client_brief",
  "content_generating",
  "pending_ops_content_review",
  "pending_client_content_review",
  "pending_client_final_confirmation",
  "pending_website_review",
  "returned_to_ops",
  "returned_to_client",
  "completed",
  "ignored"
]);
export const knowledgeKindEnum = pgEnum("knowledge_kind", [
  "knowledge_base",
  "uploaded_file",
  "manual_instruction",
  "web_search"
]);
export const knowledgeStatusEnum = pgEnum("knowledge_status", [
  "available",
  "uploaded_pending_parse",
  "unavailable"
]);
export const contentSourceEnum = pgEnum("content_source", [
  "knowledge_base",
  "manual",
  "web"
]);
export const reviewDecisionEnum = pgEnum("review_decision", [
  "saved",
  "approved",
  "rejected",
  "ignored",
  "submitted"
]);
export const websiteResultEnum = pgEnum("website_result", [
  "processing",
  "approved",
  "rejected",
  "failed"
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, table => [
  uniqueIndex("users_email_unique").on(table.email)
]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  serviceMode: serviceModeEnum("service_mode").notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  archiveAfter: timestamp("archive_after", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const projectMembers = pgTable("project_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: actorRoleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, table => [
  uniqueIndex("project_members_project_user_unique").on(table.projectId, table.userId),
  index("project_members_project_idx").on(table.projectId)
]);

export const strategies = pgTable("strategies", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  type: strategyTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: strategyStatusEnum("status").notNull(),
  assigneeRole: actorRoleEnum("assignee_role").notNull(),
  confirmedByUserId: uuid("confirmed_by_user_id").references(() => users.id),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  ignoredByUserId: uuid("ignored_by_user_id").references(() => users.id),
  ignoredReason: text("ignored_reason"),
  ignoredAt: timestamp("ignored_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, table => [
  uniqueIndex("strategies_project_sequence_unique").on(table.projectId, table.sequence),
  index("strategies_project_status_idx").on(table.projectId, table.status)
]);

export const findings = pgTable("findings", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  sourceModule: text("source_module").notNull(),
  taskType: taskTypeEnum("task_type").notNull(),
  title: text("title").notNull(),
  checkItem: text("check_item").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull(),
  rawEvidence: jsonb("raw_evidence").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, table => [
  uniqueIndex("findings_project_sequence_unique").on(table.projectId, table.sequence),
  index("findings_project_type_idx").on(table.projectId, table.taskType)
]);

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  strategyId: uuid("strategy_id").references(() => strategies.id),
  findingId: uuid("finding_id").references(() => findings.id),
  sourceRef: text("source_ref").notNull(),
  title: text("title").notNull(),
  type: taskTypeEnum("type").notNull(),
  status: taskStatusEnum("status").notNull(),
  assigneeRole: actorRoleEnum("assignee_role").notNull(),
  latestWebsiteFeedback: text("latest_website_feedback"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, table => [
  uniqueIndex("tasks_project_sequence_unique").on(table.projectId, table.sequence),
  uniqueIndex("tasks_strategy_unique").on(table.strategyId),
  uniqueIndex("tasks_finding_unique").on(table.findingId),
  index("tasks_project_status_idx").on(table.projectId, table.status),
  index("tasks_assignee_idx").on(table.projectId, table.assigneeRole),
  check(
    "tasks_exactly_one_source",
    sql`num_nonnulls(${table.strategyId}, ${table.findingId}) = 1`
  )
]);

export const briefs = pgTable("briefs", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  instruction: text("instruction").notNull().default(""),
  useWebSearch: boolean("use_web_search").notNull().default(false),
  version: integer("version").notNull().default(1),
  savedByUserId: uuid("saved_by_user_id").references(() => users.id),
  confirmedByUserId: uuid("confirmed_by_user_id").references(() => users.id),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, table => [
  uniqueIndex("briefs_task_unique").on(table.taskId)
]);

export const knowledgeItems = pgTable("knowledge_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  externalId: text("external_id"),
  kind: knowledgeKindEnum("kind").notNull(),
  status: knowledgeStatusEnum("status").notNull(),
  title: text("title").notNull(),
  sourceUrl: text("source_url"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, table => [
  index("knowledge_items_project_status_idx").on(table.projectId, table.status)
]);

export const briefKnowledgeItems = pgTable("brief_knowledge_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  briefId: uuid("brief_id").notNull().references(() => briefs.id, { onDelete: "cascade" }),
  knowledgeItemId: uuid("knowledge_item_id").notNull().references(() => knowledgeItems.id, { onDelete: "cascade" }),
  selectedByUserId: uuid("selected_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, table => [
  uniqueIndex("brief_knowledge_unique").on(table.briefId, table.knowledgeItemId)
]);

export const contentVersions = pgTable("content_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  body: text("body").notNull(),
  source: contentSourceEnum("source").notNull(),
  savedByUserId: uuid("saved_by_user_id").references(() => users.id),
  savedByRole: actorRoleEnum("saved_by_role").notNull(),
  changeSummary: text("change_summary"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, table => [
  uniqueIndex("content_versions_task_version_unique").on(table.taskId, table.version),
  index("content_versions_task_created_idx").on(table.taskId, table.createdAt)
]);

export const qualityRuns = pgTable("quality_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentVersionId: uuid("content_version_id").notNull().references(() => contentVersions.id, { onDelete: "cascade" }),
  passedCount: integer("passed_count").notNull(),
  totalCount: integer("total_count").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull()
}, table => [
  uniqueIndex("quality_runs_content_version_unique").on(table.contentVersionId)
]);

export const qualityIssues = pgTable("quality_issues", {
  id: uuid("id").defaultRandom().primaryKey(),
  qualityRunId: uuid("quality_run_id").notNull().references(() => qualityRuns.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull(),
  startOffset: integer("start_offset"),
  endOffset: integer("end_offset"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, table => [
  index("quality_issues_run_idx").on(table.qualityRunId)
]);

export const reviewRecords = pgTable("review_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  contentVersionId: uuid("content_version_id").references(() => contentVersions.id),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  actorRole: actorRoleEnum("actor_role").notNull(),
  decision: reviewDecisionEnum("decision").notNull(),
  fromStatus: taskStatusEnum("from_status").notNull(),
  toStatus: taskStatusEnum("to_status").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, table => [
  index("review_records_task_created_idx").on(table.taskId, table.createdAt)
]);

export const websiteReturns = pgTable("website_returns", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  attempt: integer("attempt").notNull(),
  result: websiteResultEnum("result").notNull(),
  summary: text("summary").notNull(),
  handledByType: text("handled_by_type").notNull(),
  handledByName: text("handled_by_name").notNull(),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
  handledAt: timestamp("handled_at", { withTimezone: true }).defaultNow().notNull()
}, table => [
  uniqueIndex("website_returns_task_attempt_unique").on(table.taskId, table.attempt),
  index("website_returns_task_idx").on(table.taskId)
]);

export const taskEvents = pgTable("task_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  actorRole: actorRoleEnum("actor_role").notNull(),
  event: text("event").notNull(),
  fromStatus: taskStatusEnum("from_status").notNull(),
  toStatus: taskStatusEnum("to_status").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, table => [
  uniqueIndex("task_events_idempotency_unique").on(table.idempotencyKey),
  index("task_events_task_created_idx").on(table.taskId, table.createdAt)
]);
