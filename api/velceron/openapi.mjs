export default function handler(req,res) {
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = req.headers.host;
  const base = proto + "://" + host;
  res.setHeader("Access-Control-Allow-Origin","*");
  return res.status(200).json({
    openapi:"3.1.0",
    info:{title:"Velceron Agent Gate API",version:"0.2.0",description:"Deterministic pre-flight governance decisions for autonomous agent actions. Returns allow, review, or block."},
    servers:[{url:base}],
    paths:{
      "/api/velceron/v1/evaluate":{
        post:{
          operationId:"evaluateAgentAction",
          summary:"Evaluate a proposed agent action",
          description:"One evaluation is the billable unit. Public demo mode is active until live x402 settlement is connected.",
          requestBody:{required:true,content:{"application/json":{schema:{type:"object",required:["action"],properties:{
            action:{type:"string"},destination:{type:"string",enum:["internal","external","public"]},environment:{type:"string"},
            data_categories:{type:"array",items:{type:"string"}},jurisdiction:{oneOf:[{type:"string"},{type:"array",items:{type:"string"}}]},
            amount_usd:{type:"number",minimum:0},has_human_approval:{type:"boolean"},reversible:{type:"boolean"}
          },additionalProperties:true}}}},
          responses:{"200":{description:"Policy decision"},"400":{description:"Invalid request"}}
        }
      }
    }
  });
}
