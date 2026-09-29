"use strict";
/* ============================================================
   种子随机数
============================================================ */
function mulberry32(a){
  return function(){
    a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return((t^t>>>14)>>>0)/4294967296;
  };
}
let seed=(Math.random()*1e9)|0;
let R=mulberry32(seed);
function reseed(s){ seed=s>>>0; R=mulberry32(seed); }
function rnd(a=1,b){ if(b===undefined){b=a;a=0;} return a+R()*(b-a); }
function rndi(a,b){ return Math.floor(rnd(a,b+0.9999)); }
function pick(arr){ return arr[Math.floor(R()*arr.length)]; }
function chance(p){ return R()<p; }
function gcd(a,b){ return b?gcd(b,a%b):a; }
const PHI=(1+Math.sqrt(5))/2;
const TAU=Math.PI*2;

/* ============================================================
   美学约束：和谐比例集 + 分割点吸附
============================================================ */
// 半径/长度只允许取自这个比例数列（相对基准单位）
const RATIOS=[1, 1/PHI, 1/2, 1/(PHI*PHI), 1/3, 2/3, 1/4];
function pickRatio(){ return pick(RATIOS); }
// 位置只允许落在经典分割点上：等分点 + 黄金分割点
const DIVS=[1/4,1/3,1/2,2/3,3/4,1/PHI,1-1/PHI,1/(PHI*PHI),1-1/(PHI*PHI)];
function snapX(bx,bw){ return bx+bw*pick(DIVS); }
function snapY(by,bh){ return by+bh*pick(DIVS); }

/* ============================================================
   参数定义
============================================================ */
const MODES=[
  {id:"mix",        label:"随机混合"},
  {id:"grid",       label:"网格构图"},
  {id:"golden",     label:"黄金圆阵"},
  {id:"fibonacci",  label:"黄金螺旋"},
  {id:"tangent",    label:"相切圆链"},
  {id:"field",      label:"场线"},
  {id:"projection", label:"投影几何"},
];
const PARAMS=[
  {key:"complexity",  label:"几何复杂度",   min:1, max:12, step:1,    val:5,   group:"结构"},
  {key:"density",     label:"疏密",         min:1, max:12, step:1,    val:6,   group:"结构"},
  {key:"gridSize",    label:"网格规模",     min:2, max:8,  step:1,    val:3,   group:"结构"},
  {key:"circleCount", label:"圆数量",       min:3, max:40, step:1,    val:10,  group:"结构"},
  {key:"symmetry",    label:"对称 0无 1镜像 2旋×4 3旋×6 4旋×8", min:0, max:4, step:1, val:0, group:"结构"},
  {key:"lineWidth",   label:"线条粗细",     min:0.3,max:6, step:0.1,  val:1.2, group:"笔触"},
  {key:"curvature",   label:"曲率(直↔弧)",  min:0, max:1,  step:0.05, val:0.5, group:"笔触"},
  {key:"jitter",      label:"手绘抖动",     min:0, max:1,  step:0.05, val:0.1, group:"笔触"},
  {key:"rotation",    label:"整体旋转",     min:-90,max:90,step:1,    val:0,   group:"构图"},
  {key:"margin",      label:"边距",         min:0, max:0.25,step:0.01,val:0.06,group:"构图"},
];
const state={ mode:"mix", dark:true, aspect:"1:1", arrows:true, labels:true, construction:true };
PARAMS.forEach(p=>state[p.key]=p.val);

/* ============================================================
   每个模式的专属参数面板：只列真实生效的参数，量程按实际效果定制
   show:  参数 key 白名单；hide: 开关黑名单；range: 覆盖量程
============================================================ */
const MODE_CONFIG={
  mix:{
    show:["complexity","density","symmetry","lineWidth","curvature","jitter","rotation","margin"],
    hide:[],
    range:{}
  },
  grid:{
    show:["gridSize","complexity","density","symmetry","lineWidth","curvature","jitter","rotation","margin"],
    hide:[],
    range:{
      gridSize:{min:2,max:6},                    // 8 格会过密
      complexity:{min:1,max:9},
      symmetry:{max:2},                          // 网格自身已规整，高对称易糊
      jitter:{max:0.5},
    }
  },
  golden:{
    show:["complexity","density","circleCount","symmetry","lineWidth","curvature","jitter","rotation","margin"],
    hide:[],
    range:{
      circleCount:{min:3,max:20},                // 20+ 会糊
      symmetry:{max:2},
      jitter:{max:0.5},
    }
  },
  fibonacci:{
    show:["complexity","density","lineWidth","curvature","jitter","rotation","margin"],
    hide:["arrows"],
    range:{
      complexity:{min:1,max:10},
      jitter:{max:0.35},
    }
  },
  tangent:{
    show:["circleCount","density","symmetry","lineWidth","curvature","jitter","rotation","margin"],
    hide:[],
    range:{
      circleCount:{min:3,max:24},
      symmetry:{max:2},
      jitter:{max:0.4},
    }
  },
  field:{
    show:["complexity","density","circleCount","symmetry","lineWidth","jitter","rotation","margin"],
    hide:["curvature"],                          // 场线曲率由物理决定
    range:{
      complexity:{min:1,max:8},
      circleCount:{min:2,max:16},
      symmetry:{max:2},
      jitter:{max:0.3},
    }
  },
  projection:{
    show:["complexity","density","circleCount","symmetry","lineWidth","curvature","jitter","rotation","margin"],
    hide:[],
    range:{
      complexity:{min:1,max:8},
      circleCount:{min:2,max:14},
      symmetry:{max:1},                          // 投影几何只适合镜像
      jitter:{max:0.4},
    }
  },
};

/* ============================================================
   画布：主画布 + 工作画布（对称合成用）
============================================================ */
const cv=document.getElementById("cv");
const ctx=cv.getContext("2d");
let T=ctx;                 // 当前绘制目标（canvas 或 SVG 记录器）
let W=1600,H=1600;
let suppressLabels=false;  // 对称复制时抑制文字（避免镜像字）

function setAspect(a){
  state.aspect=a;
  const long=1800;
  const map={"1:1":[1,1],"4:3":[4,3],"3:4":[3,4],"16:9":[16,9],"9:16":[9,16]};
  const[r1,r2]=map[a];
  if(r1>=r2){W=long;H=Math.round(long*r2/r1);}else{H=long;W=Math.round(long*r1/r2);}
  cv.width=W; cv.height=H;
}
function fg(){ return state.dark?"#f2eee2":"#181818"; }
function bg(){ return state.dark?"#101010":"#f6f3ea"; }

