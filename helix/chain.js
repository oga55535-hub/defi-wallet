// 체인 조회 (읽기 전용). eth_call / eth_getBalance / eth_blockNumber / eth_getBlockByNumber 만 써요.
// 서명·승인·전송 기능은 없고, 지갑 주소는 아래 RPC 노드 말고는 어디에도 보내지 않아요.
// 컨트랙트 주소와 함수는 디앱 JS 번들(anubis.origindefi.io, awakehelix.io)에서 찾아 실제 지갑으로 eth_call 해 본 것만 썼어요 (docs/helix-contracts.md).
(function(root){
const ANUBIS=['https://rpc.anubispace.org','https://rpc2.anubispace.org'];
// Polygon 공개 노드: 앞에서부터 쓰고 안 되면 다음 노드 (nodefree.io는 디앱도 쓰는 노드 · 10/24 여러 건 묶음 조회 확인)
const POLYGON=['https://polygon-bor-rpc.publicnode.com','https://nodefree.io','https://1rpc.io/matic'];
const CHAIN_ID=6714;
const A={
  lgns:'0x4D1D808a081FdAc440703b3765FC61f8028C06B8',      // LGNS (9 decimals)
  dai:'0x83fd06F0846d9D90B3016bF670Efe2E0B11cDe14',       // DAI (18)
  ailgns:'0x256EdB652db43E721EC6A12B6b51b6967D3bb8cB',    // AiLGNS (18)
  lgnsPair:'0x32A4586797E3f561F41C0F47CA57eD08D64f3dC0',  // DAI/LGNS
  ailgnsPair:'0x0a1Cce65d995C6C5100e6F5bA3c388Ef34CEcaf0',// AiLGNS/DAI (HELIX 설정의 AILGNS_DAI_PAIR)
  turbine:'0x92B53785090F6FE0717Ca3cF5dB8f8040d3B070b',   // 일반 터보 (AnubisTurbine)
  nt25:'0x0664F1369209677FEcb279F5EC3Df1E53a22212e',      // 신생태 터보 2.5배·300일
  nt4:'0x229e0aA54ebcFD887a1c06bc649AD1AFcA87486A',       // 신생태 터보 4배·500일
  power:'0x9E68F61E2615cc1D2C4a2D0026bFc1EBFdf68C1b',     // HELIX POWER_LEDGER
  vault:'0x3DEea5f638cA0dFb03A0873CF4c0b90BA50E1aA2',     // HELIX COMMUNITY_VAULT (터빈 대기 AiLGNS)
  hTurbine:'0xE884A336550a4482Ca6A17A3F93aa30Ed4eD9BaD',  // HELIX TURBINE (24시간 잠금)
  ve:'0x52D7f7745D4Ba3dE6C3A0B503815878aeE7eDf14',        // HELIX VE
  long360:'0x88ea98af226Cd4402A3873400308a4D78784eCE6',   // Anubis 360일 장기 스테이킹
  long600:'0x04eD22c6d1D020A9B5e032E93D79ab28293EF72f',   // Anubis 600일 장기 스테이킹
  cobweb:'0xF7a0cacDF0810609EE5618247C4121b799E41664',    // 거미망(코브웹) 보상 · 옛 방식: claim() 하면 터보란으로. 10/7 17:30 KST 이후 새로 쌓이지 않아요
  cobweb2:'0x71B514b8d08F61e39e24442c2Fc83297584C1Dd6',   // 거미망 보상 · 새 방식 (같은 코드, 10/12부터 적립): claim() 하면 새 터빈으로
  cwTurbine:'0x8250f8eeaae5b6e21043fbd8c61c70e1b0906109', // 새 터빈: 신생태 터보형 (활성화 1% → 24시간 → 판매 5%), 10/9 생성
  burnBond:'0x11b10C9827c5B7071E96fcAa143B4e6E86b17c69',  // 소각 본드: Anubis LGNS(시세로 원금, 230%) 또는 DAI(250%) → LGNS로 나눠 지급
  fixedBond:'0x3f403751975e1EB06d95901f7FF246513444E71F', // 고정 소각 본드(픽스본드): Polygon에서 소각한 LGNS 1개 = 1 DAI 원금, 200% · 300일
  // 10/24 디앱 번들 설정에서 찾아 실제 보유자로 확인했어요
  slgns:'0x2243aE29F73137d678197b61B0621AE942845B8C',     // sLGNS (9): 스테이킹한 LGNS 1:1 · balanceForGons(gons) = LGNS
  staking:'0x7a2E3fA6eA60437F0441b8eb5e60674B80339228',   // 일반 스테이킹: warmupInfo(user) = (deposit, gons, expiry, lock) 대기 중인 몫
  instant:'0xf7788F5A5CbBaFAc4120c63C79dcd9F1931c7824',   // 인스턴트 스테이킹: getDepositorBalance = 잠김 + 지금 찾을 수 있는 LGNS
  bondStaking:'0xF190Ab12B73BFE1B626379aF96e8f1859ec91F20',// 본드 스테이킹: getDepositorBalance = 원금 LGNS 합계
  discount:'0x5584CDeb1369673C91C6aD7EBea0cE7cB630ce60',  // 디스카운트 스테이킹(Genesis 360): 건마다 gons → 리베이스 포함 LGNS
  activity:'0x1E5FeeC473F7F445FC7F5FeEC0beABB2270b0b4E',  // 활동 포인트 스테이킹: getDepositorBalance = 맡긴 LGNS
  // HELIX LGNS 소각 게이트 (10/26 ✅ PowerLedger.lgnsBurnGate()): 지갑당 에포크마다 1번 최대 500 · stakeOf = 360일+600일 장기 스테이킹 + 본드 스테이킹 ≥ 2만
  burnGate:'0xb975fd9b03ff440d6a43a52a7f072154cb520a4b',
  epochClock:'0x6C5352E15A8327C3F44898FE220100Edc2989C58', // HELIX 에포크(7일) 시계: currentEpoch()
  aggregator:'0xeBd08fa8768c366fcCCd8130AA3c0b35DC50f9a6',// 디앱 초대 화면의 ‘Anubis 스테이킹’ = getStakedAmount(user) (디앱이 쓰는 공식 집계)
};
const P={lgns:'0xeB51D9A39AD5EEF215dC0Bf39a8821ff804A0F01',pair:'0x882df4B0fB50a229C3B4124EB18c759911485bFb',
  slgns:'0x99a57E6C8558BC6689f894e068733ADf83C19725',staking:'0x1964Ca90474b11FFD08af387b110ba6C96251Bfc'};
// 한 지갑에서 읽는 건수 최대 (장기 스테이킹·본드·디스카운트 스테이킹)
const MAXN=200;
const SEL={balanceOf:'0x70a08231',getReserves:'0x0902f1ac',token0:'0x0dfe1681',
  activePowerOf:'0x6cf2fa36',totalPowerOf:'0x4f343040',pendingPowerOf:'0xaa81a38f',queuedPowerOf:'0x4029c12c',
  pendingOf:'0xf44136a1',lockedBalanceOf:'0x59355736',claimableOf:'0x8903ab9d',getTurbineBal:'0xb4131557',
  positionsOf:'0xf867d46b',positions:'0x99fbab88',
  getUserOrderCount:'0x2cc75967',getUserOrders:'0xc7efbe36',sellableBalance:'0x3bbb623b',lockedBalance:'0x9ae697bf',ratePerEpoch:'0xd8e2219c',
  // 장기 스테이킹: stakes(user,i)[0]=원금 LGNS, [7]=진행 중 / pendingPayout=받을 이자 / extraInterest=터보로 받는 추가 이자
  getUserStakesCount:'0x98dc8dea',stakes:'0x584b62a1',pendingPayout:'0xda709204',extraInterest:'0xb01d3563',
  // 일반 터보: 터보란 LGNS 수량을 넣으면 그만큼 LGNS를 사는 DAI 견적. 실제로는 여기에 burnExtraBps(5%)를 더 내요 (10/22 실제 거래로 확인)
  getSilenceDAIAmount:'0x5c083dc6',burnExtraBps:'0x2d5ec9b9',
  // 스파이더 웹: claimable=지금 청구할 LGNS, rewardOf=(total, claimed) 누적
  claimable:'0x402914f5',rewardOf:'0x1d62ebd9',
  // 일반 터보 청구 기록: (id, silenceBalance, rewardBalance, lockTimestamp)[]. 청구하면 기록이 지워져요 (10/23 실제 거래로 확인)
  getClaimInfo:'0x0835fe47',lockPeriod:'0x3fd8b02f',
  // 본드: getUserDeposits(user) → (원금 DAI, 배수 bps, 소각 LGNS, 지급된 DAI 가치, 청구한 LGNS, …, 예치 시각, 종류)[] / getClaimable(user, idx) = 지금 청구할 LGNS
  getUserDeposits:'0x2a5bf6d2',getClaimable:'0x6f5244b1',
  // 스테이킹류: sLGNS gons → LGNS, 일반 스테이킹 대기분, 예치 잔고, 디스카운트 스테이킹 기록 (principal, gons, …, exists 7번째 · 10칸)
  balanceForGons:'0x7965d56d',warmupInfo:'0x6746f4c2',getDepositorBalance:'0xb79215d6',getStakeRecordsPagination:'0x297a52d2',totalSupply:'0x18160ddd',getStakedAmount:'0x4da6a556',
  // 유연한 스테이킹(인스턴트): 지금 찾을 수 있는 몫 · 잠긴 몫 · 잠금 풀리는 시각
  redeemableNow:'0x66b223fb',frozenBalance:'0x266565a9',unlockTimeOf:'0x469a6947',
  currentEpoch:'0x76671808',maximumLgns:'0x7300b78e',minimumStake:'0xec5ffac2',dailyMaximumLgns:'0x020bb577',burnedLgnsToday:'0xcb9ebaf2',stakeOf:'0x42623360',burnEpochOf:'0x99e02c2d',burnOpensAt:'0xb04e2dff'};
const LABEL={burn:'HELIX 소각 자격',instR:'유연한 스테이킹 찾을 수 있는 몫',instF:'유연한 스테이킹 잠긴 몫',instU:'유연한 스테이킹 잠금 시각',act:'활동 포인트 스테이킹',agg:'디앱 스테이킹 합계',slg:'sLGNS',warm:'스테이킹 대기',inst:'인스턴트 스테이킹',bst:'본드 스테이킹',disc:'디스카운트 스테이킹',lpA:'LP(Anubis)',lpP:'LP(Polygon)',slgP:'sLGNS(Polygon)',warmP:'스테이킹 대기(Polygon)',power:'활성 Power',totalPower:'누적 Power',queued:'대기 Power',ai:'AiLGNS',unc:'터빈 대기',turbLocked:'터빈 잠김',turbClaim:'터빈 수령 가능',
  dai:'DAI',lgnsA:'LGNS(Anubis)',lgnsP:'LGNS(Polygon)',pend:'일반 터보',ve:'ve 잠금',nt25:'신생태 2.5배',nt4:'신생태 4배',long:'장기 스테이킹',turboDai:'터보 DAI 견적',cw:'거미망(옛 방식)',cw2:'거미망(새 방식)',tClaim:'터보 청구 대기',bbd:'소각 본드',fbd:'픽스본드'};

const isAddr=a=>/^0x[0-9a-fA-F]{40}$/.test(a);
const word=v=>BigInt(v).toString(16).padStart(64,'0');
const words=hex=>{if(!hex||hex==='0x')return [];const h=hex.slice(2),o=[];for(let i=0;i<h.length;i+=64)o.push(BigInt('0x'+h.slice(i,i+64)));return o;};
const units=(v,d)=>{v=BigInt(v||0);const D=10n**BigInt(d);return Number(v/D)+Number(v%D)/Number(D);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// 노드 끊김·429·5xx는 잠깐 쉬었다가 최대 3번 다시 시도, 그래도 안 되면 예비 노드로
async function post(url,body){
  let last;
  for(let i=0;i<4;i++){
    if(i)await sleep(700*2**(i-1)+Math.random()*300);
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),20000);
    try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal});
      if(!r.ok){last=new Error('HTTP '+r.status);if(r.status===429||r.status>=500)continue;throw last;}
      return await r.json();}
    catch(e){last=e.name==='AbortError'?new Error('응답 시간 초과'):e;}
    finally{clearTimeout(t);}
  }
  throw last||new Error('노드 응답 없음');
}
// [{id,method,params}] → {id:{result}|{error}}
async function batch(urls,reqs){
  const out={};
  for(let i=0;i<reqs.length;i+=40){
    let part=reqs.slice(i,i+40).map(q=>({jsonrpc:'2.0',...q}));
    let ok=false,last;
    for(const u of urls){
      try{const res=await post(u,part);
        // 노드가 일부만 거절하면(한도 초과 등) 그 건만 다음 노드로 다시 물어봐요 (계약이 되돌린 건 그대로 둬요)
        if(Array.isArray(res)){res.forEach(x=>out[x.id]=x);
          const again=part.filter(q=>{const x=out[q.id];return !x||(x.error&&!/revert/i.test(x.error.message||''));});
          if(!again.length){ok=true;break;}part=again;last=new Error('일부 응답 실패');continue;}
        // 배치를 지원하지 않는 노드는 하나씩
        for(const q of part){const x=await post(u,q);out[q.id]=x;}ok=true;break;
      }catch(e){last=e;}
    }
    if(!ok)part.forEach(q=>{if(!out[q.id]||!out[q.id].result)out[q.id]={error:{message:(last&&last.message)||'노드 연결 실패'}};});
  }
  return out;
}
const callReq=(id,to,sel,args=[],block='latest')=>({id,method:'eth_call',params:[{to,data:sel+args.map(word).join('')},block]});
const errOf=x=>!x?'응답 없음':x.error?(x.error.message||'호출 실패'):null;

