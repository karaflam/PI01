/* ============================================
   Agriculture Intelligente — App Logic
   ============================================ */

// ── AUTH
const USERS = {
  admin:  { password: 'admin123', role: 'admin' },
  viewer: { password: 'view123',  role: 'viewer' }
};
let currentUser = null;

function doLogin() {
  const u = document.getElementById('username').value.trim();
  const p = document.getElementById('password').value;
  const err = document.getElementById('login-error');
  if (USERS[u] && USERS[u].password === p) {
    currentUser = { name: u, role: USERS[u].role };
    err.classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    initApp();
  } else {
    err.classList.remove('hidden');
    document.getElementById('password').value = '';
  }
}

function doLogout() {
  currentUser = null;
  stopSimulation();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  historyLog = []; alerts = []; simTick = 0;
}

// ── STATE
let sensorData = { humidity: 0, temp: 0, co2: 0, light: 0, water: 0 };
let thresholds  = { humidity: 30, temp: 35, co2: 1000, light: 200, water: 20 };
let actuators   = { pump: false, fan: false, light: false };
let autoMode    = true;
let historyLog  = [];
let alerts      = [];
let simInterval = null;
let sensorIntervalMs = 3000;
let simTick = 0;

const MAX_POINTS = 20;
const chartHistory = { labels: [], humidity: [], temp: [], co2: [], light: [], water: [] };
const miniHistory  = { humidity: [], temp: [], co2: [], light: [], water: [] };

// ── I18N
let lang = 'fr';
const STRINGS = {
  fr: {
    nav_dashboard:'Tableau de bord',nav_sensors:'Capteurs',nav_actuators:'Actionneurs',
    nav_history:'Historique',nav_settings:'Paramètres',
    kpi_humidity:'Humidité sol',kpi_temp:'Température',kpi_co2:'CO₂',kpi_light:'Luminosité',kpi_water:'Réservoir',
    sensor_humidity:'Humidité du sol — YL-69',sensor_temp:'Température — DHT22',
    sensor_co2:'CO₂ — SEN0159',sensor_light:'Luminosité — BH1750',sensor_water:"Niveau d'eau",
    pump:"Pompe d'irrigation",fan:'Ventilateur',lighting:'Éclairage',
    chart_history:'Évolution en temps réel',actuators_title:'Commande actionneurs',
    alerts_title:'Alertes actives',no_alerts:'Aucune alerte active',last_update:'Mise à jour :',
    col_time:'Heure',col_type:'Type',col_desc:'Description',col_value:'Valeur',
    threshold:'Seuil min :',threshold_max:'Seuil max :',
    settings_thresholds:"Seuils d'alerte",settings_system:'Système',settings_account:'Compte',
    settings_auto:'Automatisation',settings_lang:'Langue',settings_interval:'Intervalle mesures (s)',
    on:'ALLUMÉ',off:'ÉTEINT',ok:'OK',warn:'AVERT.',danger:'DANGER',
  },
  en: {
    nav_dashboard:'Dashboard',nav_sensors:'Sensors',nav_actuators:'Actuators',
    nav_history:'History',nav_settings:'Settings',
    kpi_humidity:'Soil humidity',kpi_temp:'Temperature',kpi_co2:'CO₂',kpi_light:'Light',kpi_water:'Water tank',
    sensor_humidity:'Soil humidity — YL-69',sensor_temp:'Temperature — DHT22',
    sensor_co2:'CO₂ — SEN0159',sensor_light:'Light — BH1750',sensor_water:'Water level',
    pump:'Irrigation pump',fan:'Fan',lighting:'Lighting',
    chart_history:'Real-time evolution',actuators_title:'Actuator control',
    alerts_title:'Active alerts',no_alerts:'No active alerts',last_update:'Last update:',
    col_time:'Time',col_type:'Type',col_desc:'Description',col_value:'Value',
    threshold:'Min threshold:',threshold_max:'Max threshold:',
    settings_thresholds:'Alert thresholds',settings_system:'System',settings_account:'Account',
    settings_auto:'Automation',settings_lang:'Language',settings_interval:'Measure interval (s)',
    on:'ON',off:'OFF',ok:'OK',warn:'WARN',danger:'DANGER',
  }
};
function tr(key) { return (STRINGS[lang]&&STRINGS[lang][key])||key; }
function setLang(l) {
  lang=l;
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k=el.getAttribute('data-i18n');
    if(STRINGS[l][k])el.textContent=STRINGS[l][k];
  });
  updateActLabels();
}