/* ---- 基础绘图（作用于 T） ---- */
function jw(){ return state.jitter*6; }
function jline(x1,y1,x2,y2){
  const j=jw();
  if(j<0.3){ T.beginPath(); T.moveTo(x1,y1); T.lineTo(x2,y2); T.stroke(); return; }
  const len=Math.hypot(x2-x1,y2-y1);
  const n=Math.max(2,Math.round(len/40));
  T.beginPath(); T.moveTo(x1+rnd(-j,j)*.3,y1+rnd(-j,j)*.3);
  for(let i=1;i<=n;i++){
    const t=i/n;
    T.lineTo(x1+(x2-x1)*t+rnd(-j,j)*.3, y1+(y2-y1)*t+rnd(-j,j)*.3);
  }
  T.stroke();
}
function jcircle(x,y,r){
  const j=jw();
  T.beginPath();
  if(j<0.3){ T.arc(x,y,Math.max(r,0.5),0,TAU); }
  else{
    const n=Math.max(16,Math.round(r/3));
    for(let i=0;i<=n;i++){
      const a=i/n*TAU, rr=r+rnd(-j,j)*.25;
      const px=x+Math.cos(a)*rr, py=y+Math.sin(a)*rr;
      i?T.lineTo(px,py):T.moveTo(px,py);
    }
  }
  T.stroke();
}
function jarc(x,y,r,a1,a2){
  const j=jw();
  T.beginPath();
  const span=Math.abs(a2-a1);
  const n=Math.max(8,Math.round(span*r/30));
  for(let i=0;i<=n;i++){
    const a=a1+(a2-a1)*i/n, rr=r+rnd(-j,j)*.25;
    const px=x+Math.cos(a)*rr, py=y+Math.sin(a)*rr;
    i?T.lineTo(px,py):T.moveTo(px,py);
  }
  T.stroke();
}
function dashLine(x1,y1,x2,y2){
  T.save(); T.setLineDash([7,6]); jline(x1,y1,x2,y2); T.restore();
}
function arrowHead(x,y,ang,size){
  const s=size||10;
  T.beginPath();
  T.moveTo(x,y); T.lineTo(x-Math.cos(ang-0.42)*s,y-Math.sin(ang-0.42)*s);
  T.moveTo(x,y); T.lineTo(x-Math.cos(ang+0.42)*s,y-Math.sin(ang+0.42)*s);
  T.stroke();
}
function faint(alpha,fn){ T.save(); T.globalAlpha=alpha; fn(); T.restore(); }
const LETTERS="ABCDEFGHLMNPRSTUVWXYZ";
function label(x,y,txt,off){
  if(!state.labels||suppressLabels) return;
  const o=off||12;
  T.save();
  T.font=`${Math.round(Math.min(W,H)*0.016)}px "SF Mono",Menlo,monospace`;
  T.fillText(txt,x+o,y-o*0.6);
  T.restore();
}
function pointDot(x,y){
  T.save(); T.beginPath(); T.arc(x,y,Math.max(2,state.lineWidth*1.6),0,TAU); T.fill(); T.restore();
}
function randLabel(){
  let t=pick(LETTERS);
  if(chance(.35)) t+="′";
  else if(chance(.25)) t+=pick(["₁","₂","₃"]);
  return t;
}

/* ============================================================
   通用构件：星形多边形 {m/k} —— 永远规则闭合
============================================================ */
function starPolygon(cx,cy,r,m,k,a0){
  const pts=[];
  for(let i=0;i<m;i++){
    const a=a0+i/m*TAU;
    pts.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r]);
  }
  for(let i=0;i<m;i++){
    const p1=pts[i], p2=pts[(i+k)%m];
    jline(p1[0],p1[1],p2[0],p2[1]);
  }
  return pts;
}
function regularRing(cx,cy,r,m,a0){
  const pts=[];
  for(let i=0;i<m;i++){
    const a=a0+i/m*TAU;
    pts.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r]);
  }
  return pts;
}

/* ============================================================
   生成器 1：网格构图（规则面板研究稿）
   每个面板内部：统一的构造体系，面板间保持同族
============================================================ */
function genGrid(bx,by,bw,bh){
  const n=state.gridSize;
  const cw=bw/n, ch=bh/n;
  const comp=state.complexity, dens=state.density/12;
  // 统一性：对称开启时整幅用同一种构造（像研究稿）；否则每格独立但同族
  const uniform=state.symmetry>=1||chance(.5);
  const motifPool=["star","nest","arcs","vesica","star","arcs","vesica","nest","diag"];   // diag 概率压低
  const globalMotif=pick(motifPool);
  const globalM=rndi(5,6+comp*2);
  let gk=rndi(2,Math.floor((globalM-1)/2));
  while(gcd(globalM,gk)!==1&&gk>2) gk--;

  for(let gy=0;gy<n;gy++)for(let gx=0;gx<n;gx++){
    if(!uniform&&!chance(0.35+dens*0.55)) continue;
    const x=bx+gx*cw, y=by+gy*ch;
    const s=Math.min(cw,ch)*0.84;
    const cx=x+cw/2, cy=y+ch/2, hs=s/2;
    const L=cx-hs,Tp=cy-hs,Rr=cx+hs,B=cy+hs;
    // 面板边框
    faint(0.9,()=>T.strokeRect(L,Tp,s,s));
    // 面板编号标注（字母标注开关控制）
    if(chance(.7)) faint(.55,()=>label(L,Tp,LETTERS[(gy*n+gx)%26]+(gy*n+gx+1),6));
    // 淡构造线：中线 + 比例线
    if(state.construction) faint(0.3,()=>{
      jline(cx,Tp,cx,B); jline(L,cy,Rr,cy);
      const f=pickRatio();
      jline(L+s*f,Tp,L+s*f,B);
    });
    const motif=uniform?globalMotif:pick(motifPool);
    // 曲率插值：曲率低 → 直线元素占比高；曲率高 → 弧/圆元素占比高
    const curv=state.curvature;
    if(motif==="diag"&&chance(curv*0.9)){
      // 高曲率：对角线降级为辅助线，改为多角弧
      faint(.35,()=>{jline(L,Tp,Rr,B); jline(L,B,Rr,Tp);});
      const corners=[[L,Tp],[Rr,Tp],[L,B],[Rr,B]];
      corners.forEach(([px,py],i)=>{
        const r=s*RATIOS[(i+1)%RATIOS.length];
        const a0=Math.atan2(cy-py,cx-px);
        jarc(px,py,r,a0-Math.PI/3,a0+Math.PI/3);
      });
    }else if(motif==="star"){
      const m=uniform?globalM:rndi(5,6+comp*2);
      let k=rndi(2,Math.floor((m-1)/2));
      while(gcd(m,k)!==1&&k>2) k--;
      starPolygon(cx,cy,hs*0.92,m,k,-Math.PI/2);
      if(state.construction&&chance(.5))
        faint(.35,()=>jcircle(cx,cy,hs*0.92));
    }else if(motif==="nest"){
      // 螺旋嵌套方：每层按固定比例缩小、固定角度旋转
      const q=2+comp;
      const ratio=pick([1/PHI,0.7,2/3]);
      const angStep=chance(.5)?0:rnd(Math.PI/12,Math.PI/6);
      let cs=s*0.92, ca=0;
      for(let i=0;i<q;i++){
        if(chance(curv*0.8)){
          // 高曲率：嵌套圆
          jcircle(cx,cy,cs/2);
        }else{
          T.save(); T.translate(cx,cy); T.rotate(ca);
          T.strokeRect(-cs/2,-cs/2,cs,cs);
          T.restore();
        }
        if(state.construction) faint(.3,()=>jline(cx,cy,cx+Math.cos(ca)*cs/2,cy+Math.sin(ca)*cs/2));
        cs*=ratio; ca+=angStep;
      }
    }else if(motif==="arcs"){
      // 四角谐波弧 + 对角线：弧半径全部来自比例数列
      // 曲率低时，弧线替换为弦线（弧↔弦过渡）
      const corners=[[L,Tp],[Rr,Tp],[L,B],[Rr,B]];
      jline(L,B,Rr,Tp);
      corners.forEach(([px,py],i)=>{
        if(!chance(.3+dens*.55)) return;
        const r=s*RATIOS[(i+rndi(0,2))%RATIOS.length];
        const a0=Math.atan2(cy-py,cx-px);
        if(chance(curv*0.85)){
          jarc(px,py,r,a0-Math.PI/4,a0+Math.PI/4);
        }else{
          // 弦：连接弧的两个端点
          const p1=[px+Math.cos(a0-Math.PI/4)*r, py+Math.sin(a0-Math.PI/4)*r];
          const p2=[px+Math.cos(a0+Math.PI/4)*r, py+Math.sin(a0+Math.PI/4)*r];
          jline(p1[0],p1[1],p2[0],p2[1]);
        }
      });
      if(chance(.5)) jline(L,Tp,Rr,B);
    }else if(motif==="vesica"){
      // 标准维西卡：两圆心距 = 半径
      const r=s/2;
      jcircle(cx-r/2,cy,r);
      jcircle(cx+r/2,cy,r);
      if(chance(.5)){
        jcircle(cx,cy-r/2,r);
        jcircle(cx,cy+r/2,r);
      }
      if(state.construction) faint(.3,()=>{jline(cx-r/2,cy,cx+r/2,cy); pointDot(cx-r/2,cy); pointDot(cx+r/2,cy);});
    }else{
      // 对角线族 + 单一比例弧（箭头开关控制端部箭头）
      jline(L,Tp,Rr,B); jline(L,B,Rr,Tp);
      if(state.arrows&&chance(.6)){
        arrowHead(Rr,B,Math.PI/4,8+state.lineWidth*2);
        arrowHead(L,B,Math.PI*0.75,8+state.lineWidth*2);
      }
      const r=s*pickRatio();
      jarc(L,B,r,-Math.PI/2,0);
      if(chance(.5)) jarc(Rr,Tp,r,Math.PI/2,Math.PI);
    }
  }
}

