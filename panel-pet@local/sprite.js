// Shared animation timing for the transparent, soft 3D capybara sprite atlas.
export function getPose(pet) {
    let frame = 0;
    const phase = pet.time * (pet.state === 'run' ? 16 : 7);
    if (pet.state === 'walk') frame = [0, 1, 0, 2][Math.floor(phase) % 4];
    else if (pet.state === 'run') frame = [1, 3, 2, 3][Math.floor(phase) % 4];
    else if (pet.state === 'happy') frame = 4;
    else if (pet.state === 'eat') frame = 5;
    else if (pet.state === 'peek') frame = 6;
    else if (pet.state === 'idle') frame = 7;
    const bob = pet.state === 'run' ? -Math.abs(Math.sin(phase)) * 1.3
        : pet.state === 'walk' ? -Math.abs(Math.sin(phase)) * 0.45
        : pet.state === 'eat' ? Math.sin(pet.time * 13) * 0.3 : 0;
    return {frame, bob};
}
export function drawPet(context, atlas, pet, size) {
    if (!atlas.complete || !atlas.naturalWidth) return;
    const {frame, bob} = getPose(pet);
    const col = frame % 4; const row = Math.floor(frame / 4);
    const x = Math.floor(col * atlas.naturalWidth / 4);
    const y = Math.floor(row * atlas.naturalHeight / 2);
    const w = Math.floor((col + 1) * atlas.naturalWidth / 4) - x;
    const h = Math.floor((row + 1) * atlas.naturalHeight / 2) - y;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.translate(pet.direction < 0 ? size : 0, bob * size / 32);
    context.scale(pet.direction < 0 ? -1 : 1, 1);
    context.drawImage(atlas, x+w*0.02, y+h*0.035, w*0.975, h*0.845, 0, 0, size, size);
    context.restore();
}
