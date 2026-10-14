import { useState } from "react";
import { OptimizationBriefPage } from "./pages/OptimizationBriefPage";
import { StrategyConfirmationPage } from "./pages/StrategyConfirmationPage";

type Page = "strategy" | "optimization";

export function App() {
  const [page, setPage] = useState<Page>("optimization");

  return (
    <div className="app-shell">
      <nav className="product-nav" aria-label="V2 验收步骤">
        <div>
          <strong>GEO Platform V2</strong>
          <span>业务闭环验收</span>
        </div>
        <div className="product-nav-actions">
          <button className={page === "strategy" ? "active" : ""} onClick={() => setPage("strategy")}>
            第 4 步 · 策略确认
          </button>
          <button className={page === "optimization" ? "active" : ""} onClick={() => setPage("optimization")}>
            第 5 步 · 优化中心与 Brief
          </button>
        </div>
      </nav>
      {page === "strategy" ? (
        <StrategyConfirmationPage onOpenOptimization={() => setPage("optimization")} />
      ) : (
        <OptimizationBriefPage />
      )}
    </div>
  );
}
