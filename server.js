require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { createClient } = require("@supabase/supabase-js");
const { nanoid } = require("nanoid");
const path = require("path");

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function requireDb(res){
  if(!supabase){
    res.status(500).json({ok:false,error:"SUPABASE_NOT_CONFIGURED"});
    return false;
  }
  return true;
}

function calcState(diff){
  if(diff < -80) return "卡住期";
  if(diff > 80) return "爆發期";
  return "穩定期";
}

function generateScores(seedText=""){
  let hash=0;
  for(const ch of seedText) hash=((hash<<5)-hash+ch.charCodeAt(0))|0;
  const base=Math.abs(hash);
  const baziScore=250+(base%260);
  const liuyaoScore=180+((base>>3)%360);
  const totalScore=Math.round(baziScore*.6+liuyaoScore*.4);
  const diffScore=liuyaoScore-baziScore;
  return {baziScore,liuyaoScore,totalScore,diffScore,state:calcState(diffScore)};
}

function topicCopy(topic,state){
  const topicName={love:"感情",work:"工作",money:"財務",general:"綜合"}[topic]||"綜合";
  const stateMap={
    "卡住期":{
      core:"你現在不是沒有能力，而是當下狀態沒有跟上人生底盤。此時最怕硬衝，容易在焦慮中做錯決定。",
      action:"先縮小決策範圍，只做一個低風險的小測試。不要一次投入太多金錢、情緒或承諾。",
      risk:"容易因為急著改變，而聽錯建議、做錯選擇，或把短期情緒當成長期答案。",
      timing:"3天內保守觀察，7天後小測試，14天後再決定是否放大。"
    },
    "爆發期":{
      core:"你現在進入能量放大期，代表機會、靈感或外部助力正在出現。",
      action:"可以主動出擊，但請先小規模驗證，不要因為一時順利就全面加碼。",
      risk:"容易過度自信，忽略細節與長期風險。",
      timing:"7天內適合啟動，14天內可放大，30天內建立成果紀錄。"
    },
    "穩定期":{
      core:"你目前處於穩定區間，適合持續推進與累積成果。",
      action:"不用大幅改變方向，重點是維持節奏、優化流程、穩定輸出。",
      risk:"容易因為太穩而拖延，錯過可以推進的機會。",
      timing:"持續行動，每週檢查成果，30天內做一次策略微調。"
    }
  }[state];

  const context={
    love:{focus:"感情重點：先不要急著逼答案。你需要看的是互動是否穩定，而不是單次訊息冷熱。",observation:"觀察對方是否願意持續投入時間、回應與實際行動。"},
    work:{focus:"工作重點：先判斷這個機會是否能累積長期籌碼，而不是只看短期薪資或情緒。",observation:"觀察這件事是否能讓你變得更有選擇權。"},
    money:{focus:"財務重點：不要急著追高或衝動投入。先確認風險承受度與現金流。",observation:"觀察這個決策最壞情況你能不能承受。"},
    general:{focus:"綜合重點：你現在要做的是把狀態穩住，再選方向。",observation:"觀察哪個選擇會讓你更穩，而不是更焦慮。"}
  }[topic]||{};

  return {
    topicName,
    freeSummary:`你目前在「${topicName}」議題上屬於「${state}」。${stateMap.core}`,
    fullReport:{
      core:stateMap.core,
      focus:context.focus,
      action:stateMap.action,
      risk:stateMap.risk,
      timing:stateMap.timing,
      observation:context.observation,
      quote:state==="卡住期"?"你不是做不到，而是現在不適合用蠻力。":state==="爆發期"?"機會來時要動，但不要失去節奏。":"穩定不是停下來，而是用對節奏前進。"
    }
  };
}

function makeOrderNo(){return "BE"+Date.now()+nanoid(5).toUpperCase();}
function makeUnlockCode(){return "ENERGY-"+nanoid(8).toUpperCase();}

