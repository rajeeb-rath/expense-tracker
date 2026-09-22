const CATEGORY_MAP = {
  "Food & Dining": ["Office Food","LK","Self","Home","Misc"],
  "Transportation": ["Fuel","Travel","Vehicle Maintenance","LK","Home","Misc"],
  "Health": ["Skincare","Medicine","Home","LK","Misc"],
  "Shopping": ["Self","Misc","Home","LK"],
  "Administrative": ["Loan","Services","Misc"],
  "Entertainment": ["Self","LK","Home"],
  "Misc": ["Home","LK","Misc","Exam Fee"],
  "Income": ["Salary","Investment"]
};
const CATEGORIES = Object.keys(CATEGORY_MAP);
const PAYMENTS = ["UPI","Cash","Debit Card","Credit Card","Bank Transfer","Other"];
const STORAGE_KEY = "personal_expense_tracker_v1";
let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let categoryChart, monthlyChart, reportCategoryChart;

const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n)||0);
const today = new Date();
const pad = n => String(n).padStart(2,"0");
const localDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
let selectedMonth = monthKey(today);

function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); renderAll(); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function type(){ return document.querySelector('input[name="type"]:checked').value; }
function formatDate(s){ return new Date(s+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); }
function selectedTransactions(){ return transactions.filter(t=>t.date.startsWith(selectedMonth)); }
function sum(arr){ return arr.reduce((a,b)=>a+Number(b.amount),0); }

function fillSelects(){
  $("category").innerHTML = CATEGORIES.map(c=>`<option>${c}</option>`).join("");
  updateSubCategoryOptions("Food & Dining", "");
  $("payment").innerHTML = PAYMENTS.map(p=>`<option>${p}</option>`).join("");
  $("categoryFilter").innerHTML = `<option value="all">All categories</option>` + CATEGORIES.map(c=>`<option>${c}</option>`).join("");
  updateSubCategoryFilter();
  $("paymentFilter").innerHTML = `<option value="all">All payments</option>` + PAYMENTS.map(p=>`<option>${p}</option>`).join("");
}
function updateSubCategoryOptions(category, selected=""){
  const subs = CATEGORY_MAP[category] || [];
  $("subcategory").innerHTML = subs.map(s=>`<option>${s}</option>`).join("");
  if(selected && subs.includes(selected)) $("subcategory").value = selected;
}
function updateSubCategoryFilter(selected="all"){
  const category = $("categoryFilter").value;
  const subs = category === "all" ? [...new Set(Object.values(CATEGORY_MAP).flat())] : (CATEGORY_MAP[category] || []);
  $("subcategoryFilter").innerHTML = `<option value="all">All sub-categories</option>` + subs.map(s=>`<option>${s}</option>`).join("");
  if(subs.includes(selected)) $("subcategoryFilter").value = selected;
}
function openModal(t=null){
  $("modal").classList.remove("hidden");
  $("modalTitle").textContent = t ? "Edit Transaction" : "Add Transaction";
  $("editId").value = t?.id || "";
  document.querySelector(`input[name="type"][value="${t?.type||"expense"}"]`).checked = true;
  $("date").value = t?.date || localDate(today);
  $("amount").value = t?.amount ?? "";
  $("description").value = t?.description || "";
  const category = t?.category || (t?.type === "income" ? "Income" : "Food & Dining");
  $("category").value = category;
  updateSubCategoryOptions(category, t?.subcategory || (category === "Income" ? "Salary" : ""));
  $("payment").value = t?.payment || "UPI";
  $("notes").value = t?.notes || "";
}
function closeModal(){ $("modal").classList.add("hidden"); $("transactionForm").reset(); }
function toast(msg){ $("toast").textContent=msg; $("toast").classList.add("show"); setTimeout(()=>$("toast").classList.remove("show"),2200); }

