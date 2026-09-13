// Plan a temporary pocket between adjacent controls, propagating displacement
// through neighbours without changing their order or leaving the screen.
export function planPocket(width, ranges, size, x, direction, padding = 6) {
    if (!ranges.length) return null;
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
        const leftCap=ranges[i][0]-widths.slice(0,i).reduce((a,b)=>a+b,0);
        const rightCap=width-ranges[i+1][1]-widths.slice(i+2).reduce((a,b)=>a+b,0);
        if (leftCap<0 || rightCap<0 || leftCap+rightCap<needed) continue;
        const left=Math.min(leftCap, Math.max(needed/2,needed-rightCap));
        const right=needed-left;
        const positions=ranges.map(r=>r[0]);
        positions[i]-=left;
        for(let j=i-1;j>=0;j--) positions[j]=Math.min(positions[j],positions[j+1]-widths[j]);
        positions[i+1]+=right;
        for(let j=i+2;j<ranges.length;j++) positions[j]=Math.max(positions[j],positions[j-1]+widths[j-1]);
        if(positions[0]<-0.01 || positions.at(-1)+widths.at(-1)>width+0.01) continue;
        return {target:positions[i]+widths[i]+padding, shifts:positions.map((p,j)=>p-ranges[j][0]),
            ranges:positions.map((p,j)=>[p,p+widths[j]])};
    }
    // A single control group at an edge also needs a pocket: move the group
    // toward the runway and let the pet emerge between it and the screen edge.
    const positions=ranges.map(r=>r[0]);
    const needed=size+padding;
    if(direction<0 && ranges[0][1]<=x+1 && x-ranges[0][1]<=size*3 && ranges[0][0]<needed) {
        positions[0]=needed;
        for(let j=1;j<ranges.length;j++) positions[j]=Math.max(positions[j],positions[j-1]+widths[j-1]);
        if(positions.at(-1)+widths.at(-1)>width) return null;
        return {target:0,shifts:positions.map((p,j)=>p-ranges[j][0]),ranges:positions.map((p,j)=>[p,p+widths[j]])};
    }
    if(direction>0 && ranges.at(-1)[0]>=x+size-1 && ranges.at(-1)[0]-x-size<=size*3 && width-ranges.at(-1)[1]<needed) {
        positions[positions.length-1]=width-needed-widths.at(-1);
        for(let j=positions.length-2;j>=0;j--) positions[j]=Math.min(positions[j],positions[j+1]-widths[j]);
        if(positions[0]<0)return null;
        return {target:width-size,shifts:positions.map((p,j)=>p-ranges[j][0]),ranges:positions.map((p,j)=>[p,p+widths[j]])};
    }
    return null;
}
