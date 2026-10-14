import {
  initialTaskAssignee,
  initialTaskStatus,
  primaryAction,
  workflowLabels,
  type ServiceMode,
  type Task,
  type TaskStatus
} from "@geo/domain";
import { useMemo, useState } from "react";

function reviewStatus(
  mode: ServiceMode,
  type: "website_content" | "external_content"
): TaskStatus {
  return mode === "managed"
    ? "pending_ops_content_review"
    : "pending_client_content_review";
}

const seed = (mode: ServiceMode): Task[] => [
  {
    id: "task-1",
    sequence: 1,
    sourceRef: "官网 GEO 体检.1",
    title: "Product Schema 缺失",
    type: "technical_repair",
    serviceMode: mode,
    status: initialTaskStatus(mode, "technical_repair"),
    assigneeRole: initialTaskAssignee(mode, "technical_repair")
  },
  {
    id: "task-2",
    sequence: 2,
    sourceRef: "认知缺口策略2",
    title: "补充汽车工艺停机风险与服务问答",
    type: "website_content",
    serviceMode: mode,
    status: initialTaskStatus(mode, "website_content"),
    assigneeRole: initialTaskAssignee(mode, "website_content")
  },
  {
    id: "task-3",
    sequence: 3,
    sourceRef: "认知缺口策略3",
    title: "第三方行业媒体产品介绍",
    type: "external_content",
    serviceMode: mode,
    status: reviewStatus(mode, "external_content"),
    assigneeRole: mode === "managed" ? "ops" : "client"
  }
];

const typeLabel = {
  technical_repair: "技术修复",
  website_content: "官网内容",
  external_content: "外部内容"
};

export function App() {
  const [mode, setMode] = useState<ServiceMode>("agent");
  const tasks = useMemo(() => seed(mode), [mode]);
  const currentRole = mode === "agent" ? "client" : "ops";

  return (
    <main className="page">
      <header className="hero">
        <div>
          <span className="eyebrow">GEO Platform V2 · Clean Architecture</span>
          <h1>统一任务与状态流转</h1>
          <p>当前页面用于验证统一数据模型和业务流程，不读取旧版页面缓存。</p>
        </div>
        <div className="mode" aria-label="服务模式">
          <button className={mode === "agent" ? "active" : ""} onClick={() => setMode("agent")}>Agent 自主</button>
          <button className={mode === "managed" ? "active" : ""} onClick={() => setMode("managed")}>代运营</button>
        </div>
      </header>

      <section className="summary">
        <div><strong>3</strong><span>统一任务类型</span></div>
        <div><strong>2</strong><span>服务模式</span></div>
        <div><strong>0</strong><span>旧脚本依赖</span></div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div><h2>任务工作台</h2><p>一个问题对应一个 Brief；技术修复不进入内容流程。</p></div>
          <span>{mode === "agent" ? "客户视角" : "运营视角"}</span>
        </div>
        <div className="table" role="table">
          <div className="row head" role="row">
            <span>序号</span><span>任务</span><span>任务类型</span><span>来源</span><span>处理状态</span><span>操作</span>
          </div>
          {tasks.map(task => (
            <div className="row" role="row" key={task.id}>
              <span className="sequence">{task.sequence}</span>
              <strong>{task.title}</strong>
              <span><em className={`type ${task.type}`}>{typeLabel[task.type]}</em></span>
              <span>{task.sourceRef}</span>
              <span><em className="status">{workflowLabels[task.status]}</em></span>
              <span><button className="action">{primaryAction(task, currentRole)}</button></span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