// ── CHARTS
let mainChart=null;
const miniCharts={};

function initCharts(){
  Chart.defaults.color='#4a6a4a';
  Chart.defaults.borderColor='#2a3a2a';
  Chart.defaults.font.family="'IBM Plex Mono',monospace";
  Chart.defaults.font.size=10;
  const ctx=document.getElementById('mainChart').getContext('2d');
  mainChart=new Chart(ctx,{
    type:'line',
    data:{labels:[],datasets:[
      {label:'Humidité (%)',data:[],borderColor:'#60a5fa',backgroundColor:'rgba(96,165,250,0.07)',tension:0.4,pointRadius:2,borderWidth:2},
      {label:'Temp. (°C)',data:[],borderColor:'#f87171',backgroundColor:'rgba(248,113,113,0.07)',tension:0.4,pointRadius:2,borderWidth:2},
      {label:'CO₂ /100',data:[],borderColor:'#fbbf24',backgroundColor:'rgba(251,191,36,0.05)',tension:0.4,pointRadius:2,borderWidth:2},
    ]},
    options:{
      responsive:true,maintainAspectRatio:false,animation:{duration:400},
      plugins:{legend:{labels:{boxWidth:12,padding:14}}},
      scales:{
        x:{grid:{color:'rgba(42,58,42,0.4)'},ticks:{maxTicksLimit:8}},
        y:{grid:{color:'rgba(42,58,42,0.4)'},beginAtZero:false,min:0,max:110}
      }
    }
  });
  const mc={'humidity':'#60a5fa','temp':'#f87171','co2':'#fbbf24','light':'#4ade80','water':'#a78bfa'};
  Object.keys(mc).forEach(key=>{
    const canvas=document.getElementById('mc-'+key);
    if(!canvas)return;
    miniCharts[key]=new Chart(canvas.getContext('2d'),{
      type:'line',
      data:{labels:[],datasets:[{data:[],borderColor:mc[key],backgroundColor:mc[key]+'18',tension:0.4,pointRadius:0,borderWidth:1.5,fill:true}]},
      options:{responsive:false,maintainAspectRatio:false,animation:{duration:300},
        plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:false,beginAtZero:false}}}
    });
    canvas.style.height='60px';
    canvas.style.width='100%';
  });
}

function updateCharts(){
  if(!mainChart)return;
  const now=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  if(chartHistory.labels.length>=MAX_POINTS){
    chartHistory.labels.shift();
    ['humidity','temp','co2','light','water'].forEach(k=>chartHistory[k].shift());
  }
  chartHistory.labels.push(now);
  chartHistory.humidity.push(+sensorData.humidity.toFixed(1));
  chartHistory.temp.push(+sensorData.temp.toFixed(1));
  chartHistory.co2.push(+(sensorData.co2/100).toFixed(1));
  chartHistory.light.push(+(sensorData.light/10).toFixed(1));
  chartHistory.water.push(+sensorData.water.toFixed(1));
  mainChart.data.labels=[...chartHistory.labels];
  mainChart.data.datasets[0].data=[...chartHistory.humidity];
  mainChart.data.datasets[1].data=[...chartHistory.temp];
  mainChart.data.datasets[2].data=[...chartHistory.co2];
  mainChart.update('none');
  ['humidity','temp','co2','light','water'].forEach(key=>{
    if(!miniCharts[key])return;
    const raw=key==='co2'?sensorData[key]/100:key==='light'?sensorData[key]/10:sensorData[key];
    if(miniHistory[key].length>=MAX_POINTS)miniHistory[key].shift();
    miniHistory[key].push(+raw.toFixed(1));
    miniCharts[key].data.labels=miniHistory[key].map((_,i)=>i);
    miniCharts[key].data.datasets[0].data=[...miniHistory[key]];
    miniCharts[key].update('none');
  });
}

