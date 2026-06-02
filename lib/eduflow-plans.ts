/**
 * EduFlow product pricing (the SaaS we sell). Single source of truth for the
 * onboarding helper — change a number here and the New Customer flow,
 * marketing pages, and any future analytics line up automatically.
 *
 * Tiers mirror the public landing page (Starter / Professional / Enterprise).
 * Enterprise is "starting price" — the form lets the operator override
 * monthly + setup before submission.
 */

export type EduFlowPlanKey = "starter" | "professional" | "enterprise";

export type EduFlowPlan = {
  key:             EduFlowPlanKey;
  label:           string;
  audience:        string;
  monthly:         number;   // RM per month
  setup:           number;   // one-off setup fee, RM
  firstMonthFree:  boolean;
  features:        string[];
  enterpriseEditable?: boolean;   // monthly/setup editable in form
};

export const EDUFLOW_PLANS: Record<EduFlowPlanKey, EduFlowPlan> = {
  starter: {
    key:            "starter",
    label:          "Starter",
    audience:       "≤ 50 students · 1 boss + 2-3 teachers",
    monthly:        180,
    setup:          1800,
    firstMonthFree: false,
    features: [
      "8 core modules",
      "Parent Portal",
      "Hosting + domain + SSL",
      "Daily auto-backup",
      "WhatsApp customer support",
    ],
  },
  professional: {
    key:            "professional",
    label:          "Professional",
    audience:       "50–200 students · 4-10 teachers",
    monthly:        320,
    setup:          3500,
    firstMonthFree: true,
    features: [
      "Everything in Starter",
      "WhatsApp auto-billing reminders",
      "Auto class-change notifications",
      "Up to 2 branches",
      "Custom reports · Priority support",
    ],
  },
  enterprise: {
    key:            "enterprise",
    label:          "Enterprise",
    audience:       "200+ students · multi-branch · custom",
    monthly:        580,
    setup:          6000,
    firstMonthFree: false,
    enterpriseEditable: true,
    features: [
      "Everything in Professional",
      "Unlimited branches",
      "White-label (your own brand)",
      "Custom development · Dedicated PM",
      "API integration · SLA guarantee",
    ],
  },
};

export const EDUFLOW_PLAN_LIST: EduFlowPlan[] = [
  EDUFLOW_PLANS.starter,
  EDUFLOW_PLANS.professional,
  EDUFLOW_PLANS.enterprise,
];
