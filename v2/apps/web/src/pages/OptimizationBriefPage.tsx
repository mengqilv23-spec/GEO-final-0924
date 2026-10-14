import {
  availableTaskTransitions,
  transitionTask,
  workflowLabels,
  type ActorRole,
  type ServiceMode,
  type TaskEvent
} from "@geo/domain";
import { useMemo, useState } from "react";
import {
  createBriefTasks,
  knowledgeOptions,
  type BriefDraft,
  type BriefTask
} from "../demo/briefs";

const roleLabels: Record<ActorRole, string> = {
  client: "客户",
  ops: "运营",
  agent: "Agent",
  website: "官网"
};

const taskTypeLabels = {
  website_content: "官网内容",
  external_content: "外部内容"
};

export function OptimizationBriefPage() {
  const [mode, setMode] = useState<ServiceMode>("managed");
  const [role, setRole] = useState<ActorRole>("ops");
  const [tasks, setTasks] = useState(() => createBriefTasks("managed"));
  const [selectedId, setSelectedId] = useState("managed-brief-task-1");
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [ignoreOpen, setIgnoreOpen] = useState(false);
  const [ignoreReason, setIgnoreReason] = useState("");
  const [notice, setNotice] = useState("请选择任务，检查并保存 Brief。");

  const selected = useMemo(
    () => tasks.find(task => task.id === selectedId) ?? tasks[0],
    [selectedId, tasks]
  );

  const transitions = availableTaskTransitions(selected, role);
  const canConfirm = transitions.some(item => item.event === "brief_confirmed");
  const canIgnore = transitions.some(item => item.event === "ignore");
  const canEdit = canConfirm;
  const selectedKnowledge = knowledgeOptions.filter(item =>
    selected.brief.knowledgeIds.includes(item.id)
  );
  const availableKnowledgeCount = selectedKnowledge.filter(item => item.status === "available").length;

  function changeMode(nextMode: ServiceMode) {
    const nextTasks = createBriefTasks(nextMode);
    setMode(nextMode);
    setRole(nextMode === "managed" ? "ops" : "client");
    setTasks(nextTasks);
    setSelectedId(nextTasks[0].id);
    setKnowledgeOpen(false);
    setIgnoreOpen(false);
    setNotice(
      nextMode === "managed"
        ? "代运营模式：运营负责审核 Brief、配置知识并确认生成。"
        : "Agent 自主模式：客户负责审核 Brief、配置知识并确认生成。"
    );
  }

  function updateBrief(changes: Partial<BriefDraft>) {
    if (!canEdit) return;
    setTasks(current =>
      current.map(task =>
        task.id === selected.id
          ? { ...task, brief: { ...task.brief, ...changes } }
          : task
      )
    );
  }

  function saveBrief() {
    if (!canEdit) return;
    const savedAt = new Date().toLocaleString("zh-CN", { hour12: false });
    setTasks(current =>
      current.map(task =>
        task.id === selected.id
          ? {
              ...task,
              brief: {
                ...task.brief,
                version: task.brief.version + 1,
                savedAt
              }
            }
          : task
      )
    );
    setNotice("Brief 已保存为新版本，知识选择和补充要求已一起保存。");
  }

  function applyTaskEvent(event: TaskEvent, reason?: string) {
    try {
      const next = transitionTask(selected, event, role);
      setTasks(current =>
        current.map(task =>
          task.id === selected.id
            ? {
                ...task,
                ...next,
                brief: { ...task.brief, ignoreReason: reason }
              }
            : task
        )
      );
      setIgnoreOpen(false);
      setIgnoreReason("");
      setNotice(
        event === "ignore"
          ? "任务已忽略，流程终止，不会进入内容生成。"
          : "Brief 已确认并提交给 Agent，当前状态已变为“内容生成中”。"
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "当前操作不可执行。");
    }
  }

  function toggleKnowledge(id: string) {
    const option = knowledgeOptions.find(item => item.id === id);
    if (!canEdit || option?.status !== "available") return;
    const current = selected.brief.knowledgeIds;
    updateBrief({
      knowledgeIds: current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    });
  }

  return (
    <main className="page brief-page">
      <header className="hero">
        <div>
          <span className="eyebrow">GEO Platform V2 · 第 5 步</span>
          <h1>优化中心与 Brief</h1>
          <p>一条已确认策略对应一个任务和一个 Brief；技术修复由官网直接处理，不进入此页面。</p>
        </div>
        <div className="demo-badge">交互验收页</div>
      </header>

      <section className="control-panel">
        <div className="control-group">
          <span className="control-label">服务模式</span>
          <div className="segmented">
            <button className={mode === "managed" ? "active" : ""} onClick={() => changeMode("managed")}>代运营</button>
            <button className={mode === "agent" ? "active" : ""} onClick={() => changeMode("agent")}>Agent 自主</button>
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">当前视角</span>
          <div className="segmented">
            {mode === "managed" && (
              <button className={role === "ops" ? "active" : ""} onClick={() => setRole("ops")}>运营</button>
            )}
            <button className={role === "client" ? "active" : ""} onClick={() => setRole("client")}>客户</button>
          </div>
        </div>
        <p className="permission-note">
          {mode === "managed" && role === "client"
            ? "当前 Brief 由运营处理，客户可以查看但不能提前修改或确认。"
            : mode === "managed"
              ? "运营负责配置知识、保存并确认 Brief。"
              : "客户负责配置知识、保存并确认 Brief。"}
        </p>
      </section>

      <section className="brief-layout">
        <aside className="task-list">
          <div className="task-list-title">
            <div><h2>任务</h2><p>共 {tasks.length} 条内容任务</p></div>
            <span>{tasks.filter(task => task.status.includes("brief")).length} 待确认</span>
          </div>
          {tasks.map(task => (
            <button
              key={task.id}
              className={"task-card " + (task.id === selected.id ? "active" : "")}
              onClick={() => setSelectedId(task.id)}
            >
              <span className="task-sequence">{task.sequence}</span>
              <span className="task-card-copy">
                <strong>{task.title}</strong>
                <small>{task.sourceRef}</small>
              </span>
              <span className={"mini-type " + task.type}>{taskTypeLabels[task.type]}</span>
              <em>{workflowLabels[task.status]}</em>
            </button>
          ))}
        </aside>

        <section className="brief-workspace">
          <header className="brief-header">
            <div>
              <span className="brief-source">{selected.sourceRef} · 任务 {selected.sequence}</span>
              <h2>{selected.title}</h2>
              <p>{taskTypeLabels[selected.type]} · 当前处理人：{roleLabels[selected.assigneeRole]}</p>
            </div>
            <span className={"status " + (selected.status === "content_generating" ? "success" : "waiting")}>
              {workflowLabels[selected.status]}
            </span>
          </header>

          <div className="brief-flow" aria-label="任务执行流程">
            <div className={selected.status.includes("brief") ? "active" : "done"}><b>1</b><span>任务确认<small>Brief</small></span></div>
            <i />
            <div className={selected.status === "content_generating" ? "active" : ""}><b>2</b><span>内容准备<small>生成与质检</small></span></div>
            <i />
            <div><b>3</b><span>内容审核<small>{mode === "managed" ? "运营 → 客户" : "客户"}</small></span></div>
            <i />
            <div><b>4</b><span>执行完成<small>{selected.type === "website_content" ? "官网审核" : "最终确认"}</small></span></div>
          </div>

          {!canEdit && selected.status.includes("brief") && (
            <div className="readonly-banner">
              当前由{roleLabels[selected.assigneeRole]}处理。你可以查看最新 Brief，但不能修改、确认或忽略。
            </div>
          )}

          <section className="brief-section">
            <div className="section-heading">
              <div><h3>任务 Brief</h3><p>确认本次内容的目标、对象和边界。</p></div>
              <span>V{selected.brief.version}{selected.brief.savedAt ? " · " + selected.brief.savedAt : ""}</span>
            </div>
            <div className="brief-grid">
              <label>
                <span>内容目标</span>
                <textarea rows={2} disabled={!canEdit} value={selected.brief.goal} onChange={event => updateBrief({ goal: event.target.value })} />
              </label>
              <label>
                <span>目标人设</span>
                <input disabled={!canEdit} value={selected.brief.audience} onChange={event => updateBrief({ audience: event.target.value })} />
              </label>
              <label>
                <span>买家阶段</span>
                <select disabled={!canEdit} value={selected.brief.stage} onChange={event => updateBrief({ stage: event.target.value as BriefDraft["stage"] })}>
                  <option>需求评估</option>
                  <option>方案寻找</option>
                </select>
              </label>
              <label>
                <span>内容形式</span>
                <input disabled={!canEdit} value={selected.brief.outputType} onChange={event => updateBrief({ outputType: event.target.value })} />
              </label>
            </div>
          </section>

          <section className="brief-section">
            <div className="section-heading">
              <div>
                <h3>内容依据 <span className="help-dot" title="AI 会先检索知识库并优先选择匹配资料；上传资料后需前往 AI 建站完成解析。">?</span></h3>
                <p>AI 已优先匹配 {availableKnowledgeCount} 项可用知识，你可以调整。</p>
              </div>
              <button className="button secondary" disabled={!canEdit} onClick={() => setKnowledgeOpen(true)}>选择已有资料</button>
            </div>

            <div className="knowledge-chips">
              {selectedKnowledge.length > 0 ? selectedKnowledge.map(item => (
                <span key={item.id} className={item.status === "available" ? "" : "pending"}>
                  {item.title}
                  {item.status !== "available" && <small>待 AI 建站解析</small>}
                </span>
              )) : <p>暂未选择知识。可以直接填写一句要求，或开启 AI 联网搜索。</p>}
            </div>

            <label className="instruction-field">
              <span>我希望使用的知识或要求</span>
              <textarea
                rows={3}
                disabled={!canEdit}
                value={selected.brief.instruction}
                onChange={event => updateBrief({ instruction: event.target.value })}
                placeholder="例如：重点介绍 XXX 产品，面向航空和汽车行业，不要写未经确认的价格。"
              />
            </label>

            <label className={"web-search " + (selected.brief.useWebSearch ? "checked" : "")}>
              <span>
                <strong>使用 AI 联网搜索</strong>
                <small>用于补充公开资料；产品参数、认证、价格和交期仍需人工确认。</small>
              </span>
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={selected.brief.useWebSearch}
                onChange={event => updateBrief({ useWebSearch: event.target.checked })}
              />
            </label>
          </section>

          <footer className="brief-actions">
            <div>
              <button
                className="button secondary"
                disabled={!canEdit}
                onClick={() => setNotice("资料上传完成后，请前往 AI 建站知识库完成解析，再返回刷新选择。")}
              >
                上传新资料
              </button>
              {canIgnore && <button className="button ghost" onClick={() => setIgnoreOpen(true)}>忽略任务</button>}
            </div>
            <div>
              <button className="button secondary" disabled={!canEdit} onClick={saveBrief}>保存 Brief</button>
              <button className="button primary" disabled={!canConfirm} onClick={() => applyTaskEvent("brief_confirmed")}>
                确认 Brief 并生成内容
              </button>
            </div>
          </footer>
        </section>
      </section>

      <div className="notice" role="status">{notice}</div>

      {knowledgeOpen && (
        <div className="modal-backdrop" onMouseDown={() => setKnowledgeOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
            <div className="modal-header">
              <div><span className="modal-kicker">AI 建站知识库</span><h3>选择已有资料</h3></div>
              <button className="close" onClick={() => setKnowledgeOpen(false)}>×</button>
            </div>
            <div className="modal-body knowledge-list">
              <p className="strategy-detail">每次打开都会刷新可用资料。只有已完成解析的资料可以选择。</p>
              {knowledgeOptions.map(item => (
                <label key={item.id} className={"knowledge-option " + (item.status !== "available" ? "disabled" : "")}>
                  <input
                    type="checkbox"
                    disabled={item.status !== "available"}
                    checked={selected.brief.knowledgeIds.includes(item.id)}
                    onChange={() => toggleKnowledge(item.id)}
                  />
                  <span><strong>{item.title}</strong><small>{item.status === "available" ? (item.recommended ? "AI 推荐" : "可用") : "已上传 · 待 AI 建站解析"}</small></span>
                </label>
              ))}
            </div>
            <footer className="modal-footer">
              <button className="button secondary" onClick={() => setNotice("已刷新知识库可用资料。")}>刷新</button>
              <button className="button primary" onClick={() => setKnowledgeOpen(false)}>完成选择</button>
            </footer>
          </section>
        </div>
      )}

      {ignoreOpen && (
        <div className="modal-backdrop" onMouseDown={() => setIgnoreOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
            <div className="modal-header">
              <div><span className="modal-kicker">终止任务</span><h3>忽略这条任务</h3></div>
              <button className="close" onClick={() => setIgnoreOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <label className="field-label" htmlFor="brief-ignore-reason">忽略原因 <b>必填</b></label>
              <textarea id="brief-ignore-reason" rows={4} value={ignoreReason} onChange={event => setIgnoreReason(event.target.value)} placeholder="请填写不继续执行的原因。" />
              <p className="field-help">忽略后不会生成内容，也不会继续后续审核。</p>
            </div>
            <footer className="modal-footer">
              <button className="button secondary" onClick={() => setIgnoreOpen(false)}>取消</button>
              <button className="button danger" disabled={!ignoreReason.trim()} onClick={() => applyTaskEvent("ignore", ignoreReason.trim())}>确认忽略</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