/* ============================================================
   生成器 2：黄金圆阵
   所有圆心吸附 φ 分割点；所有半径来自和谐数列；
   每个圆自动生成关于中轴的镜像配对 → 天然平衡
============================================================ */
function genGolden(bx,by,bw,bh){
  const cx=bx+bw/2, cy=by+bh/2;
  const comp=state.complexity, dens=state.density/12;
  const base=Math.min(bw,bh)/2;
  // 淡 φ 网格（固定位置，永远规整；辅助虚线开关控制）
  if(state.construction) faint(0.4,()=>{
    [1/(PHI*PHI),1-1/PHI,1/PHI,1-1/(PHI*PHI)].forEach(f=>{
      jline(bx+bw*f,by,bx+bw*f,by+bh);
      jline(bx,by+bh*f,bx+bw,by+bh*f);
    });
    jline(bx,by+bh,bx+bw,by);   // 对角参考线
    if(state.arrows) arrowHead(bx+bw,by,Math.atan2(-bh,bw),10+state.lineWidth*2);
  });
  // 中央维西卡组（复杂度越高，嵌套层数越多，逐层 φ 缩放）
  const vSets=1+Math.floor(comp/4);
  for(let vs=0;vs<vSets;vs++){
    const vr=base*pick([1/2,1/PHI,2/3])*Math.pow(1/PHI,vs);
    jcircle(cx-vr/2,cy,vr);
    jcircle(cx+vr/2,cy,vr);
    if(chance(.5)){ jcircle(cx,cy-vr/2,vr); jcircle(cx,cy+vr/2,vr); }
    if(vs===0&&state.construction) faint(.4,()=>{
      pointDot(cx-vr/2,cy); pointDot(cx+vr/2,cy);
      jline(cx-vr/2,cy,cx+vr/2,cy);
    });
  }
  // 吸附圆 + 镜像配对（曲率低时部分圆转为内接多边形；上限防过密）
  const nCirc=Math.min(20,Math.round(state.circleCount*(0.4+dens*0.6)));
  const curv=state.curvature;
  // 大比例圆淡出为次级层，避免密集线段交织
  for(let i=0;i<nCirc;i++){
    const px=snapX(bx,bw), py=snapY(by,bh);
    const ratio=pickRatio();
    const r=base*ratio;
    const isBig=ratio>=0.9;                   // 满比例圆降为辅助层
    const wrap=fn=>isBig?faint(.45,fn):fn();
    const asPoly=chance((1-curv)*0.5);        // 曲率越低，多边形越多
    const draw1=(qx,qy)=>{
      wrap(()=>{
        if(asPoly){
          const m=pick([3,4,6,8]);
          const rp=regularRing(qx,qy,r,m,-Math.PI/2);
          for(let j=0;j<m;j++){
            const p1=rp[j], p2=rp[(j+1)%m];
            jline(p1[0],p1[1],p2[0],p2[1]);
          }
        }else{
          jcircle(qx,qy,r);
        }
      });
    };
    draw1(px,py);
    draw1(2*cx-px,py);                        // 左右镜像配对
    if(state.symmetry>=1){
      draw1(px,2*cy-py);                      // 四象限
      draw1(2*cx-px,2*cy-py);
    }
    if(state.construction&&chance(.4)) faint(.5,()=>{pointDot(px,py); label(px,py,randLabel());});
    // 到中心的构造连线
    if(state.construction&&chance(.3)) faint(.25,()=>dashLine(cx,cy,px,py));
  }
  // 顶边比例刻度（吸附到画布内侧，防止越界）
  if(state.labels&&!suppressLabels){
    T.save(); T.font=`${Math.round(Math.min(W,H)*0.014)}px Menlo,monospace`;
    const ty=by+Math.round(Math.min(W,H)*0.022);
    [["1/Φ²",1/(PHI*PHI)],["1/Φ",1/PHI],["1/2",0.5],["1−1/Φ",1-1/PHI]].forEach(([t,f])=>{
      T.fillText(t,bx+bw*f-12,ty);
      faint(.4,()=>jline(bx+bw*f,by,bx+bw*f,by+6));
    });
    T.restore();
  }
}