// ── SIMULATION (replaces ESP32/MQTT in browser demo)
function simulateSensors(){
  simTick++;
  sensorData.humidity=clamp(40+20*Math.sin(simTick*0.08)+rand(-5,5),0,100);
  sensorData.temp=clamp(24+10*Math.sin(simTick*0.05)+rand(-2,2),0,60);
  sensorData.co2=clamp(600+400*Math.sin(simTick*0.06)+rand(-50,50),200,2000);
  sensorData.light=clamp(500+400*Math.sin(simTick*0.04)+rand(-40,40),0,2000);
  sensorData.water=clamp(70-simTick*0.25+rand(-2,2),5,100);
  if(sensorData.water<=5)simTick=0;
  updateUI();
  if(autoMode)runAutomation();
  checkAlerts();
  logSensorEntry();
  updateCharts();
}
function rand(a,b){return a+Math.random()*(b-a);}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function startSimulation(){if(simInterval)clearInterval(simInterval);simInterval=setInterval(simulateSensors,sensorIntervalMs);simulateSensors();}
function stopSimulation(){if(simInterval){clearInterval(simInterval);simInterval=null;}}
function setSensorInterval(s){sensorIntervalMs=Math.max(1,parseInt(s))*1000;if(simInterval)startSimulation();}

// ── AUTOMATION
function runAutomation(){
  const pumpSh=sensorData.humidity<thresholds.humidity&&sensorData.water>5;
  const fanSh=sensorData.temp>thresholds.temp||sensorData.co2>thresholds.co2;
  const lightSh=sensorData.light<thresholds.light;
  [['pump',pumpSh],['fan',fanSh],['light',lightSh]].forEach(([k,sh])=>{
    if(sh!==actuators[k]){
      actuators[k]=sh;
      const names={pump:"Pompe irrigation",fan:"Ventilateur",light:"Éclairage"};
      addHistoryEntry('actuator',names[k],sh?'Activé (auto)':'Désactivé (auto)','');
    }
  });
  syncAllToggles();updateActLabels();updateActCards();
}

// ── ALERTS
let lastAlertTime={};
function checkAlerts(){
  const now=Date.now();
  function maybeAlert(key,cond,label,msg,level){
    if(cond&&(!lastAlertTime[key]||now-lastAlertTime[key]>15000)){
      lastAlertTime[key]=now;
      alerts.unshift({id:key+now,key,label,msg,level,time:timestamp()});
      if(alerts.length>30)alerts.pop();
      addHistoryEntry('alert',label,msg,'');
    }
    if(!cond)delete lastAlertTime[key];
  }
  maybeAlert('humidity',sensorData.humidity<thresholds.humidity,'💧 Humidité critique',`Sol: ${sensorData.humidity.toFixed(0)}% < seuil ${thresholds.humidity}%`,'warn');
  maybeAlert('temp',sensorData.temp>thresholds.temp,'🌡 Surchauffe',`Temp: ${sensorData.temp.toFixed(1)}°C > seuil ${thresholds.temp}°C`,'danger');
  maybeAlert('co2',sensorData.co2>thresholds.co2,'🌫 CO₂ élevé',`CO₂: ${sensorData.co2.toFixed(0)} ppm > seuil ${thresholds.co2} ppm`,'warn');
  maybeAlert('light',sensorData.light<thresholds.light,'☀ Luminosité faible',`Lux: ${sensorData.light.toFixed(0)} < seuil ${thresholds.light}`,'info');
  maybeAlert('water',sensorData.water<thresholds.water,'🪣 Réservoir bas',`Eau: ${sensorData.water.toFixed(0)}% < seuil ${thresholds.water}%`,'danger');
  renderAlertPanel();
  const count=Object.keys(lastAlertTime).length;
  const badge=document.getElementById('alert-badge');
  badge.textContent=count;badge.setAttribute('data-count',count);
}

function renderAlertPanel(){
  const list=document.getElementById('alert-list');
  if(alerts.length===0){list.innerHTML=`<p class="no-alerts">${tr('no_alerts')}</p>`;return;}
  list.innerHTML=alerts.slice(0,10).map(a=>`
    <div class="alert-item ${a.level}">
      <div class="alert-item-title">${a.label}</div>
      <div style="font-size:12px;color:#c0d0c0;margin:2px 0">${a.msg}</div>
      <div class="alert-item-time">${a.time}</div>
    </div>`).join('');
}