$("transactionForm").addEventListener("submit",e=>{
  e.preventDefault();
  const id=$("editId").value;
  const obj={id:id||uid(),type:type(),date:$("date").value,amount:Number($("amount").value),description:$("description").value.trim(),category:$("category").value,subcategory:$("subcategory").value,payment:$("payment").value,notes:$("notes").value.trim()};
  if(id) transactions=transactions.map(t=>t.id===id?obj:t); else transactions.push(obj);
  save(); closeModal(); toast(id?"Transaction updated":"Transaction added");
});
$("closeModal").onclick=closeModal; $("cancelBtn").onclick=closeModal;
$("addTopBtn").onclick=()=>openModal();
$("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});

function renderDashboard(){
  const ts=selectedTransactions(), inc=sum(ts.filter(t=>t.type==="income")), exp=sum(ts.filter(t=>t.type==="expense")), bal=inc-exp;
  $("balanceValue").textContent=money(bal); $("incomeValue").textContent=money(inc); $("expenseValue").textContent=money(exp);
  const rate=inc?Math.round((bal/inc)*100):0; $("savingsValue").textContent=`${rate}%`; $("savingsSub").textContent=inc?`${money(bal)} saved`:"No income recorded";
  $("monthPicker").value=selectedMonth;
  renderCategoryChart(ts); renderMonthlyChart(); renderRecent();
}
function renderRecent(){
  const rows=[...transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  $("recentList").innerHTML=rows.length?rows.map(t=>`<div class="transaction-row"><div class="transaction-info"><div class="transaction-name">${esc(t.description)}</div><div class="transaction-meta">${esc(t.category)} · ${esc(t.subcategory||"")} · ${formatDate(t.date)}</div></div><div class="amount ${t.type}">${t.type==="expense"?"−":"+"}${money(t.amount)}</div></div>`).join(""):`<div class="empty-state">No transactions yet.</div>`;
}
function renderCategoryChart(ts, target="categoryChart"){
  const expenses=ts.filter(t=>t.type==="expense"), map={};
  expenses.forEach(t=>{
    const sub=t.subcategory || "Uncategorized";
    const key=`${t.category} › ${sub}`;
    map[key]=(map[key]||0)+Number(t.amount);
  });
  const entries=Object.entries(map).sort((a,b)=>b[1]-a[1]);
  const labels=entries.map(([k])=>k), data=entries.map(([,v])=>v), canvas=$(target), empty=$(target==="categoryChart"?"chartEmpty":"reportCategoryEmpty");
  empty.classList.toggle("hidden",labels.length>0); canvas.classList.toggle("hidden",!labels.length);
  const cfg={type:"doughnut",data:{labels,datasets:[{data}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{boxWidth:10,font:{size:10}}},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${money(ctx.raw)}`}}}}};
  if(target==="categoryChart"){if(categoryChart)categoryChart.destroy();categoryChart=new Chart(canvas,cfg)}else{if(reportCategoryChart)reportCategoryChart.destroy();reportCategoryChart=new Chart(canvas,cfg)}
}
function renderMonthlyChart(){
  const labels=[], incomes=[], expenses=[];
  for(let i=5;i>=0;i--){const d=new Date(today.getFullYear(),today.getMonth()-i,1), key=monthKey(d);labels.push(d.toLocaleDateString("en-IN",{month:"short"}));const ts=transactions.filter(t=>t.date.startsWith(key));incomes.push(sum(ts.filter(t=>t.type==="income")));expenses.push(sum(ts.filter(t=>t.type==="expense")))}
  const has=incomes.some(Boolean)||expenses.some(Boolean);$("monthlyEmpty").classList.toggle("hidden",has);$("monthlyChart").classList.toggle("hidden",!has);
  if(monthlyChart)monthlyChart.destroy(); monthlyChart=new Chart($("monthlyChart"),{type:"bar",data:{labels,datasets:[{label:"Income",data:incomes},{label:"Expenses",data:expenses}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true,ticks:{callback:v=>"₹"+Number(v).toLocaleString("en-IN")}}},plugins:{legend:{position:"bottom",labels:{font:{size:10}}}}}});
}
function renderTransactions(){
  const q=$("searchInput").value.toLowerCase(), tf=$("typeFilter").value, cf=$("categoryFilter").value, sf=$("subcategoryFilter").value, pf=$("paymentFilter").value;
  const list=[...transactions].filter(t=>(tf==="all"||t.type===tf)&&(cf==="all"||t.category===cf)&&(sf==="all"||t.subcategory===sf)&&(pf==="all"||t.payment===pf)&&(!q||`${t.description} ${t.category} ${t.subcategory||""} ${t.payment} ${t.notes}`.toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date));
  $("tableEmpty").classList.toggle("hidden",list.length>0);
  $("transactionTable").innerHTML=list.map(t=>`<tr><td>${formatDate(t.date)}</td><td><strong>${esc(t.description)}</strong>${t.notes?`<div class="transaction-meta">${esc(t.notes)}</div>`:""}</td><td><span class="pill">${esc(t.category)}</span><div class="transaction-meta">${esc(t.subcategory||"")}</div></td><td>${esc(t.payment)}</td><td><span class="pill ${t.type}">${t.type}</span></td><td class="amount ${t.type}">${t.type==="expense"?"−":"+"}${money(t.amount)}</td><td class="row-actions"><button onclick="editTransaction('${t.id}')">Edit</button><button onclick="deleteTransaction('${t.id}')">Delete</button></td></tr>`).join("");
}
function renderReports(){
  const exp=transactions.filter(t=>t.type==="expense"), inc=transactions.filter(t=>t.type==="income");
  $("allIncome").textContent=money(sum(inc));$("allExpense").textContent=money(sum(exp));$("allCount").textContent=transactions.length;$("avgExpense").textContent=money(exp.length?sum(exp)/exp.length:0);
  renderCategoryChart(transactions,"reportCategoryChart");
  const map={};exp.forEach(t=>map[t.payment]=(map[t.payment]||0)+Number(t.amount));const max=Math.max(...Object.values(map),1);
  $("paymentBreakdown").innerHTML=Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="breakdown-row"><span>${esc(k)}</span><div class="bar"><i style="width:${v/max*100}%"></i></div><strong>${money(v)}</strong></div>`).join("")||`<div class="empty-state">No expense data.</div>`;
}
function renderAll(){renderDashboard();renderTransactions();renderReports();}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
window.editTransaction=id=>openModal(transactions.find(t=>t.id===id));
window.deleteTransaction=id=>{if(confirm("Delete this transaction?")){transactions=transactions.filter(t=>t.id!==id);save();toast("Transaction deleted")}};

document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
document.querySelectorAll("[data-view-link]").forEach(b=>b.onclick=()=>switchView("transactions"));
function switchView(v){document.querySelectorAll(".view").forEach(x=>x.classList.add("hidden"));$(`${v}View`).classList.remove("hidden");document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view===v));$("pageTitle").textContent=v[0].toUpperCase()+v.slice(1);if(v==="reports")renderReports()}
$("monthPicker").onchange=e=>{selectedMonth=e.target.value;renderDashboard()};
$("prevMonth").onclick=()=>{const d=new Date(selectedMonth+"-01");d.setMonth(d.getMonth()-1);selectedMonth=monthKey(d);renderDashboard()};
$("nextMonth").onclick=()=>{const d=new Date(selectedMonth+"-01");d.setMonth(d.getMonth()+1);selectedMonth=monthKey(d);renderDashboard()};
$("currentMonthBtn").onclick=()=>{selectedMonth=monthKey(today);renderDashboard()};
$("category").addEventListener("change", e=>updateSubCategoryOptions(e.target.value));
$("categoryFilter").addEventListener("change", ()=>{ updateSubCategoryFilter(); renderTransactions(); });
$("subcategoryFilter").addEventListener("input", renderTransactions);
document.querySelectorAll('input[name="type"]').forEach(r=>r.addEventListener("change",()=>{
  if(type()==="income"){
    $("category").value="Income";
    updateSubCategoryOptions("Income");
  } else if($("category").value==="Income"){
    $("category").value="Food & Dining";
    updateSubCategoryOptions("Food & Dining");
  }
}));
["searchInput","typeFilter","paymentFilter"].forEach(id=>$(id).addEventListener("input",renderTransactions));
$("themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("expense_theme",document.body.classList.contains("dark")?"dark":"light");$("themeBtn").querySelector("span").textContent=document.body.classList.contains("dark")?"Light Mode":"Dark Mode"};
if(localStorage.getItem("expense_theme")==="dark"){$("themeBtn").click()}
$("mobileMenuBtn").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");

$("exportCsvBtn").onclick=()=>{
  const header=["Date","Type","Description","Category","Sub-Category","Payment Method","Amount","Notes"];
  const rows=transactions.map(t=>[t.date,t.type,t.description,t.category,t.subcategory||"",t.payment,t.amount,t.notes].map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(","));
  download(new Blob([[header.join(","),...rows].join("\n")],{type:"text/csv"}),`expenses-${localDate(today)}.csv`);toast("CSV exported");
};
$("backupBtn").onclick=()=>{download(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),transactions},null,2)],{type:"application/json"}),`expense-backup-${localDate(today)}.json`);toast("Backup created")};
$("restoreInput").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);if(!Array.isArray(data.transactions))throw 0;if(confirm(`Restore ${data.transactions.length} transactions? This will replace current data.`)){transactions=data.transactions;save();toast("Backup restored")}}catch{alert("Invalid backup file.")}e.target.value=""};r.readAsText(f)};
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href)}

transactions = transactions.map(t => ({...t, subcategory: t.subcategory || (CATEGORY_MAP[t.category]?.[0] || "")}));
fillSelects();
renderAll();
