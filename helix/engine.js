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
//   pendDaily  Anubis 장기 스테이킹에서 매일 새로 쌓이는 추가 이자 LGNS (터보로 1+1)  ✅ LongStaking.extraInterest 하루 변화
// 레퍼런스에 없던 선택 (기본값이면 꺼져 있어요):
//   p.route='auto'   다시 넣는 DAI를 이득 순서대로: 일반 터보(쌓인 수량까지) → 남은 DAI로 LGNS 사서 소각
//   p.route='aiburn' 받은 AiLGNS를 팔지 않고 소각 (AiLGNS 소각 2.5배, 비교용)
//   p.ntShare        다시 넣는 돈 중 신생태 터보(p.ntMult배 · p.ntDays일)에 넣는 비율. 풀린 DAI는 p.route 대로 다시 넣어요
//   p.xFirst         터보란(쌓인 수량 + 추가이자)을 매일 가장 먼저 돌려요: 남는 DAI를 원금 회수·현금·다시 넣기보다 먼저 쓰고,
//                    ‘편하게’는 모자란 만큼 받은 AiLGNS를 팔아서 내요
//   p.ex.xNow        첫날 지갑 DAI 중 이만큼으로 터보란을 바로 돌려요 (하루 한도와 상관없이)
//   p.xCap           하루에 터보란에 쓰는 DAI 최대 — 쌓인 보상을 천천히 나눠 돌릴 때
//   p.ex.cw2Daily    거미망 보상 새 방식의 하루 적립 LGNS (1+1 없이 신생태 터보처럼 팔아서 DAI)
//   p.ex.burnA/burnP 지갑에 이미 있는 Anubis/Polygon LGNS 중 첫날 HELIX에 소각하는 수량 (1개 = 1 DAI 인정 × 2배 📢)
// 일반 터보 (10/22 실제 거래로 확인): DAI를 내면 그 값으로 산 LGNS는 바로 지갑에 오고, 터보란의 같은 수량은 24시간 뒤 청구 → 1+1.
//   내는 DAI = 시세(견적) × 1.05. 터보란 수량은 사라지지 않고 남아 있다가 DAI와 함께 돌릴 때 줄어요.
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
  // p.burnOpen===false: HELIX LGNS 소각이 아직 안 열렸다고 보고, Power로 가던 Anubis LGNS는 p.lgnsDest(‘bond’ 소각 본드 / ‘hold’ 보유)로,
  // Polygon LGNS는 p.polyDest(‘fixed’ 픽스본드 1 LGNS = 1 DAI × 200% · 300일 / ‘hold’)로 보내요.
  // 본드에서 매일 풀리는 LGNS는 p.bondRelease: ‘hold’ 보유 · ‘rebond’ 다시 소각 본드 · ‘sell’ Anubis에서 팔기(약 48% 수수료) · ‘helix’ HELIX 소각(열렸을 때만)
  const OPEN=p.burnOpen!==false;
  // p.burnCap: HELIX LGNS 소각 한도 (10/26 오픈 ✅ 소각 게이트: 지갑당 에포크(7일)마다 1번 최대 500 LGNS, Anubis LGNS만, 스테이킹 2만 이상).
  //   없으면 예전처럼 무제한. p.burnWait: 지금 에포크에 이미 소각했으면 다음 에포크까지 남은 날 (0이면 오늘 가능)
  //   한도를 넘는 Anubis LGNS는 p.lgnsDest(소각 본드/보유)로, Polygon LGNS는 p.polyDest로 가요.
  const CAP=OPEN&&p.burnCap!=null?Math.max(0,p.burnCap):null,WAIT=Math.max(0,Math.round(p.burnWait||0));
  let bud=CAP!=null&&WAIT===0?CAP:0;
  // ✅ 10/23 컨트랙트 값: 소각 본드 LGNS 230%·DAI 250%, 12시간마다 원금의 0.4% / 픽스본드 200%, 12시간마다 0.3334% / Anubis LGNS 판매세 5% 뒤 45%
  // p.anubisKeep: Anubis에서 LGNS를 팔 때 손에 남는 비율 (화면 4번에서 바꿀 때만, 기본은 판매세 5% 뒤 45%)
  const BOND={lgCap:2.3,daiCap:2.5,fixCap:2,day:.008,fixDay:.006668},ANUBIS_SELL=p.anubisKeep!=null?p.anubisKeep:.95*.55;
  let lgHeld=0,polyHeld=0,bondOut=0,bondIn=0,lgBurn=0;
  let bonds=(ex.bonds||[]).filter(b=>b.d>0&&b.left>0).map(b=>({d:b.d,left:Math.ceil(b.left)}));
  const bondAdd=(principal,cap,day)=>{if(principal>0){bonds.push({d:principal*day,left:Math.round(cap/day)});bondIn+=principal;}};
  const sinkA=(q,px)=>{if(q<=0)return;if(p.lgnsDest==='hold')lgHeld+=q;else{bondAdd(q*px,BOND.lgCap,BOND.day);lgBurn+=q;}}; // 시세로 원금
  const sinkP=q=>{if(q<=0)return;if(p.polyDest==='hold')polyHeld+=q;else{bondAdd(q,BOND.fixCap,BOND.fixDay);lgBurn+=q;}}; // 1 LGNS = 1 DAI
  // Anubis LGNS q개를 HELIX에 소각: 한도 안의 몫만 Power(1개 = 1 DAI × 2배), 넘는 몫은 소각 본드·보유로
  const burnL=(q,px)=>{if(q<=0)return 0;const b=CAP==null?q:Math.min(q,bud);if(CAP!=null)bud-=b;lgBurn+=b;if(q-b>1e-12)sinkA(q-b,px);return b*2*Math.max(px,1);};
  // 일반 터보: DAI로 같은 수량 LGNS를 사면 쌓인 수량과 1+1로 받고, 그 LGNS를 HELIX에 소각
  // 컨트랙트 확인(10/21): 필요한 DAI = LGNS 시세 + 5%(gLGNS 바이백 소각)
  // p.amm={l,a}: LGNS·AiLGNS 풀의 DAI 잔고. 있으면 내가 사고파는 양만큼 가격이 움직이고(상수곱 x·y=k, 스왑 수수료 0.3% — 10/23 라우터 견적으로 확인),
  // 그 영향(m: 가격 배수)이 다음 날로 이어져요. 시장 가정(월 변화)은 그 위에 곱해요. 없으면 레퍼런스와 똑같이 가격이 거래량과 상관없어요.
  const AMM=p.amm?{l:{D:p.amm.l,m:1},a:{D:p.amm.a,m:1}}:null,SWAP=.003;
  let curLb=null,curAb=null; // 그날 시장 가정 가격 (풀 영향 전)
  const ammCost=(pool,base,q)=>{const v=q*base*pool.m;return v>=pool.D*.999?Infinity:v*pool.D/(pool.D-v)/(1-SWAP);}; // 토큰 q개 사는 DAI (상태 그대로)
  const ammBuyQty=(pool,base,q)=>{const dai=ammCost(pool,base,q),x=dai*(1-SWAP);pool.m*=Math.pow((pool.D+x)/pool.D,2);pool.D+=x;return dai;}; // q개 사고 DAI 돌려줌
  const ammBuy=(pool,base,dai)=>{const x=dai*(1-SWAP),q=x/(base*pool.m)*pool.D/(pool.D+x);pool.m*=Math.pow((pool.D+x)/pool.D,2);pool.D+=x;return q;}; // DAI로 산 토큰 수
  const ammSell=(pool,base,q)=>{const v=q*base*pool.m*(1-SWAP),out=v*pool.D/(pool.D+v);pool.m*=Math.pow(pool.D/(pool.D+v),2);pool.D-=out;return out;}; // 토큰 판 DAI
  const oldTurbo=(dai,pL)=>{
    if(AMM&&curLb!=null){const x=dai/(1+FEE.oldTurbo),q0=ammBuy({D:AMM.l.D,m:AMM.l.m},curLb,x),m=Math.min(q0,pend);if(m<=0)return {pow:0,left:dai};
      const px=curLb*AMM.l.m,spent=ammBuyQty(AMM.l,curLb,m)*(1+FEE.oldTurbo);pend-=m;
      if(!OPEN){sinkA(2*m,px);return {pow:0,left:Math.max(0,dai-spent)};}
      if(CAP!=null)return {pow:burnL(2*m,px),left:Math.max(0,dai-spent),capped:true};
      return {pow:4*m*Math.max(px,1),left:Math.max(0,dai-spent)};}
    const unit=pL*(1+FEE.oldTurbo);const m=Math.min(dai/unit,pend);pend-=m;
    if(!OPEN){sinkA(2*m,pL);return {pow:0,left:dai-m*unit};} // 소각이 안 열렸으면 1+1로 받은 LGNS는 소각 본드나 보유로
    if(CAP!=null)return {pow:burnL(2*m,pL),left:dai-m*unit,capped:true};
    return {pow:4*m*Math.max(pL,1),left:dai-m*unit};};
  const ntNet=1-FEE.ntSell-FEE.ntAct-p.slip; // 신생태 터보: 판매 5% + 활성화 1% + 슬리피지
  let ntDaily=0,ntDays=0;
  if(p.startType==='lgns'){const pc=p.lgnsChain==='polygon'?p.pLP0:p.pL0;
    if(OPEN&&CAP==null)P=p.startAmt*2*Math.max(pc,1);
    else if(OPEN&&p.lgnsChain!=='polygon')P=burnL(p.startAmt,pc); // 한도: Anubis LGNS만, 이번 에포크 500개까지
    else{P=0;if(p.lgnsChain==='polygon')sinkP(p.startAmt);else sinkA(p.startAmt,pc);}
    startValue=p.startAmt*pc;}
  else if(p.startType==='turbo'){const o=oldTurbo(p.startAmt,p.pL0);P=o.pow+o.left*2.5;startValue=p.startAmt;}
  else if(p.startType==='newturbo'){P=0;startValue=p.startAmt;ntDays=p.ntDays;ntDaily=p.startAmt*p.ntMult/p.ntDays;}
  else{P=p.startAmt*2.5;startValue=p.startAmt;}
  if(ex.power)P+=ex.power;
  if(OPEN&&CAP==null){if(ex.burnA)P+=ex.burnA*2*Math.max(p.pL0,1);if(ex.burnP)P+=ex.burnP*2*Math.max(p.pLP0,1);}
  else if(OPEN){P+=burnL(ex.burnA||0,p.pL0);sinkP(ex.burnP||0);} // Polygon LGNS는 소각 불가 (Anubis만 ✅)
  else{sinkA(ex.burnA||0,p.pL0);sinkP(ex.burnP||0);}
  // 소각한 LGNS 누적 (HELIX 소각 또는 본드 예치). 계산 결과에는 영향 없이 세기만 해요
  if(OPEN&&CAP==null){lgBurn+=(p.startType==='lgns'?p.startAmt:0)+(ex.burnA||0)+(ex.burnP||0);if(p.startType==='turbo')lgBurn+=2*(p.pend-pend);}
  const fundInv=(pl==='B'&&p.bFund==='nt')?(p.ntFundIn!==''&&p.ntFundIn!=null?Math.max(0,+p.ntFundIn):autoFund(p,P)):0;
  let fs=fundInv>0?[{d:fundInv*2.5/300*(1-FEE.ntSell-FEE.ntAct-p.slip),left:300}]:[];
  let R=p.R0,cash=0,ai=0,ve=0,ext=0,unc=0,pending=0,streams=[],cashDay=null,veDay=null,ntOut=0,cs=[],ntIn=0;
  if(ex.dai)R+=ex.dai;
  let xDai=0,xLgns=0,xDay=null,xToday=0; // 터보란을 돌리는 데 쓴 DAI, 1+1로 받은 LGNS, 처음 쌓여 있던 양을 다 돌린 날, 오늘 쓴 DAI
  // p.xCap: 하루에 터보란에 쓰는 DAI 최대. 넘는 DAI는 쓰지 않고 돌려줘요 (터보란은 남아 있다가 다음 날 이어서)
  const xRun=(dai,pL,noCap)=>{
    if(!(p.xCap>0)||noCap){const before=pend,o=oldTurbo(dai,pL),m=before-pend;xDai+=dai-o.left;xToday+=dai-o.left;xLgns+=2*m;if(OPEN&&!o.capped)lgBurn+=2*m;return o;}
    const use=Math.min(dai,Math.max(0,p.xCap-xToday)),before=pend,o=oldTurbo(use,pL),m=before-pend,spent=use-o.left;
    xDai+=spent;xToday+=spent;xLgns+=2*m;if(OPEN&&!o.capped)lgBurn+=2*m;return {pow:o.pow,left:dai-spent};};
  if(ex.xNow>0&&pend>0){const d0=Math.min(ex.xNow,R),o=xRun(d0,p.pL0,true);R-=d0-o.left;pending+=o.pow;} // 받은 LGNS는 첫날 소각
  // 본드에서 지금 청구할 수 있는 LGNS (첫날 처리)
  const relLgns=(q,px)=>{if(q<=0)return;if(p.bondRelease==='sell')R+=q*px*ANUBIS_SELL*(1-p.slip);else if(p.bondRelease==='rebond')sinkA2(q,px);else if(p.bondRelease==='helix'&&OPEN)P+=CAP==null?q*2*Math.max(px,1):burnL(q,px);else lgHeld+=q;};
  const sinkA2=(q,px)=>{bondAdd(q*px,BOND.lgCap,BOND.day);lgBurn+=q;};
  if(ex.bondNow>0)relLgns(ex.bondNow,p.pL0);
  if(ex.ai)ai+=ex.ai;
  if(ex.unc)unc+=ex.unc;
  if(ex.ve)ve+=ex.ve;
  let exNt=(ex.nt||[]).filter(s=>s.d>0&&s.left>0).map(s=>({d:s.d,left:Math.ceil(s.left)}));
  // 지금 가진 현금성 자산은 들인 돈에도 같이 넣어, 원금 회수 시점이 "새로 넣는 돈 + 이미 들인 원금" 기준이 되게 해요
  const exIn=(ex.basis||0)+(ex.dai||0)+(ex.ai||0)*p.pA0*(1-p.fee-p.slip)+(ex.burnA||0)*p.pL0+(ex.burnP||0)*p.pLP0;
  const goalC=startValue+p.R0+(ex.basis||0);
  const series=[];const startP=P;
  for(let t=1;t<=p.days;t++){
    const pAb=p.pA0*Math.pow(1+p.aChg,t/30), pLb=p.pL0*Math.pow(1+p.lChg,t/30), r=p.r0*Math.pow(1-p.rDecl,t/30);
    const pA=AMM?pAb*AMM.a.m:pAb, pL=AMM?pLb*AMM.l.m:pLb;
    if(AMM){curLb=pLb;curAb=pAb;}
    // 소각 한도: 에포크(7일)마다 다시 500개 (WAIT일 뒤 첫 에포크부터)
    if(CAP!=null&&t-1>=WAIT&&(t-1-WAIT)%7===0)bud=CAP;
    const lgPow=x=>{
      // 소각이 안 열렸으면: 소각 본드에 DAI로 바로 예치(250%) 또는 LGNS를 사서 보유
      if(!OPEN){if(p.lgnsDest==='hold'){const q=AMM?ammBuy(AMM.l,pLb,x):x/pL;lgHeld+=q;}else bondAdd(x,BOND.daiCap,BOND.day);return 0;}
      // 한도가 있으면 이번 에포크에 남은 수량만큼만 사서 소각하고, 남는 DAI는 소각 본드(250%)·LGNS 보유로
      if(CAP!=null){const px0=AMM?pLb*AMM.l.m:pL,xb=Math.min(x,bud*px0),rest=x-xb;let pw=0;
        if(xb>1e-12){const q=AMM?ammBuy(AMM.l,pLb,xb):xb/pL;pw=burnL(q,AMM?pLb*AMM.l.m:pL);}
        if(rest>1e-12){if(p.lgnsDest==='hold'){lgHeld+=AMM?ammBuy(AMM.l,pLb,rest):rest/pL;}else bondAdd(rest,BOND.daiCap,BOND.day);}
        return pw;}
      if(AMM){const px=pLb*AMM.l.m,q=ammBuy(AMM.l,pLb,x);lgBurn+=q;return q*2*Math.max(px,1);}lgBurn+=x/pL;return x*2*Math.max(pL,1)/pL;};
    const sellAi=q=>AMM?ammSell(AMM.a,pAb,q*(1-p.fee))*(1-p.slip):q*pA*(1-p.fee-p.slip); // 받은 AiLGNS 팔기
    // auto: 쌓인 터보 수량까지 일반 터보, 남은 DAI는 LGNS 사서 소각
    const autoPow=dai=>{const o=xRun(dai,pL);return o.pow+lgPow(o.left*(1-p.slip));};
    xToday=0;
    if(ex.pendDaily)pend+=ex.pendDaily;
    P+=pending;pending=0;
    // 본드에서 오늘 풀리는 LGNS (DAI 가치 → 그날 시세로 LGNS)
    if(bonds.length){let V=0;bonds.forEach(b=>{V+=b.d;b.left--;});bonds=bonds.filter(b=>b.left>0);bondOut+=V;relLgns(V/pL,pL);}
    if(streams.length){let V=0;streams.forEach(s=>{V+=s.d;s.left--;});streams=streams.filter(s=>s.left>0);
      if(p.route==='auto')P+=autoPow(V*ntNet);else{const o=xRun(V*ntNet,pL);P+=o.pow+o.left*2.5;}}
    let ntDai=t<=ntDays?ntDaily*ntNet:0;
    if(exNt.length){let V=0;exNt.forEach(s=>{V+=s.d;s.left--;});exNt=exNt.filter(s=>s.left>0);ntDai+=V*ntNet;}
    if(t===1&&ex.ntNow)ntDai+=ex.ntNow;
    // 거미망 보상 · 새 방식 (10/12~): 새 터빈에서 신생태 터보처럼 활성화(1%) → 24시간 → 판매(5%) → DAI. 쓰는 곳은 p.ntUse
    if(ex.cw2Daily)ntDai+=ex.cw2Daily*pL*ntNet;
    if(t<=ntDays||ntDai>0){const dai=ntDai;ntOut+=dai;
      if(p.ntUse==='cash')cash+=dai;
      else if(p.ntUse==='helix')P+=dai*2.5;
      else if(p.ntUse==='lgnsbuy')P+=lgPow(dai*(1-p.slip));
      else{const o=xRun(dai,pL);P+=o.pow+o.left*2.5;}}
    if(fs.length){let V=0;fs.forEach(x=>{V+=x.d;x.left--;});fs=fs.filter(x=>x.left>0);R+=V;}
    if(cs.length){let V=0;cs.forEach(s=>{V+=s.d;s.left--;});cs=cs.filter(s=>s.left>0);cash+=V;}
    const D=P*r;P-=D;
    unc+=D/pA; // 배출된 AiLGNS는 터빈을 돌릴 때까지 쌓여 있어요 (사라지지 않음)
    const cost=AMM?ammCost(AMM.a,pAb,unc)*(1+TF+p.slip):unc*pA*(1+TF+p.slip);
    let f=1;
    if(pl==='B'&&p.bFund==='ext'){ext+=cost;if(AMM&&unc>0)ammBuyQty(AMM.a,pAb,unc);}
    else{f=cost>0?Math.min(1,R/cost):1;if(AMM){if(unc*f>0)R-=ammBuyQty(AMM.a,pAb,unc*f)*(1+TF+p.slip);}else R-=cost*f;}
    const claimed=unc*f;unc-=claimed;
    const got=2*claimed;
    let lock=0;
    if(p.rankOn&&ve*pA<p.veTarget){lock=got*p.veRatio;ve+=lock;}
    const rest=got-lock, net=pA*(1-p.fee-p.slip);
    if(pl==='B'){
      if(p.bFund==='self'){const need=cost;const sq=Math.min(rest,need/net);R+=AMM?sellAi(sq):sq*net;ai+=rest-sq;}
      else if(p.bFund==='nt'){const sq=Math.min(rest,Math.max(0,cost-R)/net);R+=AMM?sellAi(sq):sq*net;ai+=rest-sq;const tg=Math.max(p.R0,cost*1.2);if(R>tg){cash+=R-tg;R=tg;}}
      else ai+=rest;
      // 터보란 먼저: 남는 DAI → 모자라면 받은 AiLGNS를 팔아서
      if(p.xFirst&&pend>0){const need=pend*pL*(1+FEE.oldTurbo);let dai=Math.min(need,Math.max(0,R-Math.max(p.R0,cost*1.2)));R-=dai;
        if(dai<need&&ai>0){const q=Math.min(ai,(need-dai)/net);ai-=q;dai+=AMM?sellAi(q):q*net;}
        if(dai>0){const o=xRun(dai,pL);pending+=o.pow;R+=o.left;}}
    }else{
      // p.aiSell(0~1): 터빈용 DAI를 채우고 남는 AiLGNS 중 파는 비율. 안 판 몫은 AiLGNS로 보유
      const target=Math.max(p.R0,cost*1.2);
      if(p.aiSell!=null&&p.aiSell<1){const need=Math.min(rest,Math.max(0,target-R)/net),sq=need+(rest-need)*p.aiSell;R+=AMM?sellAi(sq):sq*net;ai+=rest-sq;}
      else R+=AMM?sellAi(rest):rest*net;
      let sur=Math.max(0,R-target);R-=sur;
      if(p.xFirst&&pend>0&&sur>0){const o=xRun(sur,pL);pending+=o.pow;sur=o.left;}
      let inv=0;
      if(pl==='C'&&cash<goalC){const toCash=Math.min(sur,goalC-cash);cash+=toCash;inv=(sur-toCash)*p.reinv;cash+=sur-toCash-inv;}
      else{inv=sur*p.reinv;const c=sur-inv;if(pl==='A'&&p.cashVia==='nt'&&c>0)cs.push({d:c*2.5/300*ntNet,left:300});else cash+=c;}
      if(inv>0&&p.ntShare>0){const x=inv*p.ntShare;inv-=x;streams.push({d:x*p.ntMult/p.ntDays,left:p.ntDays});ntIn+=x;}
      if(inv>0){
        if(p.route==='auto')pending+=autoPow(inv);
        else if(p.route==='aiburn'&&OPEN)pending+=inv*2.5/(1-p.fee-p.slip); // 판 만큼의 AiLGNS를 소각했을 때 (수수료 안 냄)
        else if(p.route==='bond')bondAdd(inv,BOND.daiCap,BOND.day); // 소각 본드에 DAI로 예치 (250%)
        else if(p.route==='dai')pending+=inv*2.5;
        else if(p.route==='old'){const o=xRun(inv,pL);pending+=o.pow+o.left*2.5;}
        else if(p.route==='lgns'||p.route==='aiburn')pending+=lgPow(inv*(1-p.slip));
        else streams.push({d:inv*2.5/300,left:300});
      }
    }
    const invested=startValue+p.R0+ext+fundInv+exIn;
    const liquid=cash+R+ai*net;
    if(cashDay===null&&liquid>=invested)cashDay=t;
    if(p.rankOn&&veDay===null&&ve*pA>=p.veTarget)veDay=t;
    if(xDay===null&&pend<=(ex.pendDaily||0)+1e-9)xDay=t;
    // 신생태 터보에서 앞으로 받을 DAI 가치: 처음 참여분 + 진행 중 주문 + 다시 넣어서 생긴 주문 + 현금 몫 주문
    const sumL=a=>a.reduce((s,x)=>s+x.d*x.left,0);
    const ntRemain=(t<ntDays?ntDaily*(ntDays-t):0)+sumL(exNt)+sumL(streams)+sumL(cs)+sumL(fs);
    // LGNS 자산 (시세로): 들고 있는 LGNS + 본드에서 앞으로 받을 몫 + 아직 안 돌린 터보란 — 터보를 안 돌려도 사라지지 않아요
    // 시장 가정의 LGNS 가격 오름(lChg)은 ‘사는 값이 비싸진다’는 나쁜 가정이라, 들고 있는 LGNS 값에는 넣지 않아요 (지금 시세 기준)
    const lgUp=Math.max(1,Math.pow(1+p.lChg,t/30)),pLv=pL/lgUp,bondLeft=sumL(bonds),pLPt=p.pLP0*Math.pow(1+p.lChg,t/30)/lgUp;
    const lgAssets=lgHeld*pLv+polyHeld*pLPt+bondLeft+pend*pLv;
    // 팔았을 때 손에 쥐는 DAI: 들고 있는 LGNS는 그날 한꺼번에 Anubis에서 팔고(판매세 5% 뒤 45% · 풀 가격 영향),
    // 본드 몫은 나올 때마다 팔고(같은 수수료), Polygon LGNS도 같은 수수료로 쳐요 ❓. 터보란은 DAI(시세+5%)를 내야 받아서, 받아서 바로 팔면 손해라 0
    const heldQ=lgHeld*ANUBIS_SELL,heldV=AMM?(v=>v*AMM.l.D/(AMM.l.D+v))(heldQ*pLv*(1-SWAP)):heldQ*pLv*(1-p.slip);
    const lgSell=heldV+(polyHeld*pLPt+bondLeft)*ANUBIS_SELL*(1-p.slip);
    series.push({t,P,D,cost,cash,R,ai,ve,veVal:ve*pA,pA,pL,r,invested,liquid,burned:lgBurn,ntRemain,aiDaily:D/pA,
      pAnow:AMM?pAb*AMM.a.m:pA,pLnow:AMM?pLb*AMM.l.m:pL,lgHeld,polyHeld,bondLeft,pendLeft:pend,lgAssets,lgSell,burnBud:bud});
  }
  return {series,last:series[series.length-1],startValue,startP,missed:unc*series[series.length-1].pA,uncQty:unc,pendLeft:pend,ntOut,ntLeft:ntDays>p.days?(ntDays-p.days)*ntDaily:0,csLeft:cs.reduce((a,s)=>a+s.d*s.left,0),fundLeft:fs.reduce((a,x)=>a+x.d*x.left,0),fundInv,cashDay,veDay,ext,streamsLeft:streams.reduce((a,s)=>a+s.d*s.left,0),exNtLeft:exNt.reduce((a,s)=>a+s.d*s.left,0),ntIn,xDai,xLgns,xDay,bondIn,bondOut};
}
root.HelixEngine={FEE,autoFund,simulate};
})(typeof window!=='undefined'?window:globalThis);
