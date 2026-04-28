let selectedTopic="love";
let currentMemberId=null;
let currentReportId=null;
let currentOrderNo=null;

function selectTopic(topic){
  selectedTopic=topic;
  document.getElementById("formCard").scrollIntoView({behavior:"smooth"});
}

async function api(path,body){
  const res=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body||{})});
  const data=await res.json();
  if(!data.ok) throw new Error(data.message||data.error||"API_ERROR");
  return data;
}

async function createReport(){
  try{
    const name=document.getElementById("name").value.trim();
    const birthDate=document.getElementById("birthDate").value;
    const birthTime=document.getElementById("birthTime").value;
    const email=document.getElementById("email").value.trim();
    const lineUserId=document.getElementById("lineUserId").value.trim();
    if(!name||!birthDate){alert("請至少填姓名與出生日期");return;}
    if(email||lineUserId){
      const memberRes=await api("/api/member/upsert",{name,email,lineUserId});
      currentMemberId=memberRes.member.id;
    }
    const reportRes=await api("/api/report/create",{memberId:currentMemberId,name,birthDate,birthTime,topic:selectedTopic});
    const r=reportRes.report;
    currentReportId=r.id;
    document.getElementById("baziScore").textContent=r.bazi_score;
    document.getElementById("liuyaoScore").textContent=r.liuyao_score;
    document.getElementById("diffScore").textContent=r.diff_score;
    document.getElementById("freeSummary").textContent=r.free_summary;
    document.getElementById("resultCard").classList.remove("hidden");
    document.getElementById("resultCard").scrollIntoView({behavior:"smooth"});
  }catch(e){alert("建立報告失敗："+e.message);}
}

async function createOrder(){
  try{
    if(!currentReportId){alert("請先產生免費摘要");return;}
    const orderRes=await api("/api/order/create",{memberId:currentMemberId,reportId:currentReportId,amount:399,provider:"manual"});
    currentOrderNo=orderRes.order.order_no;
    document.getElementById("orderNo").textContent=currentOrderNo;
    document.getElementById("orderCard").classList.remove("hidden");
    document.getElementById("orderCard").scrollIntoView({behavior:"smooth"});
  }catch(e){alert("建立訂單失敗："+e.message);}
}

async function manualPaid(){
  try{
    const lineUserId=document.getElementById("lineUserId").value.trim();
    const paidRes=await api("/api/order/manual-paid",{orderNo:currentOrderNo,lineUserId});
    document.getElementById("unlockCode").value=paidRes.unlockCode;
    alert("已產生解鎖碼："+paidRes.unlockCode);
  }catch(e){alert("付款標記失敗："+e.message);}
}

async function verifyUnlock(){
  try{
    const code=document.getElementById("unlockCode").value.trim();
    if(!code){alert("請輸入解鎖碼");return;}
    const res=await api("/api/unlock/verify",{code});
    const r=res.report;
    const full=r.full_report||{};
    document.getElementById("fullReport").innerHTML=`
      <h3>🔮 核心結論｜${r.state}</h3><p>${full.core||""}</p>
      <h3>🎯 情境重點</h3><p>${full.focus||""}</p>
      <h3>🚀 行動策略</h3><p>${full.action||""}</p>
      <h3>🚫 避雷提醒</h3><p>${full.risk||""}</p>
      <h3>📅 時機判斷</h3><p>${full.timing||""}</p>
      <h3>👁 觀察重點</h3><p>${full.observation||""}</p>
      <h3>💡 一句話</h3><p><b>${full.quote||""}</b></p>
    `;
    document.getElementById("fullCard").classList.remove("hidden");
    document.getElementById("fullCard").scrollIntoView({behavior:"smooth"});
  }catch(e){alert("解鎖失敗："+e.message);}
}
