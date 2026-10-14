import {
  initialTaskAssignee,
  initialTaskStatus,
  type ActorRole,
  type ServiceMode,
  type Task,
  type TaskType
} from "@geo/domain";

export interface ExecutionLog {
  id: string;
  actor: ActorRole;
  action: string;
  detail: string;
  createdAt: string;
}

export interface ExecutionTask extends Task {
  content: string;
  version: number;
  qualityPassed: number;
  qualityTotal: number;
  qualityIssues: string[];
  latestWebsiteFeedback?: string;
  logs: ExecutionLog[];
}

const article = `Carbon Fiber Cutting: What Buyers Should Verify Before Choosing a System

For composite manufacturing teams, a cutting system is rarely selected on speed alone. Precision, heat-affected-zone control, repeatability, material utilization and service capability all affect the final production decision.

1. Start with verifiable cutting results

APW recommends evaluating carbon-fiber cutting with a repeatable sample process. The verified precision specification in the product fact base is ±0.05 mm, subject to material and process conditions.

2. Compare process quality, not only machine specifications

Buyers should review cut-edge quality, delamination risk, kerf consistency and whether the process introduces a heat-affected zone. These factors should be presented as structured comparison criteria.

3. Make delivery and service information explicit

Lead-time ranges, training coverage and service response should only be published when confirmed by the business owner. Unverified claims are kept out of the generated copy.

Quick evaluation checklist

• Verified precision and sample evidence
• Material compatibility and edge-quality evidence
• Delivery assumptions and service scope
• Certifications and traceable company entities`;

const samples: Array<{ title: string; type: TaskType; sourceRef: string }> = [
  { title: "碳纤维切割精度与样件验证说明", type: "website_content", sourceRef: "认知缺口策略2" },
  { title: "第三方行业媒体产品介绍", type: "external_content", sourceRef: "认知缺口策略4" },
  { title: "Product / FAQ Schema 修复", type: "technical_repair", sourceRef: "官网 GEO 体检.1" }
];

export function createExecutionTasks(mode: ServiceMode): ExecutionTask[] {
  return samples.map((sample, index) => ({
    id: mode + "-execution-" + (index + 1),
    sequence: index + 1,
    sourceRef: sample.sourceRef,
    title: sample.title,
    type: sample.type,
    serviceMode: mode,
    status: sample.type === "technical_repair"
      ? initialTaskStatus(mode, sample.type)
      : "content_generating",
    assigneeRole: sample.type === "technical_repair"
      ? initialTaskAssignee(mode, sample.type)
      : "agent",
    content: sample.type === "technical_repair" ? "" : article,
    version: sample.type === "technical_repair" ? 0 : 1,
    qualityPassed: 6,
    qualityTotal: 7,
    qualityIssues: ["可读性与节奏：开头段落建议进一步精简"],
    logs: [{
      id: mode + "-log-" + (index + 1),
      actor: sample.type === "technical_repair" ? "website" : "agent",
      action: sample.type === "technical_repair" ? "已提交官网" : "开始生成内容",
      detail: sample.type === "technical_repair"
        ? "技术修复已直接提交官网处理。"
        : "Agent 已根据 Brief 和已选知识生成内容。",
      createdAt: "刚刚"
    }]
  }));
}
