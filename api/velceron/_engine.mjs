import crypto from "node:crypto";

export const PRICE_USD = 0.20;
export const POLICY_VERSION = "velceron-policy-2026-09-22.2";

const rank = { allow: 0, review: 1, block: 2 };
const sensitive = new Set(["personal_data","financial_data","health_data","biometric_data","authentication_data"]);
const secrets = new Set(["credential","secret","api_key","private_key","password"]);
const regulated = new Set(["credit_decision","employment_decision","insurance_decision","healthcare_decision","eligibility_decision"]);
const highImpact = new Set(["transfer_funds","delete_resource","deploy_production","change_permissions","execute_trade","publish_external"]);

const arr = v => v == null ? [] : Array.isArray(v) ? v : [v];
const uniq = xs => [...new Set(xs)];

export function validate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Request body must be a JSON object.";
  if (!body.action || typeof body.action !== "string") return "Field 'action' is required and must be a string.";
  return null;
}

export function evaluate(input = {}) {
  const action = String(input.action ?? "unknown").trim().toLowerCase();
  const destination = String(input.destination ?? "internal").trim().toLowerCase();
  const environment = String(input.environment ?? "unspecified").trim().toLowerCase();
  const data = new Set(arr(input.data_categories).map(x => String(x).toLowerCase()));
  const amount = Number(input.amount_usd ?? 0) || 0;
  const approved = Boolean(input.has_human_approval);
  const reversible = input.reversible !== false;
  const s = { decision: "allow", risk: 5, reasons: [], controls: [] };

  const add = (code, decision, points, message, controls = []) => {
    if (rank[decision] > rank[s.decision]) s.decision = decision;
    s.risk += points;
    s.reasons.push({ code, decision, message });
    s.controls.push(...controls);
  };

  if ([...data].some(x => secrets.has(x)) && destination === "external")
    add("SECRET_EGRESS","block",80,"Credentials or secrets must not be sent externally.",["Remove secrets from the payload.","Use scoped credentials from a secrets manager."]);

  if ([...data].some(x => sensitive.has(x)) && destination === "external")
    add("SENSITIVE_DATA_EGRESS","review",35,"Sensitive data is leaving the internal boundary.",["Confirm purpose and recipient.","Minimise or redact sensitive fields."]);

  if (regulated.has(action))
    add("REGULATED_DECISION","review",40,"The action may materially affect a person.",["Require human review.","Record factors and provenance.","Provide an override or appeal path where appropriate."]);

  if (highImpact.has(action))
    add("HIGH_IMPACT_ACTION", approved ? "allow" : "review", approved ? 10 : 30, approved ? "High-impact action has recorded approval." : "High-impact action lacks recorded approval.", approved ? [] : ["Obtain human approval before execution."]);

  if ((action === "delete_resource" || action === "change_permissions") && environment === "production" && !approved)
    add("UNAPPROVED_PRODUCTION_CHANGE","block",70,"An unapproved destructive or access-changing action targets production.",["Require a named approver and change record."]);

  if (action === "transfer_funds" || action === "execute_trade") {
    if (amount <= 0) add("MONETARY_AMOUNT_MISSING","review",20,"A monetary action is missing a valid amount.",["Provide amount and currency."]);
    else if (amount >= 10000 && !approved) add("HIGH_VALUE_TRANSACTION","block",65,"A high-value transaction lacks human approval.",["Require explicit approval and transaction limits."]);
    else add("MONETARY_ACTION","review",25,"The agent proposes a monetary transaction.",["Apply spend limits and keep an audit trail."]);
  }

  if (!reversible && s.decision === "allow")
    add("IRREVERSIBLE_ACTION","review",25,"The action is marked irreversible.",["Require confirmation or a compensating control."]);

  if (!s.reasons.length) s.reasons.push({ code:"NO_ELEVATED_RULE_TRIGGERED", decision:"allow", message:"No elevated policy rule was triggered by the supplied context." });

  return {
    evaluation_id: "vel_" + crypto.randomUUID(),
    decision: s.decision,
    risk_score: Math.min(100, s.risk),
    reasons: s.reasons,
    required_controls: uniq(s.controls),
    context: { action, destination, environment, data_categories:[...data], jurisdiction:arr(input.jurisdiction).map(String), has_human_approval:approved, reversible },
    billing: { billable_unit:"policy_evaluation", units:1, unit_price_usd:PRICE_USD, amount_usd:PRICE_USD, payment_status:"demo_until_live_x402" },
    audit: { policy_version:POLICY_VERSION, evaluated_at:new Date().toISOString(), deterministic_policy_engine:true, legal_advice:false }
  };
}
