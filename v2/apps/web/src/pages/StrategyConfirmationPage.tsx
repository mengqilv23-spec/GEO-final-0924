import {
  availableStrategyTransitions,
  strategyStatusLabels,
  transitionStrategy,
  type ActorRole,
  type ServiceMode,
  type Strategy,
  type StrategyEvent,
  type StrategyType
} from "@geo/domain";
import { useMemo, useState } from "react";
import { createDemoStrategies, type StrategyListItem } from "../demo/strategies";

type Filter = "all" | StrategyType;
type DialogState =
  | { kind: "details"; strategy: StrategyListItem }
  | { kind: "confirm"; strategy: StrategyListItem; event: StrategyEvent }
  | { kind: "ignore"; strategy: StrategyListItem }
  | null;

const strategyTypeLabels: Record<StrategyType, string> = {
  website_content_strategy: "官网内容策略",
  gap_content_strategy: "Gap 内容策略"
};

const roleLabels: Record<ActorRole, string> = {
  client: "客户",
  ops: "运营",
  agent: "Agent",
  website: "官网"
};

function statusTone(status: Strategy["status"]) {
  if (status === "confirmed") return "success";
  if (status === "ignored") return "muted";
  return "waiting";
}

export function StrategyConfirmationPage({ onOpenOptimization }: { onOpenOptimization: () => void }) {
  const [mode, setMode] = useState<ServiceMode>("managed");
  const [role, setRole] = useState<ActorRole>("ops");
  const [filter, setFilter] = useState<Filter>("all");
  const [strategies, setStrategies] = useState(() => createDemoStrategies("managed"));
  const [dialog, setDialog] = useState<DialogState>(null);
  const [ignoreReason, setIgnoreReason] = useState("");
  const [notice, setNotice] = useState("当前为代运营模式，请先用运营视角确认策略。");

  const visibleStrategies = useMemo(
    () => strategies.filter(item => filter === "all" || item.type === filter),
    [filter, strategies]
  );

  const counts = useMemo(() => ({
    total: strategies.length,
    waiting: strategies.filter(item => item.status.startsWith("pending_")).length,
    confirmed: strategies.filter(item => item.status === "confirmed").length,
    ignored: strategies.filter(item => item.status === "ignored").length
  }), [strategies]);

  function changeMode(nextMode: ServiceMode) {
    setMode(nextMode);
    setRole(nextMode === "managed" ? "ops" : "client");
    setStrategies(createDemoStrategies(nextMode));
    setFilter("all");
    setDialog(null);
    setIgnoreReason("");
    setNotice(
      nextMode === "managed"
        ? "已切换为代运营模式：运营先确认，之后客户确认。"
        : "已切换为 Agent 自主模式：客户可直接确认或忽略。"
    );
  }

  function applyEvent(strategy: StrategyListItem, event: StrategyEvent, reason?: string) {
    try {
      const next = transitionStrategy(strategy, event, role);
      setStrategies(current =>
        current.map(item =>
          item.id === strategy.id ? { ...item, ...next, ignoredReason: reason } : item
        )
      );
      setDialog(null);
      setIgnoreReason("");
      if (event === "ignore") {
        setNotice("策略已忽略，不会生成后续任务。忽略原因已记录。");
      } else if (next.status === "confirmed") {
        setNotice("策略已完成确认，已进入优化中心并生成对应任务。");
      } else {
        setNotice("运营已确认，当前已交由客户确认。");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "当前操作不可执行。");
    }
  }

  function openConfirm(strategy: StrategyListItem) {
    const transition = availableStrategyTransitions(strategy, role)
      .find(item => item.event === "ops_confirmed" || item.event === "client_confirmed");
    if (transition) setDialog({ kind: "confirm", strategy, event: transition.event });
  }

  function actionArea(strategy: StrategyListItem) {
    const transitions = availableStrategyTransitions(strategy, role);
    const canConfirm = transitions.some(
      item => item.event === "ops_confirmed" || item.event === "client_confirmed"
    );
    const canIgnore = transitions.some(item => item.event === "ignore");

    if (strategy.status === "confirmed") {
      return <button className="button secondary" onClick={onOpenOptimization}>去优化中心</button>;
    }

    if (strategy.status === "ignored") {
      return <button className="button secondary" onClick={() => setDialog({ kind: "details", strategy })}>查看详情</button>;
    }

    if (!canConfirm && !canIgnore) {
      return <button className="button secondary" onClick={() => setDialog({ kind: "details", strategy })}>查看详情</button>;
    }

    return (
      <div className="actions">
        {canConfirm && <button className="button primary" onClick={() => openConfirm(strategy)}>确认策略</button>}
        {canIgnore && <button className="button ghost" onClick={() => setDialog({ kind: "ignore", strategy })}>忽略</button>}
      </div>
    );
  }

  return (
    <main className="page">
      <header className="hero">
        <div>
          <span className="eyebrow">GEO Platform V2 · 第 4 步</span>
          <h1>策略确认</h1>
          <p>确认官网内容策略与 Gap 内容策略。确认完成后，一条策略只生成一个优化任务。</p>
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
            ? "运营确认前，客户只能查看；运营确认后，客户才可以确认或忽略。"
            : mode === "managed"
              ? "运营负责第一轮确认或忽略，确认后交由客户。"
              : "客户可直接确认或忽略策略。"}
        </p>
      </section>

      <section className="summary" aria-label="策略概览">
        <div><strong>{counts.total}</strong><span>全部策略</span></div>
        <div><strong>{counts.waiting}</strong><span>待确认</span></div>
        <div><strong>{counts.confirmed}</strong><span>已确认</span></div>
        <div><strong>{counts.ignored}</strong><span>已忽略</span></div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>待确认策略</h2>
            <p>当前处理人：{roleLabels[role]} · 所有确认和忽略操作都会进入只读日志。</p>
          </div>
          <span className="role-chip">{mode === "managed" ? "代运营" : "Agent 自主"} · {roleLabels[role]}视角</span>
        </div>

        <div className="filters" aria-label="策略类型筛选">
          {([
            ["all", "全部"],
            ["website_content_strategy", "官网内容策略"],
            ["gap_content_strategy", "Gap 内容策略"]
          ] as Array<[Filter, string]>).map(([value, label]) => (
            <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>

        <div className="table-wrap">
          <div className="table" role="table">
            <div className="row head" role="row">
              <span>序号</span>
              <span>策略内容</span>
              <span>策略类型</span>
              <span>当前状态</span>
              <span>当前处理人</span>
              <span>操作</span>
            </div>
            {visibleStrategies.map(strategy => (
              <div className="row" role="row" key={strategy.id}>
                <span className="sequence">{strategy.sequence}</span>
                <span className="strategy-copy">
                  <strong>{strategy.title}</strong>
                  <small>{strategy.description}</small>
                </span>
                <span><em className={"type " + strategy.type}>{strategyTypeLabels[strategy.type]}</em></span>
                <span><em className={"status " + statusTone(strategy.status)}>{strategyStatusLabels[strategy.status]}</em></span>
                <span>{roleLabels[strategy.assigneeRole]}</span>
                <span>{actionArea(strategy)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="notice" role="status">{notice}</div>

      {dialog && (
        <div className="modal-backdrop" onMouseDown={() => setDialog(null)}>
          <section className="modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-kicker">{strategyTypeLabels[dialog.strategy.type]} · {dialog.strategy.sequence}</span>
                <h3>{dialog.strategy.title}</h3>
              </div>
              <button className="close" aria-label="关闭" onClick={() => setDialog(null)}>×</button>
            </div>

            {dialog.kind === "details" && (
              <div className="modal-body">
                <p className="strategy-detail">{dialog.strategy.description}</p>
                <dl>
                  <div><dt>当前状态</dt><dd>{strategyStatusLabels[dialog.strategy.status]}</dd></div>
                  <div><dt>当前处理人</dt><dd>{roleLabels[dialog.strategy.assigneeRole]}</dd></div>
                  {dialog.strategy.ignoredReason && <div><dt>忽略原因</dt><dd>{dialog.strategy.ignoredReason}</dd></div>}
                </dl>
                {mode === "managed" && role === "client" && dialog.strategy.status === "pending_ops_confirmation" && (
                  <div className="locked-tip">请等待运营先完成确认。此阶段客户不能确认或忽略。</div>
                )}
              </div>
            )}

            {dialog.kind === "confirm" && (
              <div className="modal-body">
                <p className="strategy-detail">{dialog.strategy.description}</p>
                <div className="confirm-tip">
                  {role === "ops"
                    ? "确认后将交由客户继续确认，暂时不会生成任务。"
                    : "确认后将进入优化中心，并生成一个对应任务。"}
                </div>
              </div>
            )}

            {dialog.kind === "ignore" && (
              <div className="modal-body">
                <label className="field-label" htmlFor="ignore-reason">忽略原因 <b>必填</b></label>
                <textarea
                  id="ignore-reason"
                  value={ignoreReason}
                  onChange={event => setIgnoreReason(event.target.value)}
                  placeholder="请说明为什么不执行这条策略，例如：当前业务暂不覆盖该市场。"
                  rows={4}
                />
                <p className="field-help">忽略后流程终止，不会生成后续任务；原因会保存在操作日志中。</p>
              </div>
            )}

            <footer className="modal-footer">
              <button className="button secondary" onClick={() => setDialog(null)}>关闭</button>
              {dialog.kind === "confirm" && (
                <button className="button primary" onClick={() => applyEvent(dialog.strategy, dialog.event)}>确认</button>
              )}
              {dialog.kind === "ignore" && (
                <button
                  className="button danger"
                  disabled={!ignoreReason.trim()}
                  onClick={() => applyEvent(dialog.strategy, "ignore", ignoreReason.trim())}
                >
                  确认忽略
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
