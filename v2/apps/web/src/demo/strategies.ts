import {
  initialStrategyStatus,
  type ActorRole,
  type ServiceMode,
  type Strategy,
  type StrategyType
} from "@geo/domain";

export interface StrategyListItem extends Strategy {
  sequence: number;
  title: string;
  description: string;
  ignoredReason?: string;
}

const samples: Array<{
  type: StrategyType;
  title: string;
  description: string;
}> = [
  {
    type: "website_content_strategy",
    title: "补充汽车工艺停机风险与服务问答",
    description: "在官网交期与服务页面补充计划停机、备件响应和培训支持说明，帮助采购人员核验服务保障。"
  },
  {
    type: "gap_content_strategy",
    title: "补齐复材技术负责人对切割精度的认知缺口",
    description: "围绕 ±0.05 mm 精度、热影响区和样件验证流程形成可核验内容，减少关键参数信息缺失。"
  },
  {
    type: "gap_content_strategy",
    title: "建立航空采购的认证与交付决策依据",
    description: "补充认证范围、标准交期区间与德国服务网络信息，并明确需要业务负责人确认的事实。"
  },
  {
    type: "website_content_strategy",
    title: "完善日本市场本地服务介绍",
    description: "形成日语服务说明、常见问题与采购决策内容，提升本地买家对售后能力的理解。"
  }
];

export function createDemoStrategies(mode: ServiceMode): StrategyListItem[] {
  const status = initialStrategyStatus(mode);
  const assigneeRole: ActorRole = mode === "managed" ? "ops" : "client";

  return samples.map((sample, index) => ({
    id: mode + "-strategy-" + (index + 1),
    sequence: index + 1,
    type: sample.type,
    title: sample.title,
    description: sample.description,
    serviceMode: mode,
    status,
    assigneeRole
  }));
}
