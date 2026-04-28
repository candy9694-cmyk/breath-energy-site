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
app.use(express.static(__dirname));


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

const triName = {1:"乾",2:"兌",3:"離",4:"震",5:"巽",6:"坎",7:"艮",8:"坤"};
const triSym  = {1:"☰",2:"☱",3:"☲",4:"☳",5:"☴",6:"☵",7:"☶",8:"☷"};
const triElem = {1:"金",2:"金",3:"火",4:"木",5:"木",6:"水",7:"土",8:"土"};
const yaoName = ["初爻","二爻","三爻","四爻","五爻","上爻"];
const guaBin = {1:[1,1,1],2:[0,1,1],3:[1,0,1],4:[0,0,1],5:[1,1,0],6:[0,1,0],7:[1,0,0],8:[0,0,0]};
const valToGua = {0:8,1:4,2:6,3:2,4:7,5:3,6:5,7:1};
const GUA64 = {
  "1-1":"乾為天","1-2":"天澤履","1-3":"天火同人","1-4":"天雷無妄","1-5":"天風姤","1-6":"天水訟","1-7":"天山遯","1-8":"天地否",
  "2-1":"澤天夬","2-2":"兌為澤","2-3":"澤火革","2-4":"澤雷隨","2-5":"澤風大過","2-6":"澤水困","2-7":"澤山咸","2-8":"澤地萃",
  "3-1":"火天大有","3-2":"火澤睽","3-3":"離為火","3-4":"火雷噬嗑","3-5":"火風鼎","3-6":"火水未濟","3-7":"火山旅","3-8":"火地晉",
  "4-1":"雷天大壯","4-2":"雷澤歸妹","4-3":"雷火豐","4-4":"震為雷","4-5":"雷風恆","4-6":"雷水解","4-7":"雷山小過","4-8":"雷地豫",
  "5-1":"風天小畜","5-2":"風澤中孚","5-3":"風火家人","5-4":"風雷益","5-5":"巽為風","5-6":"風水渙","5-7":"風山漸","5-8":"風地觀",
  "6-1":"水天需","6-2":"水澤節","6-3":"水火既濟","6-4":"水雷屯","6-5":"水風井","6-6":"坎為水","6-7":"水山蹇","6-8":"水地比",
  "7-1":"山天大畜","7-2":"山澤損","7-3":"山火賁","7-4":"山雷頤","7-5":"山風蠱","7-6":"山水蒙","7-7":"艮為山","7-8":"山地剝",
  "8-1":"地天泰","8-2":"地澤臨","8-3":"地火明夷","8-4":"地雷復","8-5":"地風升","8-6":"地水師","8-7":"地山謙","8-8":"坤為地"
};

function getBits(upperNum, lowerNum){ return [...guaBin[lowerNum], ...guaBin[upperNum]]; }

function bitsToGua(bits){
  const lowerVal = bits[0] + bits[1]*2 + bits[2]*4;
  const upperVal = bits[3] + bits[4]*2 + bits[5]*4;
  return { lower: valToGua[lowerVal], upper: valToGua[upperVal] };
}

function relationScore(a, b){
  if(a === b) return 80;
  const gen = {木:"火",火:"土",土:"金",金:"水",水:"木"};
  const ctrl = {木:"土",土:"水",水:"火",火:"金",金:"木"};
  if(gen[a] === b) return 60;
  if(gen[b] === a) return 100;
  if(ctrl[a] === b) return 50;
  if(ctrl[b] === a) return -80;
  return 0;
}

function getSolarTermMonth(dateObj){
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();
  const cutoff = {1:6,2:4,3:6,4:5,5:6,6:6,7:7,8:8,9:8,10:8,11:7,12:7};
  let termMonth = m;
  if(d < cutoff[m]) termMonth = m - 1;
  if(termMonth <= 0) termMonth = 12;
  return termMonth;
}

