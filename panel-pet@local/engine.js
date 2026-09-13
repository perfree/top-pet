// Pure state machine shared by GNOME Shell, preview and tests.
export function freeSpans(width, obstacles, size, padding = 5) {
    const ranges = obstacles.map(([a, b]) => [Math.max(0, a - padding), Math.min(width, b + padding)])
        .filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
    const spans = [];
    let edge = 0;
    for (const [a, b] of ranges) {
        if (a - edge >= size) spans.push([edge, a - size]);
        edge = Math.max(edge, b);
    }
    if (width - edge >= size) spans.push([edge, width - size]);
    return spans;
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export class PetEngine {
    constructor(random = Math.random) {
        this.random = random;
        this.x = 90; this.direction = 1; this.size = 28;
        this.state = 'walk'; this.time = 0; this.phase = 0; this.offset = 0;
        this.hunger = 70; this.joy = 70; this.hearts = 0; this.paused = false;
        this.spans = []; this.nextChoice = 5; this.seek = false; this.message = '你好呀';
    }
    layout(width, obstacles, size = 28) {
        this.size = size;
        this.spans = freeSpans(width, obstacles, size);
        if (!this.spans.length) return;
        const valid = x => this.spans.some(([a, b]) => x >= a && x <= b);
        const nearest = x => this.spans.reduce((best, [a, b]) => {
            const candidate = clamp(x, a, b);
            return Math.abs(candidate - x) < Math.abs(best - x) ? candidate : best;
        }, this.spans[0][0]);
        if (this.target !== undefined && !valid(this.target)) this.target = nearest(this.target);
        if (!valid(this.x) && !['sink', 'hidden', 'rise'].includes(this.state))
            this.portal(nearest(this.x));
    }
    portal(target, hide = false) {
        this.target = target; this.state = 'sink'; this.phase = 0; this.hideDuration = hide ? 1.8 : 0.1;
    }
    feed() {
        if (this.hunger > 94) { this.message = '肚子已经圆滚滚啦'; return; }
        this.hunger = Math.min(100, this.hunger + 24); this.joy = Math.min(100, this.joy + 5);
        this.act('eat', 2.2, '啊呜，谢谢你！');
    }
    pet() {
        const found = this.seek && this.state !== 'hidden';
        this.seek = false; this.joy = Math.min(100, this.joy + (found ? 15 : 5));
        this.hearts = 1.8; this.act('happy', 1.2, found ? '被你找到啦！' : '再摸摸我嘛');
    }
    play() { this.seek = false; this.joy = Math.min(100, this.joy + 10); this.act('run', 7, '来追我呀！'); }
    hide() {
        if (!this.spans.length) return;
        this.seek = true; this.message = '数到三，来找我';
        const span = this.spans[Math.floor(this.random() * this.spans.length)];
        this.portal(span[0] + this.random() * (span[1] - span[0]), true);
    }
    act(state, duration, message) {
        if (this.target !== undefined) this.x = this.target;
        this.target = undefined; this.offset = 0; this.state = state;
        this.phase = 0; this.nextChoice = this.time + duration; this.message = message;
    }
    tick(dt) {
        dt = clamp(dt, 0, 0.08);
        if (this.paused || !this.spans.length) return;
        this.time += dt; this.phase += dt; this.hearts = Math.max(0, this.hearts - dt);
        this.hunger = Math.max(0, this.hunger - dt * 0.035);
        this.joy = Math.max(0, this.joy - dt * 0.02);
        if (this.state === 'sink') {
            this.offset = this.size * Math.min(1, this.phase / 0.26);
            if (this.phase >= 0.26) { this.state = 'hidden'; this.phase = 0; this.offset = this.size; }
            return;
        }
        if (this.state === 'hidden') {
            if (this.phase >= this.hideDuration) {
                this.x = this.target; this.target = undefined; this.state = 'rise'; this.phase = 0;
            }
            return;
        }
        if (this.state === 'rise') {
            this.offset = this.size * (1 - Math.min(1, this.phase / 0.26));
            if (this.phase >= 0.26) this.act(this.seek ? 'peek' : 'walk', this.seek ? 5 : 3, this.seek ? '我藏在哪儿？' : '嗖——');
            return;
        }
        if (this.time >= this.nextChoice) {
            this.seek = false;
            const n = this.random();
            this.act(n < 0.22 ? 'idle' : n < 0.42 ? 'run' : 'walk', 3 + this.random() * 6, '陪你待一会儿');
            if (this.random() < 0.2) this.direction *= -1;
        }
        if (!['walk', 'run'].includes(this.state)) return;
        let index = this.spans.findIndex(([a, b]) => this.x >= a - 0.1 && this.x <= b + 0.1);
        if (index < 0) { this.portal(this.spans[0][0]); return; }
        const [a, b] = this.spans[index];
        const nx = this.x + this.direction * (this.state === 'run' ? 86 : 23) * dt;
        this.x = clamp(nx, a, b);
        if (nx > b || nx < a) {
            const next = this.spans[index + this.direction];
            if (next) this.portal(this.direction > 0 ? next[0] : next[1]);
            else this.direction *= -1;
        }
    }
}
