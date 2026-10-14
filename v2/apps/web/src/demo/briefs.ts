import {
  initialTaskAssignee,
  initialTaskStatus,
  type ServiceMode,
  type Task,
  type TaskType
} from "@geo/domain";

export interface KnowledgeOption {
  id: string;
  title: string;
  kind: "knowledge_base" | "uploaded_file";
  status: "available" | "uploaded_pending_parse";
  recommended: boolean;
}

export interface BriefDraft {
  goal: string;
  audience: string;
  stage: "需求评估" | "方案寻找";
  outputType: string;
  instruction: string;
  useWebSearch: boolean;
  knowledgeIds: string[];
  version: number;
  savedAt?: string;
  ignoreReason?: string;
}

export interface BriefTask extends Omit<Task, "type"> {
  type: Extract<TaskType, "website_content" | "external_content">;
  brief: BriefDraft;
}

export const knowledgeOptions: KnowledgeOption[] = [
  { id: "kb-1", title: "碳纤维切割技术参数与样件报告", kind: "knowledge_base", status: "available", recommended: true },
  { id: "kb-2", title: "德国服务网络与备件响应说明", kind: "knowledge_base", status: "available", recommended: true },
  { id: "kb-3", title: "航空与汽车行业认证资料", kind: "knowledge_base", status: "available", recommended: true },
  { id: "kb-4", title: "日本市场售后服务资料", kind: "knowledge_base", status: "available", recommended: false },
  { id: "upload-1", title: "新上传的产品手册.pdf", kind: "uploaded_file", status: "uploaded_pending_parse", recommended: false }
];

const taskSamples: Array<{
  sourceRef: string;
  title: string;
  type: Extract<TaskType, "website_content" | "external_content">;
  goal: string;
  audience: string;
  stage: "需求评估" | "方案寻找";
  outputType: string;
  instruction: string;
  knowledgeIds: string[];
}> = [
  {
    sourceRef: "认知缺口策略1",
    title: "补充汽车工艺停机风险与服务问答",
    type: "website_content",
    goal: "帮助汽车行业采购人员判断停机风险与服务响应能力",
    audience: "汽车 Tier-1 采购负责人",
    stage: "需求评估",
    outputType: "官网服务问答",
    instruction: "重点说明计划停机、备件响应和培训支持；未经确认的价格与交期不要写入。",
    knowledgeIds: ["kb-1", "kb-2"]
  },
  {
    sourceRef: "认知缺口策略2",
    title: "碳纤维切割精度与样件验证说明",
    type: "website_content",
    goal: "补齐买家对切割精度和验证方法的认知缺口",
    audience: "复材技术负责人",
    stage: "方案寻找",
    outputType: "官网技术文章",
    instruction: "围绕 ±0.05 mm 精度、热影响区与样件验证流程展开。",
    knowledgeIds: ["kb-1", "kb-3"]
  },
  {
    sourceRef: "官网内容策略3",
    title: "完善日本市场本地服务介绍",
    type: "website_content",
    goal: "增强日本客户对本地服务与售后能力的理解",
    audience: "日本商社采购",
    stage: "需求评估",
    outputType: "官网本地服务页",
    instruction: "使用清晰的日语业务表达，事实范围以知识库资料为准。",
    knowledgeIds: ["kb-4"]
  },
  {
    sourceRef: "认知缺口策略4",
    title: "第三方行业媒体产品介绍",
    type: "external_content",
    goal: "形成可供行业媒体发布的产品与应用介绍",
    audience: "航空制造行业读者",
    stage: "方案寻找",
    outputType: "外部媒体文章",
    instruction: "以应用价值和可验证能力为主，不使用无法确认的市场排名。",
    knowledgeIds: ["kb-1", "kb-3"]
  },
  {
    sourceRef: "认知缺口策略5",
    title: "采购评估清单与常见误区",
    type: "external_content",
    goal: "帮助潜在买家建立设备采购评估框架",
    audience: "制造企业采购与技术团队",
    stage: "需求评估",
    outputType: "外部指南文章",
    instruction: "包含精度、材料兼容性、服务和认证四类检查项。",
    knowledgeIds: ["kb-1", "kb-2", "kb-3"]
  }
];

export function createBriefTasks(mode: ServiceMode): BriefTask[] {
  return taskSamples.map((sample, index) => ({
    id: mode + "-brief-task-" + (index + 1),
    sequence: index + 1,
    sourceRef: sample.sourceRef,
    title: sample.title,
    type: sample.type,
    serviceMode: mode,
    status: initialTaskStatus(mode, sample.type),
    assigneeRole: initialTaskAssignee(mode, sample.type),
    brief: {
      goal: sample.goal,
      audience: sample.audience,
      stage: sample.stage,
      outputType: sample.outputType,
      instruction: sample.instruction,
      useWebSearch: false,
      knowledgeIds: sample.knowledgeIds,
      version: 1
    }
  }));
}