/* ============================================================
   生成器 3：相切圆链
   半径按等比数列收缩，圆心沿固定步角螺旋推进，
   每圆与前一圆严格外切 → 数学上严格自洽的螺旋
============================================================ */
function genTangent(bx,by,bw,bh){
  const cx=bx+bw/2, cy=by+bh/2;
  const comp=state.complexity, dens=state.density/12;
  const n=Math.round(state.circleCount*(0.5+dens*0.7));
  const owlLike=chance(.5);   // 两种严格结构：螺旋链 / 中轴堆叠

  if(owlLike){
    /* —— 中轴堆叠（Otto 风格）：沿竖直中轴逐层相切，奇数层为镜像圆对 —— */
    let r0=bh*pick([0.11,0.13,0.09]);
    const rho=pick([0.72,0.78,0.84]);         // 收缩比
    let y=by+bh*0.07+r0;
    let prevR=0;
    const levels=Math.max(5,Math.round(n*0.8));
    if(state.construction) faint(.45,()=>{
      dashLine(cx,by+bh*0.03,cx,by+bh*0.97);
      if(state.arrows) arrowHead(cx,by+bh*0.97,Math.PI/2,10+state.lineWidth*2);
    });
    for(let i=0;i<levels;i++){
      const r=r0*Math.pow(rho,i);
      if(i>0) y+=prevR+r;
      if(y+r>by+bh*0.97) break;
      const pair=i%2===1;
      const curv=state.curvature;
      const drawBubble=(qx,qy,qr)=>{
        if(chance(0.2+curv*0.8)){ jcircle(qx,qy,qr); }
        else{
          // 低曲率：菱形（内接正方）
          jline(qx,qy-qr,qx+qr,qy); jline(qx+qr,qy,qx,qy+qr);
          jline(qx,qy+qr,qx-qr,qy); jline(qx-qr,qy,qx,qy-qr);
        }
      };
      if(pair){
        drawBubble(cx-r,y,r); drawBubble(cx+r,y,r);
        if(state.construction) faint(.6,()=>{
          jline(cx-r,y,cx+r,y); pointDot(cx,y); pointDot(cx-r,y); pointDot(cx+r,y);
          dashLine(cx,y-r,cx,y+r);
        });
      }else{
        drawBubble(cx,y,r);
        if(state.construction) faint(.6,()=>{pointDot(cx,y); label(cx,y,randLabel());});
      }
      prevR=r;
    }
    // 贯穿对角构造线（过各层圆心）
    if(state.construction) faint(.3,()=>{
      jline(bx,by+bh,cx,by+r0);
      jline(bx+bw,by+bh,cx,by+r0);
    });
    // 外接构造：过首末圆的外切大圆 + 包络线，让堆叠有归宿感
    if(state.construction&&chance(.7)) faint(.35,()=>{
      const topY=by+bh*0.07, botY=y+prevR;
      const midY=(topY+botY)/2, bigR=(botY-topY)/2+r0*0.4;
      jcircle(cx,midY,bigR);                        // 包络大圆
      // 左右包络切线
      dashLine(cx-bigR,topY,cx-bigR,botY);
      dashLine(cx+bigR,topY,cx+bigR,botY);
    });
  }else{
    /* —— 螺旋切圆链：固定步角 + 等比收缩 + 严格外切 —— */
    let r=Math.min(bw,bh)*pick([0.13,0.16,0.1]);
    let px=cx, py=cy;
    const dAng=TAU/pick([5,6,8]);             // 规则步角
    const rho=pick([0.9,0.93,0.95]);          // 等比收缩（缓慢 → 链条更长）
    let ang=rnd(0,TAU);
    let prevX=px, prevY=py;
    jcircle(px,py,r);
    if(state.construction) faint(.7,()=>{pointDot(px,py); label(px,py,"c₀");});
    for(let i=1;i<n;i++){
      const nr=r*Math.pow(rho,i);
      ang+=dAng;
      const nx=px+Math.cos(ang)*(r+nr);
      const ny=py+Math.sin(ang)*(r+nr);
      if(nx-nr<bx||nx+nr>bx+bw||ny-nr<by||ny+nr>by+bh) break;
      // 曲率插值：低曲率时圆转为菱形
      if(chance(0.25+state.curvature*0.75)){ jcircle(nx,ny,nr); }
      else{
        jline(nx,ny-nr,nx+nr,ny); jline(nx+nr,ny,nx,ny+nr);
        jline(nx,ny+nr,nx-nr,ny); jline(nx-nr,ny,nx,ny-nr);
      }
      if(state.construction) faint(.55,()=>{
        jline(px,py,nx,ny);                                   // 圆心连线
        const ta=Math.atan2(ny-py,nx-px);
        pointDot(px+Math.cos(ta)*r, py+Math.sin(ta)*r);       // 切点
        if(state.arrows) arrowHead(nx,ny,ta,8+state.lineWidth*2); // 链条方向
      });
      px=nx; py=ny; r=nr;
    }
    // 中心放射参考线
    if(state.construction) faint(.45,()=>{
      for(let k=0;k<4;k++){
        const a=k/4*TAU+Math.PI/4;
        dashLine(cx,cy,cx+Math.cos(a)*Math.min(bw,bh)*0.48,cy+Math.sin(a)*Math.min(bw,bh)*0.48);
      }
    });
  }
}

