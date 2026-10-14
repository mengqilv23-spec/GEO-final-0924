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
  createExecutionTasks,
  type ExecutionLog,
  type ExecutionTask
} from "../demo/execution";

const roleLabels: Record<ActorRole, string> = {
  client: "客户",
  ops: "运营",
  agent: "Agent",
  website: "官网"
};

const typeLabels = {
  technical_repair: "技术修复",
  website_content: "官网内容",
  external_content: "外部内容"
};

function now() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function eventLabel(event: TaskEvent) {
  const labels: Partial<Record<TaskEvent, string>> = {
    content_generated: "内容生成与质检完成",
    content_saved: "保存正文版本",
    ops_content_approved: "运营审核通过",
    client_final_confirmed: "客户确认最终稿",
    website_started: "官网开始处理",
    website_succeeded: "官网处理成功",
    website_failed: "官网处理失败",
    website_approved: "官网审核通过",
    website_rejected: "官网审核拒绝",
    ignore: "忽略任务"
  };
  return labels[event] ?? event;
}

export function ContentWorkflowPage() {
  const [mode, setMode] = useState<ServiceMode>("managed");
  const [role, setRole] = useState<ActorRole>("ops");
  const [tasks, setTasks] = useState(() => createExecutionTasks("managed"));
  const [selectedId, setSelectedId] = useState("managed-execution-1");
  const [tab, setTab] = useState<"content" | "versions" | "logs">("content");
  const [ignoreOpen, setIgnoreOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("点击“完成生成与质检”开始完整流转。");

  const selected = useMemo(
    () => tasks.find(task => task.id === selectedId) ?? tasks[0],
    [selectedId, tasks]
  );

  const transitions = availableTaskTransitions(selected, role);
  const editable = transitions.some(item => item.event === "content_saved");
  const canIgnore = transitions.some(item => item.event === "ignore");
  const canOpsApprove = transitions.some(item => item.event === "ops_content_approved");
  const canClientConfirm = transitions.some(item => item.event === "client_final_confirmed");

  function changeMode(nextMode: ServiceMode) {
    const nextTasks = createExecutionTasks(nextMode);
    setMode(nextMode);
    setRole(nextMode === "managed" ? "ops" : "client");
    setTasks(nextTasks);
    setSelectedId(nextTasks[0].id);
    setTab("content");
    setNotice(nextMode === "managed"
      ? "代运营模式：运营审核正文后交给客户确认最终稿。"
      : "Agent 自主模式：客户直接审核正文并确认最终稿。");
  }

  function updateTask(id: string, mutate: (task: ExecutionTask) => ExecutionTask) {
    setTasks(current => current.map(task => task.id === id ? mutate(task) : task));
  }

  function addLog(task: ExecutionTask, actor: ActorRole, action: string, detail: string): ExecutionLog[] {
    return [{
      id: task.id + "-" + Date.now(),
      actor,
      action,
      detail,
      createdAt: now()
    }, ...task.logs];
  }

  function applyEvent(event: TaskEvent, actor: ActorRole, detail: string) {
    try {
      const next = transitionTask(selected, event, actor);
      updateTask(selected.id, task => ({
        ...task,
        ...next,
        type: task.type,
        latestWebsiteFeedback:
          event === "website_rejected" ? detail : task.latestWebsiteFeedback,
        logs: addLog(task, actor, eventLabel(event), detail)
      }));
      setReason("");
      setIgnoreOpen(false);
      setRejectOpen(false);
      setNotice(detail);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "当前操作不可执行。");
    }
  }

  function generateContent() {
    applyEvent(
      "content_generated",
      "agent",
      mode === "managed"
        ? "内容和七项质检已完成，已交由运营审核。"
        : "内容和七项质检已完成，已交由客户审核。"
    );
  }

  function saveContent() {
    try {
      const next = transitionTask(selected, "content_saved", role);
      updateTask(selected.id, task => ({
        ...task,
        ...next,
        type: task.type,
        version: task.version + 1,
        logs: addLog(task, role, "保存正文版本", "已保存最新正文，下一位处理人将看到该版本。")
      }));
      setNotice("正文已保存为 V" + (selected.version + 1) + "。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "当前正文不可保存。");
    }
  }

  function updateContent(value: string) {
    if (!editable) return;
    updateTask(selected.id, task => ({ ...task, content: value }));
  }

  function copyContent() {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(selected.content);
    }
    setNotice("正文已复制，可以交付给外部渠道使用。");
  }

  function handlePrimary() {
    if (canOpsApprove) {
      applyEvent("ops_content_approved", role, "运营已审核并保存最新版本，已交由客户确认最终稿。");
      return;
    }
    if (canClientConfirm) {
      applyEvent(
        "client_final_confirmed",
        role,
        selected.type === "website_content"
          ? "客户已确认最终稿，内容已提交官网审核且不可撤回。"
          : "客户已确认最终稿，外部内容流程已完成。"
      );
    }
  }

  const isWebsiteWaiting = selected.status === "pending_website_review";
  const isCompleted = selected.status === "completed";
  const isTechnical = selected.type === "technical_repair";

  return (
    <main className="page execution-page">
      <header className="hero">
        <div>
          <span className="eyebrow">GEO Platform V2 · 完整闭环</span>
          <h1>内容执行、审核与交付</h1>
          <p>正文版本、质检、角色交接、官网退回重提和处理日志在同一任务中完成。</p>
        </div>
        <div className="demo-badge">完整流程验收</div>
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
          <span className="control-label">查看视角</span>
          <div className="segmented">
            {mode === "managed" && <button className={role === "ops" ? "active" : ""} onClick={() => setRole("ops")}>运营</button>}
            <button className={role === "client" ? "active" : ""} onClick={() => setRole("client")}>客户</button>
          </div>
        </div>
        <p className="permission-note">只有当前处理人可以修改和审核；所有角色看到的都是上一位保存的最新版本。</p>
      </section>

      <section className="execution-layout">
        <aside className="task-list">
          <div className="task-list-title">
            <div><h2>执行任务</h2><p>三种任务类型</p></div>
          </div>
          {tasks.map(task => (
            <button key={task.id} className={"task-card " + (task.id === selected.id ? "active" : "")} onClick={() => { setSelectedId(task.id); setTab("content"); }}>
              <span className="task-sequence">{task.sequence}</span>
              <span className="task-card-copy"><strong>{task.title}</strong><small>{task.sourceRef}</small></span>
              <span className={"mini-type " + task.type}>{typeLabels[task.type]}</span>
              <em>{workflowLabels[task.status]}</em>
            </button>
          ))}
        </aside>

        <section className="content-workspace">
          <header className="brief-header">
            <div>
              <span className="brief-source">{selected.sourceRef} · 任务 {selected.sequence}</span>
              <h2>{selected.title}</h2>
              <p>{typeLabels[selected.type]} · 当前处理人：{roleLabels[selected.assigneeRole]}</p>
            </div>
            <span className={"status " + (isCompleted ? "success" : "waiting")}>{workflowLabels[selected.status]}</span>
          </header>

          {isTechnical ? (
            <section className="technical-result">
              <div className="technical-icon">⚙</div>
              <div>
                <h3>官网直接处理</h3>
                <p>技术修复不进入 Brief、内容生成或人工审核流程，官网返回处理状态和处理说明。</p>
              </div>
              <dl>
                <div><dt>当前状态</dt><dd>{workflowLabels[selected.status]}</dd></div>
                <div><dt>处理说明</dt><dd>{selected.status === "website_returned_success" ? "已补充 Product / FAQ Schema 并完成发布。" : selected.status === "website_returned_failed" ? "修复失败，请查看官网返回原因。" : "官网正在接收并处理结构化数据修复。"}</dd></div>
              </dl>
              <div className="system-actions">
                {selected.status === "submitted_to_website" && <button className="button primary" onClick={() => applyEvent("website_started", "website", "官网已开始处理技术修复。")}>模拟官网开始处理</button>}
                {selected.status === "website_processing" && <>
                  <button className="button primary" onClick={() => applyEvent("website_succeeded", "website", "官网已完成技术修复并返回处理说明。")}>模拟处理成功</button>
                  <button className="button secondary" onClick={() => applyEvent("website_failed", "website", "官网处理失败，已返回错误原因。")}>模拟处理失败</button>
                </>}
              </div>
            </section>
          ) : (
            <>
              <div className="content-tabs">
                <button className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}>生成内容</button>
                <button className={tab === "versions" ? "active" : ""} onClick={() => setTab("versions")}>版本</button>
                <button className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>审核记录</button>
              </div>

              {tab === "content" && (
                <>
                  <div className="quality-strip">
                    <strong>七项自动质检</strong>
                    <span>{selected.qualityPassed}/{selected.qualityTotal} 通过</span>
                    <span>问题段落已标色</span>
                    <em>! {selected.qualityIssues[0]}</em>
                  </div>

                  {selected.latestWebsiteFeedback && (
                    <div className="website-feedback">
                      <strong>官网退回意见</strong>
                      <p>{selected.latestWebsiteFeedback}</p>
                      <span>请修改、保存并重新完成角色审核后提交官网。</span>
                    </div>
                  )}

                  <div className="editor-note">
                    {editable
                      ? "你可以直接在正文中修改，修改后点击“保存修改”。"
                      : "当前为只读状态。只有当前处理人可以修改正文。"}
                  </div>
                  <textarea className="content-editor" value={selected.content} disabled={!editable} onChange={event => updateContent(event.target.value)} />

                  <footer className="content-actions">
                    <div>
                      {canIgnore && <button className="button ghost" onClick={() => setIgnoreOpen(true)}>忽略任务</button>}
                      {isCompleted && selected.type === "external_content" && <button className="button secondary" onClick={copyContent}>复制内容</button>}
                    </div>
                    <div>
                      {selected.status === "content_generating" && <button className="button primary" onClick={generateContent}>完成生成与质检</button>}
                      {editable && <button className="button secondary" onClick={saveContent}>保存修改</button>}
                      {(canOpsApprove || canClientConfirm) && <button className="button primary" onClick={handlePrimary}>{canOpsApprove ? "审核通过并交给客户" : selected.type === "website_content" ? "确认并提交官网" : "确认最终稿"}</button>}
                    </div>
                  </footer>

                  {isWebsiteWaiting && (
                    <section className="website-review-card">
                      <div><strong>已提交官网审核</strong><p>提交后不可撤回。官网通过则完成；拒绝则按服务模式退回修改。</p></div>
                      <div className="system-actions">
                        <button className="button primary" onClick={() => applyEvent("website_approved", "website", "官网审核通过，任务已完成。")}>模拟官网通过</button>
                        <button className="button secondary" onClick={() => setRejectOpen(true)}>模拟官网拒绝</button>
                      </div>
                    </section>
                  )}
                </>
              )}

              {tab === "versions" && (
                <section className="readonly-list">
                  <h3>正文版本</h3>
                  {Array.from({ length: selected.version }, (_, index) => selected.version - index).map(version => (
                    <div key={version}><strong>V{version}</strong><span>{version === selected.version ? "当前版本" : "历史版本"}</span><small>由{roleLabels[selected.logs[0]?.actor ?? "agent"]}保存</small></div>
                  ))}
                </section>
              )}

              {tab === "logs" && (
                <section className="readonly-list">
                  <h3>只读审核记录</h3>
                  {selected.logs.map(log => (
                    <div key={log.id}><strong>{log.action}</strong><span>{roleLabels[log.actor]} · {log.createdAt}</span><small>{log.detail}</small></div>
                  ))}
                </section>
              )}
            </>
          )}
        </section>
      </section>

      <div className="notice" role="status">{notice}</div>

      {ignoreOpen && (
        <div className="modal-backdrop" onMouseDown={() => setIgnoreOpen(false)}>
          <section className="modal" onMouseDown={event => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-kicker">终止流程</span><h3>忽略任务</h3></div><button className="close" onClick={() => setIgnoreOpen(false)}>×</button></div>
            <div className="modal-body"><label className="field-label">忽略原因 <b>必填</b></label><textarea rows={4} value={reason} onChange={event => setReason(event.target.value)} placeholder="请填写忽略原因。" /></div>
            <footer className="modal-footer"><button className="button secondary" onClick={() => setIgnoreOpen(false)}>取消</button><button className="button danger" disabled={!reason.trim()} onClick={() => applyEvent("ignore", role, reason.trim())}>确认忽略</button></footer>
          </section>
        </div>
      )}

      {rejectOpen && (
        <div className="modal-backdrop" onMouseDown={() => setRejectOpen(false)}>
          <section className="modal" onMouseDown={event => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-kicker">官网审核</span><h3>退回修改</h3></div><button className="close" onClick={() => setRejectOpen(false)}>×</button></div>
            <div className="modal-body"><label className="field-label">修改意见 <b>必填</b></label><textarea rows={4} value={reason} onChange={event => setReason(event.target.value)} placeholder="例如：产品精度参数缺少可追溯来源，请补充后重新提交。" /><p className="field-help">退回后不能忽略；代运营先退给运营，Agent 自主直接退给客户。</p></div>
            <footer className="modal-footer"><button className="button secondary" onClick={() => setRejectOpen(false)}>取消</button><button className="button danger" disabled={!reason.trim()} onClick={() => applyEvent("website_rejected", "website", reason.trim())}>确认退回</button></footer>
          </section>
        </div>
      )}
    </main>
  );
}