// ── UI UPDATE
function updateUI(){
  const s=sensorData,th=thresholds;
  setKPI('humidity',s.humidity,'%',s.humidity/100,s.humidity<th.humidity?'danger':'ok');
  setKPI('temp',s.temp,'°C',s.temp/50,s.temp>th.temp?'danger':s.temp>th.temp*0.85?'warn':'ok');
  setKPI('co2',s.co2,'ppm',s.co2/2000,s.co2>th.co2?'danger':s.co2>th.co2*0.8?'warn':'ok');
  setKPI('light',s.light,'lux',s.light/2000,s.light<th.light?'warn':'ok');
  setKPI('water',s.water,'%',s.water/100,s.water<th.water?'danger':s.water<th.water*2?'warn':'ok');
  document.getElementById('sv-humidity').textContent=s.humidity.toFixed(1)+' %';
  document.getElementById('sv-temp').textContent=s.temp.toFixed(1)+' °C';
  document.getElementById('sv-co2').textContent=s.co2.toFixed(0)+' ppm';
  document.getElementById('sv-light').textContent=s.light.toFixed(0)+' lux';
  document.getElementById('sv-water').textContent=s.water.toFixed(0)+' %';
  document.getElementById('last-update-time').textContent=new Date().toLocaleTimeString('fr-FR');
}

function setKPI(key,value,unit,ratio,status){
  const ve=document.getElementById('val-'+key);
  const be=document.getElementById('bar-'+key);
  const ce=document.getElementById('chip-'+key);
  const card=document.getElementById('kpi-'+key);
  const sc=document.getElementById('sc-'+key);
  if(ve)ve.innerHTML=Math.round(value)+`<small>${unit}</small>`;
  if(be){be.style.width=(ratio*100).toFixed(1)+'%';be.style.background=status==='danger'?'#f87171':status==='warn'?'#fbbf24':'#4ade80';}
  if(ce){ce.textContent=tr(status);ce.className='kpi-chip'+(status!=='ok'?' '+status:'');}
  if(card)card.className='kpi-card'+(status!=='ok'?' '+status:'');
  if(sc)sc.className='sensor-card'+(status!=='ok'?' '+status:'');
}

function updateActLabels(){
  ['pump','fan','light'].forEach(key=>{
    const lbl=document.getElementById('lbl-'+key);
    if(lbl){lbl.textContent=actuators[key]?tr('on'):tr('off');lbl.className='act-st'+(actuators[key]?' on':'');}
  });
}

function updateActCards(){
  ['pump','fan','light'].forEach(key=>{
    const se=document.getElementById('state-'+key);
    const ce=document.getElementById('card-'+key);
    if(se){se.textContent=actuators[key]?tr('on'):tr('off');se.className='ac-state'+(actuators[key]?' on':'');}
    if(ce)ce.className='act-card'+(actuators[key]?' on':'');
  });
}

function syncAllToggles(){
  ['pump','fan','light'].forEach(key=>{
    const t1=document.getElementById('act-'+key);
    const t2=document.getElementById('act2-'+key);
    if(t1)t1.checked=actuators[key];
    if(t2)t2.checked=actuators[key];
  });
}

// ── ACTUATOR CONTROL
function toggleActuator(key,el){
  if(currentUser&&currentUser.role==='viewer'){
    el.checked=actuators[key];
    showToast('⛔ Droits insuffisants (rôle viewer)','red');return;
  }
  actuators[key]=el.checked;
  syncAllToggles();updateActLabels();updateActCards();
  const names={pump:"Pompe irrigation",fan:"Ventilateur",light:"Éclairage"};
  addHistoryEntry('actuator',names[key],el.checked?'Activé (manuel)':'Désactivé (manuel)','');
  showToast(`${key==='pump'?'💧 Pompe':key==='fan'?'🌀 Ventilateur':'💡 Éclairage'} ${el.checked?tr('on'):tr('off')}`,el.checked?'green':'yellow');
}

// ── HISTORY
let lastSensorLog=0;
function logSensorEntry(){
  const now=Date.now();
  if(now-lastSensorLog<10000)return;
  lastSensorLog=now;
  addHistoryEntry('sensor','Capteurs',`H:${sensorData.humidity.toFixed(0)}% T:${sensorData.temp.toFixed(1)}°C CO₂:${sensorData.co2.toFixed(0)}ppm Lux:${sensorData.light.toFixed(0)} Eau:${sensorData.water.toFixed(0)}%`,'');
}