/* ============================================================
   生成器 4：场线
   极点永远对称布置（偶极/四极），力线从规则角度出射，
   等势环按等比数列分布 → 物理与几何双重秩序
============================================================ */
function genField(bx,by,bw,bh){
  const cx=bx+bw/2, cy=by+bh/2;
  const comp=state.complexity, dens=state.density/12;
  const d=Math.min(bw,bh)*pick([0.2,1/PHI*0.35,0.28]);
  // 构图骨架：外接圆或方形约束（把力线收进一个几何秩序里）
  if(state.construction) faint(.3,()=>{
    if(chance(.5)){
      jcircle(cx,cy,Math.min(bw,bh)*0.48);
    }else{
      const s=Math.min(bw,bh)*0.94;
      T.strokeRect(cx-s/2,cy-s/2,s,s);
    }
  });
  // 极点布置：偶极（异性/同性）或规则四极
  const quad=comp>=4&&chance(.4);
  let poles;
  if(quad){
    poles=[
      {x:cx-d,y:cy-d,q:1},{x:cx+d,y:cy-d,q:-1},
      {x:cx-d,y:cy+d,q:-1},{x:cx+d,y:cy+d,q:1},
    ];
  }else{
    const same=chance(.5);
    poles=[{x:cx-d,y:cy,q:1},{x:cx+d,y:cy,q:same?1:-1}];
  }
  function fieldAt(x,y){
    let ex=0,ey=0;
    for(const p of poles){
      const dx=x-p.x, dy=y-p.y, r2=dx*dx+dy*dy+40;
      const inv=p.q/(r2*Math.sqrt(r2));
      ex+=dx*inv; ey+=dy*inv;
    }
    return[ex,ey];
  }
  // 等势环：等比数列半径（圆数量 + 疏密共同驱动；辅助虚线开关控制）
  const rings=Math.round(state.circleCount*0.4+dens*4);
  if(state.construction) faint(0.55,()=>{
    for(const p of poles){
      let rr=d*0.22;
      for(let i=0;i<rings;i++){
        jcircle(p.x,p.y,rr);
        rr*=1.5;
        if(rr>Math.max(bw,bh)) break;
      }
    }
  });
  // 力线：从正极周围规则角度出射（复杂度直接驱动线数）
  const lines=Math.round(6+comp*3);
  const step=Math.min(W,H)/230;
  const positives=poles.filter(p=>p.q>0);
  const negatives=poles.filter(p=>p.q<0);
  for(const src of positives){
    for(let i=0;i<lines;i++){
      const a0=i/lines*TAU;                    // 严格均布
      let x=src.x+Math.cos(a0)*14, y=src.y+Math.sin(a0)*14;
      T.beginPath(); T.moveTo(x,y);
      let midArrow=false, prevAng=a0;
      const maxSteps=800;
      for(let s=0;s<maxSteps;s++){
        const[ex,ey]=fieldAt(x,y);
        const m=Math.hypot(ex,ey);
        if(m<1e-12) break;
        const nx=x+ex/m*step, ny=y+ey/m*step;
        T.lineTo(nx,ny);
        prevAng=Math.atan2(ny-y,nx-x);
        x=nx; y=ny;
        if(!midArrow&&s===Math.round(maxSteps*0.3)&&state.arrows) midArrow={x,y,ang:prevAng};
        let hit=false;
        for(const np of negatives) if(Math.hypot(x-np.x,y-np.y)<14){hit=true;break;}
        if(hit) break;
        // 力线裁剪在构图区内，不向外发散
        if(x<bx||x>bx+bw||y<by||y>by+bh) break;
      }
      T.stroke();
      if(midArrow) arrowHead(midArrow.x,midArrow.y,midArrow.ang,9+state.lineWidth*3);
    }
  }
  // 中轴构造线
  if(state.construction) faint(.5,()=>{
    if(!quad){ dashLine(cx-d,cy,cx+d,cy); dashLine(cx,cy-d,cx,cy+d); }
    else{ dashLine(cx-d,cy-d,cx+d,cy+d); dashLine(cx+d,cy-d,cx-d,cy+d); }
  });
  poles.forEach(p=>{ pointDot(p.x,p.y); label(p.x,p.y,p.q>0?"+":"−"); });
}

/* ============================================================
   生成器 5：投影几何
   点集落在同心圆的规则角度上；投影器、射线、弦
   全部按均匀角度/对称关系生成 → 工程图般的秩序
============================================================ */
function genProjection(bx,by,bw,bh){
  const comp=state.complexity, dens=state.density/12;
  const cx=bx+bw/2;
  const axisY=by+bh*pick([1/2,1/PHI,2/3]);
  // 主投影轴（箭头开关控制轴端箭头）
  jline(bx-30,axisY,bx+bw+30,axisY);
  if(state.arrows){
    arrowHead(bx-30,axisY,Math.PI,10+state.lineWidth*2);
    arrowHead(bx+bw+30,axisY,0,10+state.lineWidth*2);
  }
  label(bx-24,axisY,"X",-6);
  label(bx+bw+24,axisY,"Y",6);
  // 同心圆系：等比半径
  const cy=by+bh*pick([0.35,1/PHI*0.7,0.42]);
  const nC=Math.round(2+state.circleCount*0.3+dens*2);
  let rr=Math.min(bw,bh)*0.12;
  const ringRadii=[];
  const curv=state.curvature;
  for(let i=0;i<nC;i++){
    if(chance(0.15+curv*0.85)){
      jcircle(cx,cy,rr);                      // 曲率高：整圆
    }else{
      // 曲率低：环变成 4 段对称弦（直线感）
      for(let q=0;q<4;q++){
        const a0=q/4*TAU+Math.PI/4;
        jline(cx+Math.cos(a0-0.5)*rr, cy+Math.sin(a0-0.5)*rr,
              cx+Math.cos(a0+0.5)*rr, cy+Math.sin(a0+0.5)*rr);
      }
    }
    ringRadii.push(rr);
    rr*=pick([1.4,1.5,PHI*0.95]);
    if(cx+rr>bx+bw*0.98) break;
  }
  // 规则角度点集（落在最外两环上；复杂度驱动点数）
  const m=Math.min(36,pick([6,8,10,12])+Math.round(comp*1.5));
  const pts=[];
  const outerR=ringRadii[ringRadii.length-1]||Math.min(bw,bh)*0.3;
  const innerR=ringRadii[Math.max(0,ringRadii.length-2)]||outerR*0.6;
  for(let i=0;i<m;i++){
    const a=i/m*TAU-Math.PI/2;
    const r=i%2===0?outerR:innerR;    // 奇偶交错落环
    pts.push({x:cx+Math.cos(a)*r, y:cy+Math.sin(a)*r, lb:randLabel(), a});
  }
  // 垂直投影器（虚线到轴）
  if(state.construction) faint(.55,()=>{
    pts.forEach(p=>{
      if(p.y<axisY-4||p.y>axisY+4) dashLine(p.x,p.y,p.x,axisY);
    });
  });
  // 规则弦：每个点连第 k 个点（星形弦系；曲率控制直弦↔弧弦）
  const k=pick([2,3,Math.max(2,Math.floor(m/2)-1)]);
  faint(0.85,()=>{
    for(let i=0;i<m;i++){
      if(!chance(.25+dens*.6)) continue;
      const p1=pts[i], p2=pts[(i+k)%m];
      if(chance(0.3+curv*0.7)){
        jline(p1.x,p1.y,p2.x,p2.y);                       // 高曲率：直弦
      }else{
        // 低曲率：弦替换为过两点的弓弧
        const mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2;
        const dx=p2.x-p1.x, dy=p2.y-p1.y, L=Math.hypot(dx,dy);
        if(L>4){
          const nx=-dy/L, ny=dx/L, h=L*0.3;
          const ccx=mx+nx*h, ccy=my+ny*h;
          const cr=Math.hypot(L/2,h);
          jarc(ccx,ccy,cr,Math.atan2(p1.y-ccy,p1.x-ccx),Math.atan2(p2.y-ccy,p2.x-ccx));
        }
      }
    }
  });
  // 灭点射线：灭点在中轴上，对称布置
  const vp={x:cx, y:by+bh*0.94};
  if(state.construction||chance(.6)){
    faint(.65,()=>{
      pts.forEach((p,i)=>{
        if(i%2===0){
          jline(vp.x,vp.y,p.x,p.y);
          if(state.arrows) arrowHead(p.x,p.y,Math.atan2(p.y-vp.y,p.x-vp.x),8+state.lineWidth*2);
        }
      });
    });
    pointDot(vp.x,vp.y); label(vp.x,vp.y,pick(["H₁","V","Π₁"]));
  }
  // 点与标注
  pts.forEach(p=>{ if(chance(.3+dens*.55)){ pointDot(p.x,p.y); label(p.x,p.y,p.lb); } });
  // 轴上刻度
  if(state.labels&&!suppressLabels){
    faint(.7,()=>{
      [1/4,1/2,3/4].forEach(f=>{
        jline(bx+bw*f,axisY-6,bx+bw*f,axisY+6);
      });
    });
  }
}