async function pushLine(lineUserId,text){
  if(!lineUserId) return {skipped:true};
  if(!process.env.LINE_CHANNEL_ACCESS_TOKEN){
    console.log("[LINE MOCK]",lineUserId,text);
    return {mock:true};
  }
  const res=await fetch("https://api.line.me/v2/bot/message/push",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`},
    body:JSON.stringify({to:lineUserId,messages:[{type:"text",text}]})
  });
  if(!res.ok) throw new Error(await res.text());
  return {ok:true};
}

app.post("/api/member/upsert",async(req,res)=>{
  if(!requireDb(res)) return;
  const {name,email,phone,lineUserId}=req.body;
  if(!email&&!lineUserId) return res.status(400).json({ok:false,error:"EMAIL_OR_LINE_REQUIRED"});
  const payload={name:name||null,email:email||null,phone:phone||null,line_user_id:lineUserId||null,updated_at:new Date().toISOString()};
  const {data,error}=await supabase.from("members").upsert(payload,{onConflict:lineUserId?"line_user_id":"email"}).select().single();
  if(error) return res.status(500).json({ok:false,error:error.message});
  res.json({ok:true,member:data});
});

app.post("/api/report/create",async(req,res)=>{
  if(!requireDb(res)) return;
  const {memberId,name,birthDate,birthTime,topic="general"}=req.body;
  const scores=generateScores(`${name}|${birthDate}|${birthTime}|${topic}|${Date.now()}`);
  const copy=topicCopy(topic,scores.state);
  const payload={
    member_id:memberId||null,topic,name,birth_date:birthDate||null,birth_time:birthTime||null,
    bazi_score:scores.baziScore,liuyao_score:scores.liuyaoScore,total_score:scores.totalScore,diff_score:scores.diffScore,
    state:scores.state,free_summary:copy.freeSummary,full_report:copy.fullReport,is_paid:false
  };
  const {data,error}=await supabase.from("reports").insert(payload).select().single();
  if(error) return res.status(500).json({ok:false,error:error.message});
  res.json({ok:true,report:data});
});

app.post("/api/order/create",async(req,res)=>{
  if(!requireDb(res)) return;
  const {memberId,reportId,product="full_report",amount=399,provider="manual"}=req.body;
  if(!reportId) return res.status(400).json({ok:false,error:"REPORT_ID_REQUIRED"});
  const orderNo=makeOrderNo();
  const {data,error}=await supabase.from("orders").insert({
    order_no:orderNo,member_id:memberId||null,report_id:reportId,product,amount,provider,status:"pending"
  }).select().single();
  if(error) return res.status(500).json({ok:false,error:error.message});
  res.json({ok:true,order:data,paymentUrl:`/pay.html?orderNo=${orderNo}`});
});

app.post("/api/order/manual-paid",async(req,res)=>{
  if(!requireDb(res)) return;
  const {orderNo,lineUserId}=req.body;
  const {data:order,error:orderErr}=await supabase.from("orders").select("*").eq("order_no",orderNo).single();
  if(orderErr||!order) return res.status(404).json({ok:false,error:"ORDER_NOT_FOUND"});
  const code=makeUnlockCode();
  const {data:unlock,error:unlockErr}=await supabase.from("unlock_codes").insert({
    code,order_id:order.id,report_id:order.report_id,member_id:order.member_id,product:order.product
  }).select().single();
  if(unlockErr) return res.status(500).json({ok:false,error:unlockErr.message});
  await supabase.from("orders").update({status:"paid",paid_at:new Date().toISOString()}).eq("id",order.id);
  await supabase.from("reports").update({is_paid:true}).eq("id",order.report_id);
  if(lineUserId) await pushLine(lineUserId,`付款成功，你的完整報告解鎖碼是：${code}\n請回到報告頁輸入即可查看完整內容。`);
  res.json({ok:true,unlockCode:code,unlock});
});

app.post("/api/unlock/verify",async(req,res)=>{
  if(!requireDb(res)) return;
  const {code}=req.body;
  const {data:unlock,error}=await supabase.from("unlock_codes").select("*, reports(*)").eq("code",code).single();
  if(error||!unlock) return res.status(404).json({ok:false,error:"INVALID_CODE"});
  await supabase.from("unlock_codes").update({used:true,used_at:new Date().toISOString()}).eq("id",unlock.id);
  res.json({ok:true,report:unlock.reports});
});

app.post("/api/payment/ecpay/callback",async(req,res)=>{console.log("ECPay callback",req.body);res.send("1|OK");});
app.post("/api/payment/newebpay/callback",async(req,res)=>{console.log("NewebPay callback",req.body);res.send("OK");});
app.get("/health",(req,res)=>res.json({ok:true}));

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

const port=process.env.PORT||3000;
app.listen(port,()=>console.log(`Breath Energy brand site running on http://localhost:${port}`));
