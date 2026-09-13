import test from 'node:test';
import assert from 'node:assert/strict';
import {PetEngine, freeSpans} from '../panel-pet@local/engine.js';
const advance = (pet, seconds) => { for (let t = 0; t < seconds; t += 0.02) pet.tick(0.02); };
test('merges overlapping control areas and excludes gaps too small for a pet', () => {
    assert.deepEqual(freeSpans(200, [[70, 90], [45, 80], [110, 115]], 28), [[0, 12], [120, 172]]);
});
for (const direction of [1, -1]) test(`portal crosses icons in direction ${direction}, hidden during position change`, () => {
    const p = new PetEngine(() => 0.7); p.layout(300, [[130, 160]]);
    p.x = direction === 1 ? 97 : 165; p.direction = direction;
    p.tick(0.05); assert.equal(p.state, 'sink');
    const initial = p.x; advance(p, 0.28);
    assert.equal(p.state, 'hidden'); assert.equal(p.x, initial); assert.equal(p.offset, p.size);
    advance(p, 0.12); assert.equal(p.state, 'rise');
    assert.equal(p.x, direction === 1 ? 165 : 97);
    advance(p, 0.3); assert.equal(p.offset, 0); assert.equal(p.state, 'walk');
});
test('turns back at the screen edge', () => {
    const p = new PetEngine(); p.layout(200, []); p.x = 172; p.tick(0.05);
    assert.equal(p.direction, -1); assert.equal(p.x, 172);
});
test('no room safely suspends movement; layout can recover', () => {
    const p = new PetEngine(); p.layout(20, []); p.tick(0.05); assert.equal(p.time, 0);
    p.layout(300, []); p.tick(0.05); assert.ok(p.time > 0);
});
test('geometry changing during teleport retargets a valid free location', () => {
    const p = new PetEngine(); p.layout(300, [[130, 160]]); p.portal(165);
    advance(p, 0.3); p.layout(220, [[130, 200]]); advance(p, 0.5);
    assert.ok(p.spans.some(([a, b]) => p.x >= a && p.x <= b));
});
test('feeding and affection are bounded and feeding recovers from teleport', () => {
    const p = new PetEngine(); p.layout(300, []); p.portal(120); p.feed();
    assert.equal(p.state, 'eat'); assert.equal(p.x, 120); assert.equal(p.offset, 0);
    for (let i = 0; i < 30; i++) { p.feed(); p.pet(); }
    assert.ok(p.hunger <= 100); assert.equal(p.joy, 100);
});
test('hide and seek includes a hidden wait and a clickable reveal', () => {
    const p = new PetEngine(() => 0.5); p.layout(400, [[190, 220]]); p.hide();
    advance(p, 1); assert.equal(p.state, 'hidden');
    advance(p, 1.5); assert.equal(p.state, 'peek');
    p.pet(); assert.equal(p.message, '被你找到啦！'); assert.equal(p.seek, false);
});
test('pause freezes state and elapsed time', () => {
    const p = new PetEngine(); p.layout(300, []); p.paused = true;
    advance(p, 3); assert.equal(p.time, 0); assert.equal(p.x, 90);
});
test('random walks and changing panels never paint onto obstacles when fully visible', () => {
    let seed = 17; const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const p = new PetEngine(random);
    for (let i = 0; i < 20000; i++) {
        if (i % 100 === 0) p.layout(300 + random() * 500, [[100, 150], [230, 250]]);
        p.tick(0.033);
        if (!['sink', 'hidden', 'rise'].includes(p.state))
            assert.ok(p.spans.some(([a, b]) => p.x >= a - 0.001 && p.x <= b + 0.001));
        assert.ok(Number.isFinite(p.x));
    }
});
