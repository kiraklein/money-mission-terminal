import { evaluate, validate, PRICE_USD, POLICY_VERSION } from "./_engine.mjs";

const info = { name:"velceron-agent-gate", version:"0.2.0" };
const capabilities = { tools:{ listChanged:false } };
const tool = {
  name:"evaluate_action",
  title:"Evaluate agent action",
  description:"Pre-flight governance gate for an autonomous action. Returns allow, review, or block. Public demo mode is active until live x402 settlement is connected.",
  inputSchema:{ type:"object", required:["action"], properties:{
    action:{type:"string"}, destination:{type:"string"}, environment:{type:"string"},
    data_categories:{type:"array",items:{type:"string"}}, jurisdiction:{},
    amount_usd:{type:"number"}, has_human_approval:{type:"boolean"}, reversible:{type:"boolean"}
  }, additionalProperties:true }
};

function result(id, value, modern=false) {
  const r = { jsonrpc:"2.0", id, result:value };
  if (modern && value && typeof value === "object") r.result.serverInfo = info;
  return r;
}
function error(id, code, message) { return { jsonrpc:"2.0", id:id ?? null, error:{code,message} }; }

export default function handler(req,res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","content-type, accept, mcp-protocol-version, mcp-method, mcp-name");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json(error(null,-32600,"POST required"));

  const msg = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const id = msg?.id;
  const method = msg?.method;
  const modern = req.headers["mcp-protocol-version"] === "2026-07-28" || msg?.params?._meta?.["io.modelcontextprotocol/protocolVersion"] === "2026-07-28";

  if (method === "server/discover") return res.status(200).json(result(id,{supportedVersions:["2026-07-28","2025-11-25"],capabilities,serverInfo:info,instructions:"Use evaluate_action before high-impact, external-data, production, or monetary actions."},true));
  if (method === "initialize") return res.status(200).json(result(id,{protocolVersion:"2025-11-25",capabilities,serverInfo:info,instructions:"Use evaluate_action before high-impact actions."}));
  if (method === "notifications/initialized") return res.status(202).end();
  if (method === "tools/list") return res.status(200).json(result(id,{tools:[tool]},modern));
  if (method === "tools/call") {
    if (msg?.params?.name !== "evaluate_action") return res.status(200).json(error(id,-32602,"Unknown tool"));
    const args = msg?.params?.arguments || {};
    const invalid = validate(args);
    if (invalid) return res.status(200).json(result(id,{isError:true,content:[{type:"text",text:invalid}]},modern));
    const evaluation = evaluate(args);
    return res.status(200).json(result(id,{
      content:[{type:"text",text:JSON.stringify(evaluation)}],
      structuredContent:evaluation
    },modern));
  }
  if (method === "ping") return res.status(200).json(result(id,{},modern));
  if (method === "pricing/get") return res.status(200).json(result(id,{unit:"policy_evaluation",price_usd:PRICE_USD,policy_version:POLICY_VERSION,payments:"demo_until_live_x402"},modern));
  return res.status(200).json(error(id,-32601,"Method not found"));
}
