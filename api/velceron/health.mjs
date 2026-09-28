export default function handler(req,res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  return res.status(200).json({ ok:true, service:"Velceron Agent Gate", version:"0.2.0", price_usd_per_evaluation:0.20, payments:"demo_until_live_x402" });
}