/* ============================================================
   生成器 6：黄金螺旋（斐波那契矩形分割）
   黄金矩形按 1/φ 递归切成正方形序列，
   每个正方形内接四分之一圆弧，连成黄金螺旋；
   可选对角线、细分网格、内切圆、斐波那契数标注
============================================================ */
function genFibonacci(bx,by,bw,bh){
  const comp=state.complexity, dens=state.density/12, curv=state.curvature;
  // 构造起始黄金矩形（长边贴合画布）
  let rx,ry,rw,rh;
  if(bw>=bh){ rh=bh; rw=bh*PHI; if(rw>bw){rw=bw;rh=bw/PHI;} }
  else{ rw=bw; rh=bw*PHI; if(rh>bh){rh=bh;rw=bh/PHI;} }
  rx=bx+(bw-rw)/2; ry=by+(bh-rh)/2;
  // 主外框
  T.strokeRect(rx,ry,rw,rh);
  // 递归分割：每层切下一个正方形，记录正方形与切分方向
  // dir: 0=正方形在左,1=下,2=右,3=上（顺时针旋转）
  const levels=Math.max(4,Math.min(14,3+comp));
  const squares=[];              // {x,y,s,dir}
  let x=rx,y=ry,w=rw,h=rh;
  let dir = w>=h ? 0 : 1;        // 横放先切左，竖放先切下
  for(let i=0;i<levels;i++){
    const s=Math.min(w,h);
    if(s<2) break;
    let sq;
    if(dir===0){ sq={x:x,y:y,s:s,dir:dir}; x+=s; w-=s; }
    else if(dir===1){ sq={x:x,y:y,s:s,dir:dir}; y+=s; h-=s; }
    else if(dir===2){ sq={x:x+w-s,y:y,s:s,dir:dir}; w-=s; }
    else{ sq={x:x,y:y+h-s,s:s,dir:dir}; h-=s; }
    squares.push(sq);
    dir=(dir+1)%4;
    if(Math.min(w,h)<Math.min(rw,rh)*0.004) break;
  }
  // 正方形分割线（构造层）：只跳过与外框完全重合的第一个正方形
  squares.forEach((sq,i)=>{
    if(i===0) return;                       // 第一个是外框本身
    T.save(); T.globalAlpha=i<4?0.9:0.55;   // 前面清晰、深处渐淡
    T.strokeRect(sq.x,sq.y,sq.s,sq.s);
    T.restore();
  });
  // 内接元素：四分之一弧 / 内切圆 / 弦，曲率控制
  // 圆心 = 「切割边对面的角」（验证过的黄金螺旋映射），端点 = 与圆心等距的两角，
  // 弧必然落在本正方形内且与相邻弧首尾相接 → 连续黄金螺旋
  const centerMap={0:[1,1],1:[0,1],2:[0,0],3:[1,0]};  // dir→圆心角(边长系数)
  squares.forEach((sq,i)=>{
    const s=sq.s;
    if(s<4) return;
    const X=sq.x, Y=sq.y;
    const[fx,fy]=centerMap[sq.dir];
    const center=[X+fx*s, Y+fy*s];
    const corners=[[X,Y],[X+s,Y],[X,Y+s],[X+s,Y+s]];
    const ends=corners.filter(c=>Math.abs(Math.hypot(c[0]-center[0],c[1]-center[1])-s)<Math.max(1,s*0.01));
    if(ends.length!==2) return;
    const[c1,c2]=ends;
    const a1=Math.atan2(c1[1]-center[1],c1[0]-center[0]);
    const a2=Math.atan2(c2[1]-center[1],c2[0]-center[0]);
    let sweep=a2-a1;
    while(sweep>Math.PI) sweep-=TAU;
    while(sweep<-Math.PI) sweep+=TAU;
    const aEnd=a1+sweep;
    if(chance(0.15+curv*0.85)){
      jarc(center[0],center[1],s,a1,aEnd);            // 高曲率：四分之一圆弧（连成螺旋）
    }else{
      jline(c1[0],c1[1],c2[0],c2[1]);                 // 低曲率：弦替代
    }
    // 疏密驱动附加元素：内切圆、对角线、构造点
    if(s>Math.min(rw,rh)*0.02){
      if(chance(dens*0.45)){ faint(.8,()=>jcircle(sq.x+s/2,sq.y+s/2,s/2)); }   // 内切圆
      if(state.construction&&chance(dens*0.5)){
        faint(.35,()=>{
          if(sq.dir%2===0){ jline(sq.x,sq.y,sq.x+s,sq.y+s); }
          else{ jline(sq.x+s,sq.y,sq.x,sq.y+s); }
          pointDot(sq.x+s/2,sq.y+s/2);
        });
      }
      // 大正方形的 φ 细分网格
      if(i<3&&chance(dens*0.6)){
        faint(.3,()=>{
          const f=1/PHI;
          jline(sq.x+s*f,sq.y,sq.x+s*f,sq.y+s);
          jline(sq.x,sq.y+s*f,sq.x+s,sq.y+s*f);
        });
      }
      // 斐波那契数标注
      if(i<8&&chance(.4+dens*.5)){
        const fib=[1,1,2,3,5,8,13,21][i]||"";
        faint(.6,()=>label(sq.x+s/2,sq.y+s/2,String(fib),4));
      }
    }
  });
  // 主对角线（叠加大圆与对角线的经典构图）
  if(state.construction) faint(.28,()=>{
    jline(rx,ry,rx+rw,ry+rh);
    if(state.arrows) arrowHead(rx+rw,ry+rh,Math.atan2(rh,rw),10+state.lineWidth*2);
    if(chance(.5)) jline(rx,ry+rh,rx+rw,ry);
  });
  // 黄金比例标注
  if(state.labels&&!suppressLabels){
    T.save(); T.font=`${Math.round(Math.min(W,H)*0.015)}px Menlo,monospace`;
    T.fillText("1",rx+rw-24,ry-8);
    T.fillText("φ",rx+rw/2-8,ry+rh+20);
    T.restore();
  }
}

