// 체인 조회 (읽기 전용). eth_call / eth_getBalance / eth_blockNumber / eth_getBlockByNumber 만 써요.
// 서명·승인·전송 기능은 없고, 지갑 주소는 아래 RPC 노드 말고는 어디에도 보내지 않아요.
// 컨트랙트 주소와 함수는 디앱 JS 번들(anubis.origindefi.io, awakehelix.io)에서 찾아 실제 지갑으로 eth_call 해 본 것만 썼어요 (docs/helix-contracts.md).
(function(root){
const ANUBIS=['https://rpc.anubispace.org','https://rpc2.anubispace.org'];
const POLYGON=['https://polygon-bor-rpc.publicnode.com','https://polygon.drpc.org'];
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
};
const P={lgns:'0xeB51D9A39AD5EEF215dC0Bf39a8821ff804A0F01',pair:'0x882df4B0fB50a229C3B4124EB18c759911485bFb'};
const SEL={balanceOf:'0x70a08231',getReserves:'0x0902f1ac',token0:'0x0dfe1681',
  activePowerOf:'0x6cf2fa36',totalPowerOf:'0x4f343040',pendingPowerOf:'0xaa81a38f',queuedPowerOf:'0x4029c12c',
  pendingOf:'0xf44136a1',lockedBalanceOf:'0x59355736',claimableOf:'0x8903ab9d',getTurbineBal:'0xb4131557',
  positionsOf:'0xf867d46b',positions:'0x99fbab88',
  getUserOrderCount:'0x2cc75967',getUserOrders:'0xc7efbe36',sellableBalance:'0x3bbb623b',lockedBalance:'0x9ae697bf',ratePerEpoch:'0xd8e2219c'};
const LABEL={power:'활성 Power',totalPower:'누적 Power',queued:'대기 Power',ai:'AiLGNS',unc:'터빈 대기',turbLocked:'터빈 잠김',turbClaim:'터빈 수령 가능',
  dai:'DAI',lgnsA:'LGNS(Anubis)',lgnsP:'LGNS(Polygon)',pend:'일반 터보',ve:'ve 잠금',nt25:'신생태 2.5배',nt4:'신생태 4배'};

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
    const part=reqs.slice(i,i+40).map(q=>({jsonrpc:'2.0',...q}));
    let ok=false,last;
    for(const u of urls){
      try{const res=await post(u,part);
        if(Array.isArray(res)){res.forEach(x=>out[x.id]=x);ok=true;break;}
        // 배치를 지원하지 않는 노드는 하나씩
        for(const q of part){const x=await post(u,q);out[q.id]=x;}ok=true;break;
      }catch(e){last=e;}
    }
    if(!ok)part.forEach(q=>out[q.id]={error:{message:(last&&last.message)||'노드 연결 실패'}});
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
  return {lgns:pairPrice(a.lr,a.lt,A.lgns,9),ailgns:pairPrice(a.ar,a.at,A.ailgns,18),lgnsPoly:pairPrice(p.r,p.t,P.lgns,9),chainId:cid};
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
  });
  R1.push(callReq('r25',A.nt25,SEL.ratePerEpoch,[]),callReq('r4',A.nt4,SEL.ratePerEpoch,[]),{id:'bn',method:'eth_blockNumber',params:[]});
  const [r1,rp]=await Promise.all([batch(ANUBIS,R1),batch(POLYGON,addrs.map((a,i)=>callReq(i+':lgnsP',P.lgns,SEL.balanceOf,[a])))]);
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
    ids.slice(0,50).forEach((id,j)=>R2.push(callReq(i+':ve'+j,A.ve,SEL.positions,[id])));
    if(dayAgo){const blk='0x'+dayAgo.n.toString(16);R2.push(callReq(i+':p0',A.power,SEL.activePowerOf,[a],blk),callReq(i+':t0',A.power,SEL.totalPowerOf,[a],blk));}
  });
  const r2=R2.length?await batch(ANUBIS,R2):{};

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
    else{let s=0,bad=null;words(vi.result).slice(2,52).forEach((_,j)=>{const x=r2[i+':ve'+j];if(errOf(x)){bad=errOf(x);return;}const w=words(x.result);if(w.length>=7&&w[6]===0n)s+=units(w[2]-w[5],18);});
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
    // 실측 하루 비율: 24시간 동안 누적 Power가 그대로였던(입금 없던) 지갑만
    let rate1=null;
    const p0=r2[i+':p0'],t0=r2[i+':t0'];
    if(dayAgo&&!errOf(p0)&&!errOf(t0)&&v.power.ok&&v.totalPower.ok){
      const a0=units(words(p0.result)[0]||0n,18),tt=units(words(t0.result)[0]||0n,18);
      if(a0>0&&Math.abs(tt-v.totalPower.x)<1e-9&&v.power.x<a0){const r=1-Math.pow(v.power.x/a0,86400/dayAgo.sec);if(r>0&&r<.05)rate1=r;}
    }
    return {address:a,v,nt,orders,rate:rate1,block:bn};
  });
}
root.HelixChain={isAddr,loadPrices,loadWallets,LABEL,ADDR:{anubis:A,polygon:P},CHAIN_ID};
})(typeof window!=='undefined'?window:globalThis);
