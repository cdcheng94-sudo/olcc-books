import { EduFlowClient } from "./EduFlowClient";

/**
 * EduFlow product onboarding hub. Today it's just the "new customer"
 * helper; later we could add the EduFlow-specific dashboard (which
 * tenants are healthy, who's overdue, MRR trend) without changing the
 * URL surface.
 */
export default function EduFlowPage() {
  return <EduFlowClient />;
}