function monthElement(termMonth){
  const map = {1:"木",2:"木",3:"土",4:"火",5:"火",6:"土",7:"金",8:"金",9:"土",10:"水",11:"水",12:"土"};
  return map[termMonth] || "土";
}

function calcSix({upperNum, lowerNum, m, month, isCoin=false, bits, moving=[]}){
  const upEl = triElem[upperNum];
  const lowEl = triElem[lowerNum];
  const mEl = monthElement(month);
  const f1 = relationScore(mEl, upEl);
  const f2 = bits[m-1] ? 80 : -40;
  const f3 = relationScore(upEl, lowEl);
  const f4 = moving.length ? moving.reduce((s,i)=>s+i*35,0) : m*35;
  const yangCount = bits.reduce((a,b)=>a+b,0);
  const f5 = yangCount * 40;
  const f6 = isCoin ? moving.length * 25 : 0;
  const sum = f1 + f2 + f3 + f4 + f5 + f6;
  let finalVal = Math.round(200 + sum * 0.22);
  finalVal = Math.max(0, Math.min(700, finalVal));
  return {f1,f2,f3,f4,f5,f6,sum,finalVal,upEl,lowEl,mEl,yangCount};
}

function calcLiuYao({name="", birthDate="", birthTime="", topic="general"}){
  const now = new Date();
  const dateKey = now.toISOString().slice(0,10);
  const seedText = `${name}|${birthDate}|${birthTime}|${topic}|${dateKey}`;
  let hash = 0;
  for(const ch of seedText) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  const base = Math.abs(hash);
  const n1 = (base % 999) + 1;
  const n2 = ((base >> 3) % 999) + 1;
  const n3 = ((base >> 6) % 999) + 1;
  const upperNum = n1 % 8 || 8;
  const lowerNum = n2 % 8 || 8;
  const m = n3 % 6 || 6;
  const bits = getBits(upperNum, lowerNum);
  const moving = [m];
  const newBits = [...bits];
  newBits[m-1] ^= 1;
  const changed = bitsToGua(newBits);
  const termMonth = getSolarTermMonth(now);
  const six = calcSix({upperNum, lowerNum, m, month:termMonth, bits, moving});
  return {
    score: six.finalVal, upperNum, lowerNum, movingYao: m, movingText: yaoName[m-1],
    benName: GUA64[`${upperNum}-${lowerNum}`],
    bianName: GUA64[`${changed.upper}-${changed.lower}`],
    benSym: triSym[upperNum] + triSym[lowerNum],
    bianSym: triSym[changed.upper] + triSym[changed.lower],
    detail: six
  };
}

function generateScores({name="", birthDate="", birthTime="", topic="general"} = {}){
  const seedText = `${name}|${birthDate}|${birthTime}`;
  let hash = 0;
  for(const ch of seedText) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  const base = Math.abs(hash);
  const baziScore = 250 + (base % 260);
  const liuyao = calcLiuYao({name,birthDate,birthTime,topic});
  const liuyaoScore = liuyao.score;
  const totalScore = Math.round(baziScore * 0.6 + liuyaoScore * 0.4);
  const diffScore = liuyaoScore - baziScore;
  return {baziScore, liuyaoScore, totalScore, diffScore, state: calcState(diffScore), liuyao};
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
  const scores=generateScores({name,birthDate,birthTime,topic});
  const copy=topicCopy(topic,scores.state);
  const payload={
    member_id:memberId||null,topic,name,birth_date:birthDate||null,birth_time:birthTime||null,
    bazi_score:scores.baziScore,liuyao_score:scores.liuyaoScore,total_score:scores.totalScore,diff_score:scores.diffScore,
    state:scores.state,free_summary:copy.freeSummary,full_report:{...copy.fullReport, liuyao:scores.liuyao},is_paid:false
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

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/health",(req,res)=>res.json({ok:true}));


app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(__dirname + "/index.html");
});

const port=process.env.PORT||3000;
app.listen(port,()=>console.log(`Breath Energy brand site running on http://localhost:${port}`));