/* ============================================================
   SVG 记录上下文：实现 canvas 2D 的子集接口，
   把绘制指令记录为矢量路径（坐标经 CTM 变换后写入）
============================================================ */
class SVGCtx{
  constructor(){
    this.ctm=[1,0,0,1,0,0];
    this.stack=[];
    this.strokeStyle="#000"; this.fillStyle="#000";
    this.lineWidth=1; this.lineCap="round"; this.lineJoin="round";
    this.globalAlpha=1; this.font="16px monospace";
    this.dash=[];
    this.path=[];
    this.elems=[];
  }
  save(){ this.stack.push({ctm:this.ctm.slice(),strokeStyle:this.strokeStyle,fillStyle:this.fillStyle,
    lineWidth:this.lineWidth,globalAlpha:this.globalAlpha,dash:this.dash.slice(),font:this.font}); }
  restore(){ const s=this.stack.pop(); if(!s)return;
    this.ctm=s.ctm; this.strokeStyle=s.strokeStyle; this.fillStyle=s.fillStyle;
    this.lineWidth=s.lineWidth; this.globalAlpha=s.globalAlpha; this.dash=s.dash; this.font=s.font;
  }
  _mul(m){
    const[a,b,c,d,e,f]=this.ctm,[g,h,i,j,k,l]=m;
    this.ctm=[a*g+c*h, b*g+d*h, a*i+c*j, b*i+d*j, a*k+c*l+e, b*k+d*l+f];
  }
  setTransform(a,b,c,d,e,f){ this.ctm=[a,b,c,d,e,f]; }
  translate(x,y){ this._mul([1,0,0,1,x,y]); }
  rotate(a){ const c=Math.cos(a),s=Math.sin(a); this._mul([c,s,-s,c,0,0]); }
  scale(x,y){ this._mul([x,0,0,y===undefined?x:y,0,0]); }
  _pt(x,y){ const[a,b,c,d,e,f]=this.ctm; return [a*x+c*y+e, b*x+d*y+f]; }
  beginPath(){ this.path=[]; }
  moveTo(x,y){ this.path.push(["M",...this._pt(x,y)]); }
  lineTo(x,y){ this.path.push(["L",...this._pt(x,y)]); }
  arc(x,y,r,a1,a2){
    let sweep=a2-a1;
    if(Math.abs(sweep)<1e-6) return;
    const n=Math.max(24,Math.round(Math.abs(sweep)*r/6));
    for(let i=0;i<=n;i++){
      const a=a1+sweep*i/n;
      const p=this._pt(x+Math.cos(a)*r,y+Math.sin(a)*r);
      this.path.push([i?"L":"M",...p]);
    }
    if(Math.abs(sweep)>=TAU-0.01) this.path.push(["Z"]);
  }
  _d(){
    return this.path.map(c=>c[0]==="Z"?"Z":`${c[0]}${c[1].toFixed(2)} ${c[2].toFixed(2)}`).join("");
  }
  _alpha(){ return this.globalAlpha<1?` opacity="${this.globalAlpha.toFixed(3)}"`:""; }
  stroke(){
    if(this.path.length<2) return;
    let a=`fill="none" stroke="${this.strokeStyle}" stroke-width="${(+this.lineWidth).toFixed(2)}"`+
          ` stroke-linecap="${this.lineCap}" stroke-linejoin="${this.lineJoin}"`+this._alpha();
    if(this.dash.length) a+=` stroke-dasharray="${this.dash.join(" ")}"`;
    this.elems.push(`<path d="${this._d()}" ${a}/>`);
  }
  fill(){
    if(this.path.length<2) return;
    this.elems.push(`<path d="${this._d()}" fill="${this.fillStyle}" stroke="none"${this._alpha()}/>`);
  }
  strokeRect(x,y,w,h){
    this.beginPath();
    this.moveTo(x,y); this.lineTo(x+w,y); this.lineTo(x+w,y+h); this.lineTo(x,y+h);
    this.path.push(["Z"]);
    this.stroke();
  }
  fillRect(x,y,w,h){
    this.beginPath();
    this.moveTo(x,y); this.lineTo(x+w,y); this.lineTo(x+w,y+h); this.lineTo(x,y+h);
    this.path.push(["Z"]);
    this.fill();
  }
  setLineDash(arr){ this.dash=arr; }
  clearRect(){ /* SVG 无需清除 */ }
  fillText(t,x,y){
    const esc=String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const size=parseFloat(this.font)||16;
    const[a,b,c,d,e,f]=this.ctm;
    this.elems.push(`<text transform="matrix(${a.toFixed(4)} ${b.toFixed(4)} ${c.toFixed(4)} ${d.toFixed(4)} ${e.toFixed(2)} ${f.toFixed(2)})"`+
      ` x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-family="Menlo,monospace" font-size="${size}"`+
      ` fill="${this.fillStyle}"${this._alpha()}>${esc}</text>`);
  }
  toSVG(w,h){
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`+
      this.elems.join("\n")+`\n</svg>`;
  }
}

/* ============================================================
   渲染主流程：对称通过「种子重绘 + 几何变换」实现，
   每个副本都是真实矢量，canvas / SVG 通用
============================================================ */
const GENS={grid:genGrid,golden:genGolden,fibonacci:genFibonacci,tangent:genTangent,field:genField,projection:genProjection};

function runGenerators(bx,by,bw,bh){
  let mode=state.mode;
  if(mode==="mix"){
    const keys=Object.keys(GENS);
    GENS[pick(keys)](bx,by,bw,bh);
    if(state.symmetry===0&&chance(.4)){
      T.save(); T.globalAlpha=0.4;             // 第二层淡化为陪衬
      GENS[pick(keys)](bx,by,bw,bh);
      T.restore();
    }
  }else{
    GENS[mode](bx,by,bw,bh);
  }
}

function drawScene(target,scaleFactor){
  T=target;
  T.setTransform(scaleFactor,0,0,scaleFactor,0,0);
  T.fillStyle=bg(); T.fillRect(0,0,W,H);
  T.fillStyle=fg(); T.strokeStyle=fg();
  T.lineWidth=state.lineWidth*(W/1600);
  T.lineCap="round"; T.lineJoin="round";
  suppressLabels=state.symmetry>=1;
  const m=state.margin*Math.min(W,H);
  const rot=state.rotation*Math.PI/180;
  const sym=state.symmetry;
  function pass(angle,mirror,alpha){
    reseed(seed);                            // 每个副本严格一致
    T.save();
    T.globalAlpha=alpha;
    T.translate(W/2,H/2); T.rotate(angle);
    if(mirror) T.scale(-1,1);
    T.translate(-W/2,-H/2);
    runGenerators(m,m,W-2*m,H-2*m);
    T.restore();
  }
  if(sym===0){
    pass(rot,false,1);
  }else if(sym===1){
    pass(rot,false,1);
    pass(rot,true,0.85);
  }else{
    // 多副本对称：份数越多透明度越低，避免叠成一团
    const n=sym===2?4:sym===3?6:8;
    const aRot=Math.max(0.32,1.6/n);
    for(let k=0;k<n;k++) pass(rot+k*TAU/n,false,k===0?1:aRot);
    if(sym>=3) for(let k=0;k<n;k++) pass(rot+(k+0.5)*TAU/n,true,aRot*0.5);
  }
}

function render(){
  drawScene(ctx,1);
  document.getElementById("canvasMeta").textContent=W+" × "+H;
  // 仅在非聚焦时刷新种子框，避免覆盖用户输入
  const si=document.getElementById("seedInput");
  if(document.activeElement!==si) si.value=seed;
}

/* ============================================================
   控制面板 UI
============================================================ */
const panel=document.getElementById("panel");
const tabsEl=document.getElementById("modeTabs");

MODES.forEach(m=>{
  const b=document.createElement("button");
  b.textContent=m.label;
  b.dataset.id=m.id;
  if(m.id===state.mode)b.classList.add("active");
  b.onclick=()=>{
    state.mode=m.id;
    tabsEl.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x.dataset.id===m.id));
    buildPanel();
    render();
  };
  tabsEl.appendChild(b);
});

function makeGroup(title,parent){
  const g=document.createElement("div");
  g.className="group";
  g.innerHTML=`<div class="group-title">${title}</div>`;
  (parent||panel).appendChild(g);
  return g;
}
function sliderCtrl(parent,p){
  const div=document.createElement("div");
  div.className="ctrl";
  div.innerHTML=`<label>${p.label}<span class="val">${state[p.key]}</span></label>`;
  const inp=document.createElement("input");
  inp.type="range"; inp.min=p.min; inp.max=p.max; inp.step=p.step; inp.value=state[p.key];
  inp.oninput=()=>{
    state[p.key]=parseFloat(inp.value);
    div.querySelector(".val").textContent=inp.value;
    render();
  };
  div.appendChild(inp);
  parent.appendChild(div);
  return inp;
}
function toggleCtrl(parent,lbl,key){
  const div=document.createElement("div");
  div.className="toggle-row";
  div.innerHTML=`<span>${lbl}</span>
    <label class="switch"><input type="checkbox" ${state[key]?"checked":""}><span class="slider-sw"></span></label>`;
  div.querySelector("input").onchange=e=>{ state[key]=e.target.checked; render(); };
  parent.appendChild(div);
  return div.querySelector("input");
}

/* ---- 动态参数区（随模式重建；操作/模式/种子区为静态 HTML） ---- */
const dynPanel=document.getElementById("dynPanel");
const aspSel=document.getElementById("aspSel");

function buildPanel(){
  dynPanel.innerHTML="";
  const cfg=MODE_CONFIG[state.mode];
  // 结构/笔触/构图滑杆（按 show 白名单 + range 覆盖量程）
  const byGroup={};
  PARAMS.forEach(p=>{
    if(!cfg.show.includes(p.key)) return;
    const ov=cfg.range[p.key]||{};
    const eff=Object.assign({},p,ov);
    // 值夹取到有效量程
    if(state[p.key]<eff.min) state[p.key]=eff.min;
    if(state[p.key]>eff.max) state[p.key]=eff.max;
    if(!byGroup[p.group]) byGroup[p.group]=makeGroup(p.group,dynPanel);
    sliderCtrl(byGroup[p.group],eff);
  });
  // 元素开关（按 hide 黑名单）
  const gSw=makeGroup("元素",dynPanel);
  const toggles=[["箭头","arrows"],["字母标注","labels"],["辅助虚线","construction"]];
  toggles.forEach(([lbl,key])=>{
    if(cfg.hide.includes(key)) return;
    toggleCtrl(gSw,lbl,key);
  });
}

/* ============================================================
   事件
============================================================ */
function randomizeParams(){
  const cfg=MODE_CONFIG[state.mode];
  PARAMS.forEach(p=>{
    if(!cfg.show.includes(p.key)) return;   // 只随机当前模式真实生效的参数
    const ov=cfg.range[p.key]||{};
    const mn=(ov.min!==undefined?ov.min:p.min), mx=(ov.max!==undefined?ov.max:p.max);
    const v=mn+R()*(mx-mn);
    state[p.key]=p.step>=1?Math.round(v):+(Math.round(v/p.step)*p.step).toFixed(2);
  });
  // 随机限幅：防止极限组合糊成一团（同时不超过模式量程）
  const clamp=(k,c)=>{const ov=cfg.range[k]||{};const mx=(ov.max!==undefined?ov.max:PARAMS.find(p=>p.key===k).max);state[k]=Math.max(ov.min!==undefined?ov.min:PARAMS.find(p=>p.key===k).min,Math.min(state[k],c,mx));};
  if(cfg.show.includes("complexity")) clamp("complexity",9);
  if(cfg.show.includes("density"))    clamp("density",9);
  if(cfg.show.includes("circleCount"))clamp("circleCount",26);
  if(cfg.show.includes("symmetry"))   clamp("symmetry",2);   // 高对称留手动
  if(cfg.show.includes("jitter"))     clamp("jitter",0.35);
  if(cfg.show.includes("lineWidth"))  clamp("lineWidth",3);
  buildPanel();   // 重建滑杆以刷新显示值
}
document.getElementById("btnRandom").onclick=()=>{
  reseed((Math.random()*1e9)|0);
  randomizeParams();
  render();
};
document.getElementById("btnReseed").onclick=()=>{
  reseed((Math.random()*1e9)|0);
  render();
};
document.getElementById("btnDice").onclick=()=>{
  reseed((Math.random()*1e9)|0);
  render();
};
document.getElementById("seedInput").onchange=e=>{
  const v=parseInt(e.target.value);
  if(!isNaN(v)){ reseed(v); render(); }
};
document.getElementById("btnInvert").onclick=()=>{
  state.dark=!state.dark;
  document.getElementById("invertTxt").textContent=state.dark?"黑底白线":"白底黑线";
  render();
};
aspSel.onchange=()=>{ setAspect(aspSel.value); render(); };
document.getElementById("btnExportPNG").onclick=()=>{
  const s=parseInt(document.getElementById("scaleSel").value)||1;
  const c2=document.createElement("canvas");
  c2.width=W*s; c2.height=H*s;
  const c2x=c2.getContext("2d");
  drawScene(c2x,s);
  const a=document.createElement("a");
  a.download=`geometry-${state.mode}-${seed}-${s}x.png`;
  a.href=c2.toDataURL("image/png");
  a.click();
};
document.getElementById("btnExportSVG").onclick=()=>{
  const s=new SVGCtx();
  drawScene(s,1);
  const blob=new Blob([s.toSVG(W,H)],{type:"image/svg+xml;charset=utf-8"});
  const a=document.createElement("a");
  a.download=`geometry-${state.mode}-${seed}.svg`;
  a.href=URL.createObjectURL(blob);
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),8000);
};

/* 首次渲染 */
const urlMode=new URLSearchParams(location.search).get("mode");
if(urlMode&&MODES.some(m=>m.id===urlMode)){
  state.mode=urlMode;
  tabsEl.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x.dataset.id===urlMode));
}
setAspect("1:1");
buildPanel();   // 首次按当前模式构建专属参数面板
render();
