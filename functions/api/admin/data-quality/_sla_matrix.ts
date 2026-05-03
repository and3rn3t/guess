import slaJson from '../../../../data/attribute-completeness-sla.json'

interface SlaRule {
  attributeKey: string
  targets: Record<string, number>
}

interface SlaConfig {
  version: number
  updatedAt: string
  categories: string[]
  global: {
    warnScore: number
    failScore: number
    defaultCategoryFloor: number
    disputeBudget: number
  }
  rules: SlaRule[]
}

const SLA = slaJson as SlaConfig

export const DQ_CATEGORIES = Object.freeze([...SLA.categories])

export const DQ31_DEFAULTS = Object.freeze({
  warnScore: SLA.global.warnScore,
  failScore: SLA.global.failScore,
  defaultCategoryFloor: SLA.global.defaultCategoryFloor,
  disputeBudget: SLA.global.disputeBudget,
})

export const DQ33_RULES = Object.freeze(
  SLA.rules.map((rule) => ({
    attributeKey: rule.attributeKey,
    targets: { ...rule.targets },
  })),
)
