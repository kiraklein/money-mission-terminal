import { evaluate, validate } from "../_engine.mjs";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, x-payment, payment-signature");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error:"method_not_allowed" });
  }
  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error:"invalid_json" }); }
  }
  const error = validate(body);
  if (error) return res.status(400).json({ error:"invalid_request", message:error });
  return res.status(200).json(evaluate(body));
}
