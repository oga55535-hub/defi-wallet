// HELIX 계산 엔진 — helix_simulator_reference.html 의 FEE · autoFund · simulate 를 그대로 옮긴 것.
// 바꾼 곳은 "지갑 현황에서 시작"용 입력 p.ex 뿐이고, p.ex 가 없으면 레퍼런스와 같은 결과가 나와요 (tests/engine-test.html).
//   p.ex = { power, ai, unc, dai, ve, basis, nt:[{d,left}], ntNow }
//   power  이미 가진 활성 Power                       ✅ PowerLedger.activePowerOf
//   ai     이미 가진 AiLGNS (지갑 + 터빈 잠김/수령 가능)  ✅ balanceOf, Turbine.lockedBalanceOf/claimableOf
//   unc    터빈을 아직 안 돌린 AiLGNS                   ✅ CommunityVault.pendingOf
//   dai    터빈용으로 쓸 지갑 DAI                        ✅ DAI.balanceOf (얼마를 쓸지는 사용자가 정함)
//   ve     이미 ve로 잠근 AiLGNS                         ✅ ve.positionsOf → positions(id).principal
//   basis  이미 들인 원금 (원금 회수 계산용)               ❓ 사용자 입력
//   nt     진행 중인 신생태 터보 주문: 하루 지급 DAI 가치 d, 남은 일수 left  ✅ NewTurbo.getUserOrders
//   ntNow  신생태 터보 금고에서 지금 팔 수 있는 몫 (수수료 뺀 DAI)            ✅ sellableBalance + lockedBalance + claimableLgns
(function(root){
// 디앱 컨트랙트에서 읽은 수수료 (2026-10-21): 일반 터보 burnExtraBps 500, 신생태 터보 activationFeeBps 100, LGNS feeRatio 5%, 매수 0%
const FEE={oldTurbo:.05,ntSell:.05,ntAct:.01};
// 신생태 터보 2.5배·300일로 첫날 터빈 비용을 매일 충당하려면 필요한 DAI
function autoFund(p,P0){const net=1-FEE.ntSell-FEE.ntAct-p.slip;const cost=P0*p.r0*(1+.025+p.slip);return Math.ceil(cost/(2.5/300*net)/100)*100;}
function simulate(p,pl){
  const TF=.025;
  const ex=p.ex||{};
  let P,startValue;
  let pend=p.pend;
  // 일반 터보: DAI로 같은 수량 LGNS를 사면 쌓인 수량과 1+1로 받고, 그 LGNS를 HELIX에 소각
  // 컨트랙트 확인(10/21): 필요한 DAI = LGNS 시세 + 5%(gLGNS 바이백 소각)
  const oldTurbo=(dai,pL)=>{const unit=pL*(1+FEE.oldTurbo);const m=Math.min(dai/unit,pend);pend-=m;return {pow:4*m*Math.max(pL,1),left:dai-m*unit};};
  const ntNet=1-FEE.ntSell-FEE.ntAct-p.slip; // 신생태 터보: 판매 5% + 활성화 1% + 슬리피지
  let ntDaily=0,ntDays=0;
  if(p.startType==='lgns'){const pc=p.lgnsChain==='polygon'?p.pLP0:p.pL0;P=p.startAmt*2*Math.max(pc,1);startValue=p.startAmt*pc;}
  else if(p.startType==='turbo'){const o=oldTurbo(p.startAmt,p.pL0);P=o.pow+o.left*2.5;startValue=p.startAmt;}
  else if(p.startType==='newturbo'){P=0;startValue=p.startAmt;ntDays=p.ntDays;ntDaily=p.startAmt*p.ntMult/p.ntDays;}
  else{P=p.startAmt*2.5;startValue=p.startAmt;}
  if(ex.power)P+=ex.power;
  const fundInv=(pl==='B'&&p.bFund==='nt')?(p.ntFundIn!==''&&p.ntFundIn!=null?Math.max(0,+p.ntFundIn):autoFund(p,P)):0;
  let fs=fundInv>0?[{d:fundInv*2.5/300*(1-FEE.ntSell-FEE.ntAct-p.slip),left:300}]:[];
  let R=p.R0,cash=0,ai=0,ve=0,ext=0,unc=0,pending=0,streams=[],cashDay=null,veDay=null,ntOut=0,cs=[];
  if(ex.dai)R+=ex.dai;
  if(ex.ai)ai+=ex.ai;
  if(ex.unc)unc+=ex.unc;
  if(ex.ve)ve+=ex.ve;
  let exNt=(ex.nt||[]).filter(s=>s.d>0&&s.left>0).map(s=>({d:s.d,left:Math.ceil(s.left)}));
  // 지금 가진 현금성 자산은 들인 돈에도 같이 넣어, 원금 회수 시점이 "새로 넣는 돈 + 이미 들인 원금" 기준이 되게 해요
  const exIn=(ex.basis||0)+(ex.dai||0)+(ex.ai||0)*p.pA0*(1-p.fee-p.slip);
  const goalC=startValue+p.R0+(ex.basis||0);
  const series=[];const startP=P;
  for(let t=1;t<=p.days;t++){
    const pA=p.pA0*Math.pow(1+p.aChg,t/30), pL=p.pL0*Math.pow(1+p.lChg,t/30), r=p.r0*Math.pow(1-p.rDecl,t/30);
    const lgPow=x=>x*2*Math.max(pL,1)/pL;
    P+=pending;pending=0;
    if(streams.length){let V=0;streams.forEach(s=>{V+=s.d;s.left--;});streams=streams.filter(s=>s.left>0);const o=oldTurbo(V*ntNet,pL);P+=o.pow+o.left*2.5;}
    let ntDai=t<=ntDays?ntDaily*ntNet:0;
    if(exNt.length){let V=0;exNt.forEach(s=>{V+=s.d;s.left--;});exNt=exNt.filter(s=>s.left>0);ntDai+=V*ntNet;}
    if(t===1&&ex.ntNow)ntDai+=ex.ntNow;
    if(t<=ntDays||ntDai>0){const dai=ntDai;ntOut+=dai;
      if(p.ntUse==='cash')cash+=dai;
      else if(p.ntUse==='helix')P+=dai*2.5;
      else if(p.ntUse==='lgnsbuy')P+=lgPow(dai*(1-p.slip));
      else{const o=oldTurbo(dai,pL);P+=o.pow+o.left*2.5;}}
    if(fs.length){let V=0;fs.forEach(x=>{V+=x.d;x.left--;});fs=fs.filter(x=>x.left>0);R+=V;}
    if(cs.length){let V=0;cs.forEach(s=>{V+=s.d;s.left--;});cs=cs.filter(s=>s.left>0);cash+=V;}
    const D=P*r;P-=D;
    unc+=D/pA; // 배출된 AiLGNS는 터빈을 돌릴 때까지 쌓여 있어요 (사라지지 않음)
    const cost=unc*pA*(1+TF+p.slip);
    let f=1;
    if(pl==='B'&&p.bFund==='ext'){ext+=cost;}
    else{f=cost>0?Math.min(1,R/cost):1;R-=cost*f;}
    const claimed=unc*f;unc-=claimed;
    const got=2*claimed;
    let lock=0;
    if(p.rankOn&&ve*pA<p.veTarget){lock=got*p.veRatio;ve+=lock;}
    const rest=got-lock, net=pA*(1-p.fee-p.slip);
    if(pl==='B'){
      if(p.bFund==='self'){const need=cost;const sq=Math.min(rest,need/net);R+=sq*net;ai+=rest-sq;}
      else if(p.bFund==='nt'){const sq=Math.min(rest,Math.max(0,cost-R)/net);R+=sq*net;ai+=rest-sq;const tg=Math.max(p.R0,cost*1.2);if(R>tg){cash+=R-tg;R=tg;}}
      else ai+=rest;
    }else{
      R+=rest*net;
      const target=Math.max(p.R0,cost*1.2);
      const sur=Math.max(0,R-target);R-=sur;
      let inv=0;
      if(pl==='C'&&cash<goalC){const toCash=Math.min(sur,goalC-cash);cash+=toCash;inv=(sur-toCash)*p.reinv;cash+=sur-toCash-inv;}
      else{inv=sur*p.reinv;const c=sur-inv;if(pl==='A'&&p.cashVia==='nt'&&c>0)cs.push({d:c*2.5/300*ntNet,left:300});else cash+=c;}
      if(inv>0){
        if(p.route==='dai')pending+=inv*2.5;
        else if(p.route==='old'){const o=oldTurbo(inv,pL);pending+=o.pow+o.left*2.5;}
        else if(p.route==='lgns')pending+=lgPow(inv*(1-p.slip));
        else streams.push({d:inv*2.5/300,left:300});
      }
    }
    const invested=startValue+p.R0+ext+fundInv+exIn;
    const liquid=cash+R+ai*net;
    if(cashDay===null&&liquid>=invested)cashDay=t;
    if(p.rankOn&&veDay===null&&ve*pA>=p.veTarget)veDay=t;
    series.push({t,P,D,cost,cash,R,ai,ve,veVal:ve*pA,pA,pL,r,invested,liquid});
  }
  return {series,last:series[series.length-1],startValue,startP,missed:unc*series[series.length-1].pA,uncQty:unc,pendLeft:pend,ntOut,ntLeft:ntDays>p.days?(ntDays-p.days)*ntDaily:0,csLeft:cs.reduce((a,s)=>a+s.d*s.left,0),fundLeft:fs.reduce((a,x)=>a+x.d*x.left,0),fundInv,cashDay,veDay,ext,streamsLeft:streams.reduce((a,s)=>a+s.d*s.left,0),exNtLeft:exNt.reduce((a,s)=>a+s.d*s.left,0)};
}
root.HelixEngine={FEE,autoFund,simulate};
})(typeof window!=='undefined'?window:globalThis);
