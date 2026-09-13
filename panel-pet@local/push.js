// Plan a temporary pocket between adjacent controls, propagating displacement
// through neighbours without changing their order or leaving the screen.
export function planPocket(width, ranges, size, x, direction, padding = 6) {
    if (ranges.length < 2) return null;
    const widths = ranges.map(([a,b]) => b-a);
    const candidates = [];
    for (let i=0;i<ranges.length-1;i++) {
        const gap=ranges[i+1][0]-ranges[i][1];
        const ahead=direction>0 ? ranges[i][1]>=x+size-1 : ranges[i+1][0]<=x+1;
        const distance = direction>0 ? ranges[i][0]-(x+size) : x-ranges[i+1][1];
        if (!ahead || distance>size*3 || gap>=size+padding*2 || gap<0) continue;
        candidates.push(i);
    }
    if (direction<0) candidates.reverse();
    for (const i of candidates) {
        const needed=size+padding*2-(ranges[i+1][0]-ranges[i][1]);
        const leftCap=ranges[i][0]-widths.slice(0,i).reduce((a,b)=>a+b,0)-padding*i;
        const rightCap=width-ranges[i+1][1]-widths.slice(i+2).reduce((a,b)=>a+b,0)-padding*(ranges.length-i-2);
        if (leftCap<0 || rightCap<0 || leftCap+rightCap<needed) continue;
        const left=Math.min(leftCap, Math.max(needed/2,needed-rightCap));
        const right=needed-left;
        const positions=ranges.map(r=>r[0]);
        positions[i]-=left;
        for(let j=i-1;j>=0;j--) positions[j]=Math.min(positions[j],positions[j+1]-padding-widths[j]);
        positions[i+1]+=right;
        for(let j=i+2;j<ranges.length;j++) positions[j]=Math.max(positions[j],positions[j-1]+widths[j-1]+padding);
        if(positions[0]<-0.01 || positions.at(-1)+widths.at(-1)>width+0.01) continue;
        return {target:positions[i]+widths[i]+padding, shifts:positions.map((p,j)=>p-ranges[j][0]),
            ranges:positions.map((p,j)=>[p,p+widths[j]])};
    }
    return null;
}