function addHistoryEntry(type,desc,detail,value){
  historyLog.unshift({time:timestamp(),type,desc,detail,value});
  if(historyLog.length>500)historyLog.pop();
  if(document.getElementById('page-history').classList.contains('active'))renderHistory();
}

function renderHistory(){
  const filter=document.getElementById('hist-filter').value;
  const tbody=document.getElementById('history-body');
  const filtered=historyLog.filter(e=>filter==='all'||e.type===filter);
  tbody.innerHTML=filtered.slice(0,100).map(e=>`
    <tr>
      <td>${e.time}</td>
      <td><span class="type-tag ${e.type}">${e.type.toUpperCase()}</span></td>
      <td>${e.desc} — ${e.detail}</td>
      <td style="font-family:var(--mono);font-size:12px;color:var(--text-dim)">${e.value||'—'}</td>
    </tr>`).join('');
}

function exportCSV(){
  const headers='Heure,Type,Description,Detail,Valeur\n';
  const rows=historyLog.map(e=>`"${e.time}","${e.type}","${e.desc}","${e.detail}","${e.value||''}"`).join('\n');
  const blob=new Blob([headers+rows],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download=`agricole-log-${new Date().toISOString().slice(0,10)}.csv`;a.click();
  URL.revokeObjectURL(url);
  showToast('⬇ Export CSV téléchargé','green');
}

// ── THRESHOLDS
function updateThreshold(key,val){
  thresholds[key]=parseFloat(val);
  [`th-${key}`,`cfg-${key}`].forEach(id=>{const e=document.getElementById(id);if(e)e.value=val;});
  showToast(`Seuil "${key}" mis à jour: ${val}`,'yellow');
}

// ── SETTINGS
function setAutoMode(v){autoMode=v;}
function updateSettingsDisplay(){
  if(!currentUser)return;
  document.getElementById('cfg-username').textContent=currentUser.name;
  const r=document.getElementById('cfg-role');
  if(r){r.textContent=currentUser.role.toUpperCase();r.className='cstatic role-badge'+(currentUser.role==='viewer'?' viewer':'');}
}

// ── NAVIGATION
function showPage(id,el){
  document.querySelectorAll('.page').forEach(p=>{p.classList.remove('active');p.classList.add('hidden');});
  const page=document.getElementById('page-'+id);
  if(page){page.classList.remove('hidden');page.classList.add('active');}
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if(el)el.classList.add('active');
  const titles={dashboard:tr('nav_dashboard'),sensors:tr('nav_sensors'),actuators:tr('nav_actuators'),history:tr('nav_history'),settings:tr('nav_settings')};
  document.getElementById('page-title').textContent=titles[id]||id;
  if(id==='history')renderHistory();
  if(id==='settings')updateSettingsDisplay();
  if(window.innerWidth<=768)document.getElementById('sidebar').classList.remove('open');
  return false;
}

function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');}
function toggleAlertPanel(){document.getElementById('alert-panel').classList.toggle('hidden');}

// ── UTILS
function timestamp(){return new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}

let toastTm=null;
function showToast(msg,type='green'){
  const ex=document.querySelector('.toast');if(ex)ex.remove();
  if(toastTm)clearTimeout(toastTm);
  const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=msg;
  document.body.appendChild(el);toastTm=setTimeout(()=>el.remove(),3000);
}

// ── INIT
function initApp(){
  document.getElementById('user-name-display').textContent=currentUser.name;
  const rb=document.getElementById('user-role-badge');
  rb.textContent=currentUser.role.toUpperCase();
  if(currentUser.role==='viewer')rb.classList.add('viewer');
  if(currentUser.role==='viewer'){
    document.querySelectorAll('.tgl input').forEach(i=>i.setAttribute('disabled','disabled'));
    document.querySelectorAll('.sc-thresh input,.cinput').forEach(i=>i.setAttribute('disabled','disabled'));
  }
  initCharts();
  // Seed history
  for(let i=0;i<6;i++){
    const ago=new Date(Date.now()-(6-i)*20000);
    const ts=ago.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    historyLog.push({time:ts,type:'sensor',desc:'Capteurs',detail:`Initialisation démo — mesure #${i+1}`,value:''});
  }
  startSimulation();
}