// DAI 짝 풀 잔고로 가격(DAI) 계산
function pairPrice(res,t0,token,dec){
  if(errOf(res)||errOf(t0))return null;
  const r=words(res.result),z=words(t0.result);if(r.length<2||!z.length)return null;
  const tok0='0x'+z[0].toString(16).padStart(40,'0');
  const [t,d]=tok0.toLowerCase()===token.toLowerCase()?[r[0],r[1]]:[r[1],r[0]];
  return t>0n?units(d,18)/units(t,dec):null;
}
async function loadPrices(){
  const [a,p]=await Promise.all([
    batch(ANUBIS,[callReq('lr',A.lgnsPair,SEL.getReserves),callReq('lt',A.lgnsPair,SEL.token0),callReq('ar',A.ailgnsPair,SEL.getReserves),callReq('at',A.ailgnsPair,SEL.token0),{id:'cid',method:'eth_chainId',params:[]}]),
    batch(POLYGON,[callReq('r',P.pair,SEL.getReserves),callReq('t',P.pair,SEL.token0)]).catch(()=>({})),
  ]);
  const cid=a.cid&&a.cid.result?parseInt(a.cid.result,16):null;
  if(cid!==null&&cid!==CHAIN_ID)throw new Error(`체인 ID가 ${cid}예요 (기대값 ${CHAIN_ID})`);
  // 풀의 DAI 잔고 (가격 영향 계산용)
  const depth=(res,t0,token)=>{if(errOf(res)||errOf(t0))return null;const r=words(res.result),z=words(t0.result);if(r.length<2||!z.length)return null;
    const tok0='0x'+z[0].toString(16).padStart(40,'0');return units(tok0.toLowerCase()===token.toLowerCase()?r[1]:r[0],18);};
  return {lgns:pairPrice(a.lr,a.lt,A.lgns,9),ailgns:pairPrice(a.ar,a.at,A.ailgns,18),lgnsPoly:pairPrice(p.r,p.t,P.lgns,9),chainId:cid,
    lgnsDepth:depth(a.lr,a.lt,A.lgns),aiDepth:depth(a.ar,a.at,A.ailgns)};
}

