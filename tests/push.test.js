import test from 'node:test';
import assert from 'node:assert/strict';
import {planPocket} from '../panel-pet@local/push.js';
for (const direction of [1,-1]) test(`opens a pocket and propagates displacement ${direction}`,()=>{
    const ranges=[[0,40],[180,220],[222,262],[264,304],[460,500]];
    const p=planPocket(500,ranges,60,direction>0?110:350,direction);
    assert.ok(p); assert.ok(p.shifts.some(x=>x!==0));
    assert.ok(p.ranges.some((r,i)=>i<p.ranges.length-1 && p.target>=r[1]+5 && p.target+60<=p.ranges[i+1][0]-5));
    p.ranges.forEach(([a,b],i)=>{assert.ok(a>=0&&b<=500);if(i)assert.ok(a>=p.ranges[i-1][1]);});
});
test('fully occupied panel is left unchanged',()=>assert.equal(planPocket(200,[[0,50],[50,100],[100,150],[150,200]],60,0,1),null));
test('existing large gaps do not cause pointless displacement',()=>assert.equal(planPocket(500,[[0,40],[200,240],[460,500]],60,50,1),null));
test('many dense layouts remain bounded and ordered',()=>{
 for(let n=2;n<14;n++)for(const d of [-1,1]){
  const ranges=Array.from({length:n},(_,i)=>[100+i*26,124+i*26]);
  const p=planPocket(800,ranges,76,d>0?0:700,d);
  if(p)p.ranges.forEach(([a,b],i)=>{assert.ok(a>=0&&b<=800);if(i)assert.ok(a>=p.ranges[i-1][1]);});
 }
});

for (const direction of [1,-1]) test(`zero-gap icons anchored to screen edge ${direction}`,()=>{
 const ranges=direction>0?[[0,40],[340,380],[380,420],[420,460],[460,500]]:[[0,40],[40,80],[80,120],[120,160],[460,500]];
 const p=planPocket(500,ranges,60,direction>0?275:165,direction);
 assert.ok(p, 'edge-anchored group borrows space from adjacent runway');
 assert.ok(p.shifts.some(n=>Math.abs(n)>1));
 p.ranges.forEach(([a,b],i)=>{assert.ok(a>=0&&b<=500);if(i)assert.ok(a>=p.ranges[i-1][1]);});
});

for (const d of [-1,1]) test(`single grouped control can make room at screen edge ${d}`,()=>{
 const ranges=d>0?[[400,500]]:[[0,100]];
 const p=planPocket(500,ranges,60,d>0?335:105,d);
 assert.ok(p);assert.equal(p.target,d>0?440:0);
 assert.ok(p.ranges[0][0]>=0&&p.ranges[0][1]<=500);
});