// 신생태 터보 OrderView (17칸, 모두 고정 길이): orderId, order{user, principalDai, burnedLgns, capBps, releasedDaiValue, releasedLgns, activatedLgns,
//   lastAccReleasedFrac, lastAccLgnsPerDai, createdAt}, totalEntitlementDai, releasedDaiValue, releasedLgns, claimableLgns, pendingReleaseDai, completed
function decodeOrders(hex,mult,rate){
  const w=words(hex);if(w.length<2)return [];
  const n=Number(w[1]),out=[];
  for(let i=0;i<n;i++){const o=w.slice(2+i*17,2+(i+1)*17);if(o.length<17)break;
    const principal=units(o[2],18);
    // 하루 지급 = 원금 × ratePerEpoch/1e6 × 2 (12시간 에포크) — 원금 240 DAI · 2.5배 주문에서 600 DAI ÷ 300일과 같음을 확인
    const daily=principal*Number(rate)/1e6*2;
    out.push({id:Number(o[0]),mult,principal,entitlement:units(o[11],18),released:units(o[12],18),claimable:units(o[14],9),pending:units(o[15],18),completed:o[16]!==0n,created:Number(o[10]),daily});}
  return out;
}

// 지갑 여러 개를 한꺼번에 조회. 값마다 {ok, x} 또는 {ok:false, err}
async function loadWallets(addrs,opt={}){
  const R1=[];
  addrs.forEach((a,i)=>{
    const c=(k,to,s,args)=>R1.push(callReq(i+':'+k,to,s,args||[a]));
    c('lgnsA',A.lgns,SEL.balanceOf);c('dai',A.dai,SEL.balanceOf);c('ai',A.ailgns,SEL.balanceOf);
    c('power',A.power,SEL.activePowerOf);c('totalPower',A.power,SEL.totalPowerOf);c('pendP',A.power,SEL.pendingPowerOf);c('queued',A.power,SEL.queuedPowerOf);
    c('unc',A.vault,SEL.pendingOf);c('turbLocked',A.hTurbine,SEL.lockedBalanceOf);c('turbClaim',A.hTurbine,SEL.claimableOf);
    c('pend',A.turbine,SEL.getTurbineBal);c('veIds',A.ve,SEL.positionsOf);
    ['nt25','nt4'].forEach(k=>{c(k+'n',A[k],SEL.getUserOrderCount);c(k+'s',A[k],SEL.sellableBalance);c(k+'l',A[k],SEL.lockedBalance);});
    ['long360','long600'].forEach(k=>c(k+'n',A[k],SEL.getUserStakesCount));
    c('cw',A.cobweb,SEL.claimable);c('cwr',A.cobweb,SEL.rewardOf);c('tci',A.turbine,SEL.getClaimInfo);
    c('cw2',A.cobweb2,SEL.claimable);c('cw2r',A.cobweb2,SEL.rewardOf);c('cwts',A.cwTurbine,SEL.sellableBalance);c('cwtl',A.cwTurbine,SEL.lockedBalance);
    c('bbd',A.burnBond,SEL.getUserDeposits);c('fbd',A.fixedBond,SEL.getUserDeposits);
    c('slg',A.slgns,SEL.balanceOf);c('warm',A.staking,SEL.warmupInfo);c('inst',A.instant,SEL.getDepositorBalance);c('bst',A.bondStaking,SEL.getDepositorBalance);
    c('dsn',A.discount,SEL.getUserStakesCount);c('lpA',A.lgnsPair,SEL.balanceOf);c('act',A.activity,SEL.getDepositorBalance);c('bgS',A.burnGate,SEL.stakeOf);c('bgE',A.burnGate,SEL.burnEpochOf);c('instR',A.instant,SEL.redeemableNow);c('instF',A.instant,SEL.frozenBalance);c('instU',A.instant,SEL.unlockTimeOf);c('agg',A.aggregator,SEL.getStakedAmount);
  });
  // gons → LGNS 환율 (sLGNS.balanceForGons에 큰 수를 넣어 한 번에 구해요), LP 지분 계산용 풀 잔고·발행량
  // 소각 게이트 공통 값
  R1.push(callReq('bgEp',A.epochClock,SEL.currentEpoch,[]),callReq('bgMax',A.burnGate,SEL.maximumLgns,[]),callReq('bgMin',A.burnGate,SEL.minimumStake,[]),callReq('bgDay',A.burnGate,SEL.dailyMaximumLgns,[]),callReq('bgUsed',A.burnGate,SEL.burnedLgnsToday,[]),callReq('bgOpen',A.burnGate,SEL.burnOpensAt,[]));
  R1.push(callReq('gpf',A.slgns,SEL.balanceForGons,[10n**75n]),callReq('lpTs',A.lgnsPair,SEL.totalSupply,[]),callReq('lpR',A.lgnsPair,SEL.getReserves,[]),callReq('lpT0',A.lgnsPair,SEL.token0,[]));
  R1.push(callReq('lp',A.turbine,SEL.lockPeriod,[]),callReq('rbb',A.burnBond,SEL.ratePerEpoch,[]),callReq('rfb',A.fixedBond,SEL.ratePerEpoch,[]));
  R1.push(callReq('r25',A.nt25,SEL.ratePerEpoch,[]),callReq('r4',A.nt4,SEL.ratePerEpoch,[]),{id:'bn',method:'eth_blockNumber',params:[]});
  const RP=[callReq('lpTs',P.pair,SEL.totalSupply,[]),callReq('lpR',P.pair,SEL.getReserves,[]),callReq('lpT0',P.pair,SEL.token0,[])];
  addrs.forEach((a,i)=>RP.push(callReq(i+':lgnsP',P.lgns,SEL.balanceOf,[a]),callReq(i+':slgP',P.slgns,SEL.balanceOf,[a]),callReq(i+':warmP',P.staking,SEL.warmupInfo,[a]),callReq(i+':lpP',P.pair,SEL.balanceOf,[a])));
  const [r1,rp]=await Promise.all([batch(ANUBIS,R1),batch(POLYGON,RP)]);
  const bn=r1.bn&&r1.bn.result?parseInt(r1.bn.result,16):null;
  const rate={nt25:r1.r25&&!errOf(r1.r25)?words(r1.r25.result)[0]:4167n,nt4:r1.r4&&!errOf(r1.r4)?words(r1.r4.result)[0]:4000n};

  // 2차: 주문 목록, ve 포지션, 하루 전 Power(실측 하루 비율용)
  const R2=[];let dayAgo=null;
  if(opt.withRate&&bn){
    const bb=await batch(ANUBIS,[{id:'b0',method:'eth_getBlockByNumber',params:['0x'+bn.toString(16),false]},{id:'b1',method:'eth_getBlockByNumber',params:['0x'+(bn-86230).toString(16),false]}]);
    if(bb.b0?.result&&bb.b1?.result)dayAgo={n:bn-86230,sec:parseInt(bb.b0.result.timestamp,16)-parseInt(bb.b1.result.timestamp,16)};
  }
  addrs.forEach((a,i)=>{
    ['nt25','nt4'].forEach(k=>{const x=r1[i+':'+k+'n'];const n=x&&!errOf(x)?Number(words(x.result)[0]||0n):0;if(n>0)R2.push(callReq(i+':'+k+'o',A[k],SEL.getUserOrders,[a,0,Math.min(n,100)]));});
    const v=r1[i+':veIds'];const ids=v&&!errOf(v)?words(v.result).slice(2):[];
    ids.slice(0,MAXN).forEach((id,j)=>R2.push(callReq(i+':ve'+j,A.ve,SEL.positions,[id])));
    if(dayAgo){const blk='0x'+dayAgo.n.toString(16);R2.push(callReq(i+':p0',A.power,SEL.activePowerOf,[a],blk),callReq(i+':t0',A.power,SEL.totalPowerOf,[a],blk),callReq(i+':cwr0',A.cobweb,SEL.rewardOf,[a],blk),callReq(i+':cw2r0',A.cobweb2,SEL.rewardOf,[a],blk));}
    // 본드 건별 지금 청구할 LGNS
    ['bbd','fbd'].forEach(k=>{const x=r1[i+':'+k];if(!x||errOf(x))return;const w=words(x.result),n=Math.min(Number(w[1]||0n),MAXN);
      for(let j=0;j<n;j++)R2.push(callReq(`${i}:${k}c${j}`,k==='bbd'?A.burnBond:A.fixedBond,SEL.getClaimable,[a,j]));});
    const dn=r1[i+':dsn'],dcount=dn&&!errOf(dn)?Math.min(Number(words(dn.result)[0]||0n),MAXN):0;
    if(dcount>0)R2.push(callReq(i+':dsr',A.discount,SEL.getStakeRecordsPagination,[a,0,dcount]));
    ['long360','long600'].forEach(k=>{const x=r1[i+':'+k+'n'];const n=x&&!errOf(x)?Number(words(x.result)[0]||0n):0;
      for(let j=0;j<Math.min(n,MAXN);j++){
        R2.push(callReq(`${i}:${k}s${j}`,A[k],SEL.stakes,[a,j]),callReq(`${i}:${k}p${j}`,A[k],SEL.pendingPayout,[a,j]),callReq(`${i}:${k}x${j}`,A[k],SEL.extraInterest,[a,j]));
        if(dayAgo)R2.push(callReq(`${i}:${k}y${j}`,A[k],SEL.extraInterest,[a,j],'0x'+dayAgo.n.toString(16)));
      }});
  });
  const r2=R2.length?await batch(ANUBIS,R2):{};

  // 3차: 지갑마다 ‘터보란 LGNS + 아직 안 옮긴 추가이자’를 전부 터보로 돌리는 DAI 견적 (풀 가격 영향 포함)
  const turboQty=addrs.map((a,i)=>{
    const t=r1[i+':pend'];let q=t&&!errOf(t)?words(t.result)[0]||0n:0n;
    const cw=r1[i+':cw'];if(cw&&!errOf(cw))q+=words(cw.result)[0]||0n;
    ['long360','long600'].forEach(k=>{const nx=r1[i+':'+k+'n'];const n=nx&&!errOf(nx)?Math.min(Number(words(nx.result)[0]||0n),MAXN):0;
      for(let j=0;j<n;j++){const xx=r2[`${i}:${k}x${j}`],s=r2[`${i}:${k}s${j}`];if(xx&&!errOf(xx)&&s&&!errOf(s)&&words(s.result)[7]!==0n)q+=words(xx.result)[0]||0n;}});
    return q;
  });
  const R3=[callReq('bx',A.turbine,SEL.burnExtraBps,[])];
  turboQty.forEach((q,i)=>{if(q>0n)R3.push(callReq(i+':sq',A.turbine,SEL.getSilenceDAIAmount,[q]));});
  const r3=await batch(ANUBIS,R3);
  const extraBps=r3.bx&&!errOf(r3.bx)?Number(words(r3.bx.result)[0]||0n):500;

  return addrs.map((a,i)=>{
    const v={},g=(k,res,dec)=>{const e=errOf(res);v[k]=e?{ok:false,err:e}:{ok:true,x:units(words(res.result)[0]||0n,dec)};};
    g('lgnsA',r1[i+':lgnsA'],9);g('dai',r1[i+':dai'],18);g('ai',r1[i+':ai'],18);
    g('power',r1[i+':power'],18);g('totalPower',r1[i+':totalPower'],18);g('queued',r1[i+':queued'],18);
    const pp=r1[i+':pendP'];if(v.queued.ok&&!errOf(pp))v.queued.x+=units(words(pp.result)[0]||0n,18);
    g('unc',r1[i+':unc'],18);g('turbLocked',r1[i+':turbLocked'],18);g('turbClaim',r1[i+':turbClaim'],18);
    g('pend',r1[i+':pend'],9);g('lgnsP',rp[i+':lgnsP'],9);
    // ve: positions(id) = owner, kind, principal, startEpoch, lockEpochs, claimedPrincipal, closed
    const vi=r1[i+':veIds'];
    if(errOf(vi))v.ve={ok:false,err:errOf(vi)};
    else{let s=0,bad=null;words(vi.result).slice(2,2+MAXN).forEach((_,j)=>{const x=r2[i+':ve'+j];if(errOf(x)){bad=errOf(x);return;}const w=words(x.result);if(w.length>=7&&w[6]===0n)s+=units(w[2]-w[5],18);});
      v.ve=bad?{ok:false,err:bad}:{ok:true,x:s};}
    const nt={},orders=[];
    ['nt25','nt4'].forEach(k=>{
      const n=r1[i+':'+k+'n'],s=r1[i+':'+k+'s'],l=r1[i+':'+k+'l'],o=r2[i+':'+k+'o'];
      const e=errOf(n)||errOf(s)||errOf(l)||(o&&errOf(o));
      if(e){v[k]={ok:false,err:e};return;}
      v[k]={ok:true,x:Number(words(n.result)[0]||0n)};
      nt[k]={sellable:units(words(s.result)[0]||0n,9),locked:units(words(l.result)[0]||0n,9)};
      if(o)orders.push(...decodeOrders(o.result,k==='nt25'?2.5:4,rate[k]));
    });
    // 장기 스테이킹 추가 이자: 지금 쌓인 양 + 24시간 동안 늘어난 양(그 사이 터보로 옮긴 건은 늘어난 양을 못 재요)
    const stakes=[];let lerr=null;
    ['long360','long600'].forEach(k=>{
      const nx=r1[i+':'+k+'n'];if(errOf(nx)){lerr=errOf(nx);return;}
      const n=Math.min(Number(words(nx.result)[0]||0n),MAXN);
      for(let j=0;j<n;j++){
        const s=r2[`${i}:${k}s${j}`],pp=r2[`${i}:${k}p${j}`],xx=r2[`${i}:${k}x${j}`],yy=r2[`${i}:${k}y${j}`];
        if(errOf(s)||errOf(pp)||errOf(xx)){lerr=errOf(s)||errOf(pp)||errOf(xx);continue;}
        const sw=words(s.result);if(sw.length<8||sw[7]===0n)continue;
        const extra=units(words(xx.result)[0]||0n,9),before=yy&&!errOf(yy)?units(words(yy.result)[0]||0n,9):null;
        stakes.push({term:k==='long360'?360:600,idx:j,principal:units(sw[0],9),interest:units(words(pp.result)[0]||0n,9),extra,
          daily:before!=null&&dayAgo&&extra>=before?(extra-before)*86400/dayAgo.sec:null});
      }
    });
    v.long=lerr?{ok:false,err:lerr}:{ok:true,x:stakes.reduce((s,x)=>s+x.extra,0)};
    // 스파이더 웹: 청구 전 LGNS, 누적 총액·받은 양, 24시간 동안 늘어난 총액(= 하루 새 보상)
    g('cw',r1[i+':cw'],9);
    const cr=r1[i+':cwr'],cr0=r2[i+':cwr0'];let cwInfo=null;
    if(!errOf(cr)){const x=words(cr.result),x0=cr0&&!errOf(cr0)?words(cr0.result):null;
      cwInfo={total:units(x[0]||0n,9),claimed:units(x[1]||0n,9),daily:x0&&dayAgo&&(x[0]||0n)>=(x0[0]||0n)?units((x[0]||0n)-(x0[0]||0n),9)*86400/dayAgo.sec:null};}
    // 거미망 새 방식: 청구 전 LGNS + 하루 새 적립 + 새 터빈 금고(활성화 후 잠김·판매 가능)
    g('cw2',r1[i+':cw2'],9);
    const c2=r1[i+':cw2r'],c20=r2[i+':cw2r0'];let cw2Info=null;
    if(!errOf(c2)){const x=words(c2.result),x0=c20&&!errOf(c20)?words(c20.result):null;
      cw2Info={total:units(x[0]||0n,9),claimed:units(x[1]||0n,9),daily:x0&&dayAgo&&(x[0]||0n)>=(x0[0]||0n)?units((x[0]||0n)-(x0[0]||0n),9)*86400/dayAgo.sec:null,
        sellable:!errOf(r1[i+':cwts'])?units(words(r1[i+':cwts'].result)[0]||0n,9):0,locked:!errOf(r1[i+':cwtl'])?units(words(r1[i+':cwtl'].result)[0]||0n,9):0};}
    // 실측 하루 비율: 24시간 동안 누적 Power가 그대로였던(입금 없던) 지갑만
    let rate1=null;
    const p0=r2[i+':p0'],t0=r2[i+':t0'];
    if(dayAgo&&!errOf(p0)&&!errOf(t0)&&v.power.ok&&v.totalPower.ok){
      const a0=units(words(p0.result)[0]||0n,18),tt=units(words(t0.result)[0]||0n,18);
      if(a0>0&&Math.abs(tt-v.totalPower.x)<1e-9&&v.power.x<a0){const r=1-Math.pow(v.power.x/a0,86400/dayAgo.sec);if(r>0&&r<.05)rate1=r;}
    }
    // 일반 터보 청구 대기: 터보를 돌린 뒤 24시간 잠금 중이거나 지금 청구할 수 있는 LGNS
    const tci=r1[i+':tci'];
    if(errOf(tci))v.tClaim={ok:false,err:errOf(tci)};
    else{const x=words(tci.result),n=Number(x[1]||0n),lock=r1.lp&&!errOf(r1.lp)?Number(words(r1.lp.result)[0]||86400n):86400,now=Date.now()/1000;let locked=0,ready=0;
      for(let j=0;j<n;j++){const r=x.slice(2+4*j,6+4*j);if(r.length<4)break;const amt=units(r[1],9)+units(r[2],9);if(Number(r[3])+lock>now)locked+=amt;else ready+=amt;}
      v.tClaim={ok:true,x:locked+ready,locked,ready};}
    // 터보 전부 돌리는 DAI = 견적 × (1 + burnExtraBps)
    const sq=r3[i+':sq'];
    v.turboDai=turboQty[i]===0n?{ok:true,x:0}:errOf(sq)?{ok:false,err:errOf(sq)}:{ok:true,x:units(words(sq.result)[0]||0n,18)*(1+extraBps/10000)};
    // 본드: 건마다 원금·배수·지급된 양 → 남은 지급(DAI 가치)과 하루 지급, 지금 청구할 LGNS (10/23 실제 보유자로 구조 확인)
    const bonds=[];
    [['bbd','burn',r1.rbb],['fbd','fixed',r1.rfb]].forEach(([k,kind,rr])=>{
      const x=r1[i+':'+k];if(!x||errOf(x)){v[k]={ok:false,err:errOf(x)||'응답 없음'};return;}
      const rate=rr&&!errOf(rr)?Number(words(rr.result)[0]||0n):(kind==='fixed'?3334:4000);
      const w=words(x.result),n=Math.min(Number(w[1]||0n),MAXN);let left=0;
      for(let j=0;j<n;j++){const s=w.slice(2+j*9,2+(j+1)*9);if(s.length<9)break;
        const principal=units(s[0],18),cap=Number(s[1])/1e4,paid=units(s[3],18),total=principal*cap,remain=Math.max(0,total-paid),daily=principal*rate*2/1e6;
        const cl=r2[`${i}:${k}c${j}`],claimable=cl&&!errOf(cl)?units(words(cl.result)[0]||0n,9):0;
        bonds.push({kind,idx:j,principal,cap,burned:units(s[2],9),paid,remain,daily,claimable,ts:Number(s[7])});left+=remain;}
      v[k]={ok:true,x:left};
    });
    // 스테이킹·LP에 들어 있는 LGNS (✅ 10/24 실제 보유자로 확인)
    const gpf=r1.gpf&&!errOf(r1.gpf)?words(r1.gpf.result)[0]||0n:0n,gonsL=g0=>units(g0*gpf/(10n**75n),9);
    const one=(k,res,f)=>{v[k]=!res?{ok:false,err:'응답 없음'}:errOf(res)?{ok:false,err:errOf(res)}:{ok:true,x:f(words(res.result))};};
    one('slg',r1[i+':slg'],w=>units(w[0]||0n,9));
    one('warm',r1[i+':warm'],w=>gpf?gonsL(w[1]||0n):units(w[0]||0n,9));
    one('inst',r1[i+':inst'],w=>units(w[0]||0n,9));
    one('bst',r1[i+':bst'],w=>units(w[0]||0n,9));
    one('act',r1[i+':act'],w=>units(w[0]||0n,9));
    // HELIX 소각 자격·이번 에포크 소각 여부
    {const g=k=>r1[k]&&!errOf(r1[k])?words(r1[k].result)[0]||0n:null,S0=r1[i+':bgS'],E0=r1[i+':bgE'];
      if(errOf(S0)||errOf(E0)||g('bgEp')==null)v.burn={ok:false,err:errOf(S0)||errOf(E0)||'에포크 못 읽음'};
      else{const stake=units(words(S0.result)[0]||0n,9),last=Number(words(E0.result)[0]||0n),ep=Number(g('bgEp')),min=g('bgMin')!=null?units(g('bgMin'),9):20000,max=g('bgMax')!=null?units(g('bgMax'),9):500;
        v.burn={ok:true,x:stake,stake,min,max,lastEpoch:last,epoch:ep,eligible:stake>=min,doneThisEpoch:last>=ep,
          day:{max:g('bgDay')!=null?units(g('bgDay'),9):null,used:g('bgUsed')!=null?units(g('bgUsed'),9):null},opensAt:g('bgOpen')!=null?Number(g('bgOpen')):null};}}
    one('instR',r1[i+':instR'],w=>units(w[0]||0n,9));one('instF',r1[i+':instF'],w=>units(w[0]||0n,9));one('instU',r1[i+':instU'],w=>Number(w[0]||0n));
    one('agg',r1[i+':agg'],w=>units(w[0]||0n,9));
    const dsr=r2[i+':dsr'];
    if(errOf(r1[i+':dsn']))v.disc={ok:false,err:errOf(r1[i+':dsn'])};
    else if(dsr&&errOf(dsr))v.disc={ok:false,err:errOf(dsr)};
    else{let t=0;if(dsr){const w=words(dsr.result),n=Number(w[1]||0n);for(let j=0;j<n;j++){const r=w.slice(2+j*10,2+(j+1)*10);if(r.length<10)break;if(r[7]!==0n)t+=gpf?gonsL(r[1]):units(r[0],9);}}v.disc={ok:true,x:t};}
    // LP: 내 LP 지분 × 풀의 LGNS 잔고
    const lpShare=(res,ts,rr,t0,lg)=>{if(!res||errOf(res)||!ts||errOf(ts)||!rr||errOf(rr)||!t0||errOf(t0))return {ok:false,err:errOf(res)||errOf(ts)||errOf(rr)||'응답 없음'};
      const bal=words(res.result)[0]||0n,tot=words(ts.result)[0]||0n,R=words(rr.result),isL=('0x'+(words(t0.result)[0]||0n).toString(16).padStart(40,'0')).toLowerCase()===lg.toLowerCase();
      return {ok:true,x:tot>0n?units(bal*(isL?R[0]:R[1])/tot,9):0};};
    v.lpA=lpShare(r1[i+':lpA'],r1.lpTs,r1.lpR,r1.lpT0,A.lgns);
    v.lpP=lpShare(rp[i+':lpP'],rp.lpTs,rp.lpR,rp.lpT0,P.lgns);
    one('slgP',rp[i+':slgP'],w=>units(w[0]||0n,9));
    one('warmP',rp[i+':warmP'],w=>units(w[0]||0n,9));
    return {address:a,v,nt,orders,stakes,cw:cwInfo,cw2:cw2Info,bonds,rate:rate1,block:bn,turboQty:units(turboQty[i],9),extraBps};
  });
}
root.HelixChain={isAddr,loadPrices,loadWallets,LABEL,ADDR:{anubis:A,polygon:P},CHAIN_ID};
})(typeof window!=='undefined'?window:globalThis);
