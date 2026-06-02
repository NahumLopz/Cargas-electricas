// ═══════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════
const K = 8.99e9;
const MICRO = 1e-6;
const EPS = 1e-10;

// ═══════════════════════════════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════════════════════════════
let charges = [];
let selectedId = null;
let selectedId2 = null;
let mode = '2d';
let showForces = true;
let showField = false;
let showFieldLines = false;
let fieldPoints = [];
let nextId = 1;
let drag = null;
let worldCenter = {x: 0, y: 0};
let scale = 50;

// ═══════════════════════════════════════════════════════════════════
// DOM REFS
// ═══════════════════════════════════════════════════════════════════
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const chargeListEl = document.getElementById('chargeList');
const editX = document.getElementById('editX');
const editY = document.getElementById('editY');
const editQ = document.getElementById('editQ');
const resultsBox = document.getElementById('resultsBox');
const chkForces = document.getElementById('chkForces');
const chkField = document.getElementById('chkField');
const chkFieldLines = document.getElementById('chkFieldLines');
const fieldX = document.getElementById('fieldX');
const fieldY = document.getElementById('fieldY');

// ═══════════════════════════════════════════════════════════════════
// COORDENADAS
// ═══════════════════════════════════════════════════════════════════
function worldToScreen(wx, wy) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    return { x: cx + (wx - worldCenter.x) * scale, y: cy - (wy - worldCenter.y) * scale };
}

function screenToWorld(sx, sy) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    return { x: (sx - cx) / scale + worldCenter.x, y: (cy - sy) / scale + worldCenter.y };
}

// ═══════════════════════════════════════════════════════════════════
// FÍSICA
// ═══════════════════════════════════════════════════════════════════
function coulombForce(q1, q2, dx, dy) {
    const r2 = dx * dx + dy * dy;
    if (r2 < 0.01) return { fx: 0, fy: 0 };
    const r = Math.sqrt(r2);
    const f = K * q1 * q2 / r2;
    return { fx: f * dx / r, fy: f * dy / r };
}

function netForceOn(charge) {
    let fx = 0, fy = 0;
    const pairs = [];
    for (const other of charges) {
        if (other.id === charge.id) continue;
        const dx = charge.x - other.x;
        const dy = charge.y - other.y;
        const r2 = dx * dx + dy * dy;
        if (r2 < 0.01) continue;
        const r = Math.sqrt(r2);
        const f = K * charge.q * other.q / r2;
        const pfx = f * dx / r;
        const pfy = f * dy / r;
        fx += pfx;
        fy += pfy;
        pairs.push({ other, fx: pfx, fy: pfy, mag: Math.sqrt(pfx*pfx + pfy*pfy) });
    }
    return { fx, fy, mag: Math.sqrt(fx*fx + fy*fy), pairs };
}

function electricFieldAt(px, py) {
    let ex = 0, ey = 0;
    for (const c of charges) {
        const dx = px - c.x;
        const dy = py - c.y;
        const r2 = dx * dx + dy * dy;
        if (r2 < 0.01) continue;
        const r = Math.sqrt(r2);
        const e = K * c.q / r2;
        ex += e * dx / r;
        ey += e * dy / r;
    }
    return { ex, ey, mag: Math.sqrt(ex*ex + ey*ey) };
}

function fieldFromCharge(c, px, py) {
    const dx = px - c.x;
    const dy = py - c.y;
    const r2 = dx * dx + dy * dy;
    if (r2 < 0.01) return { ex: 0, ey: 0, mag: 0 };
    const r = Math.sqrt(r2);
    const e = K * c.q / r2;
    return { ex: e * dx / r, ey: e * dy / r, mag: Math.abs(e) };
}

// ═══════════════════════════════════════════════════════════════════
// RENDERIZADO
// ═══════════════════════════════════════════════════════════════════
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    calcScale();
    drawGrid();
    drawAxes();

    // Field lines
    if (showFieldLines) {
        drawFieldLines();
    }

    // Field vectors (recalculate each frame to stay current)
    if (showField) {
        for (const fp of fieldPoints) {
            const e = electricFieldAt(fp.x, fp.y);
            fp.ex = e.ex;
            fp.ey = e.ey;
            drawFieldVector(fp);
        }
    }

    // Charges
    for (const c of charges) {
        drawCharge(c, c.id === selectedId);
    }

if (showForces && selectedId !== null) {

    const sel = charges.find(c => c.id === selectedId);

    if (sel) {

        const result = netForceOn(sel);

        if (result.mag > 1e-20) {

            drawForceArrow(
                sel,
                result.fx,
                result.fy,
                result.mag
            );

            drawComponents(
                sel,
                result.fx,
                result.fy
            );
        }
    }
}

    // Legend
    drawLegend();
}

function calcScale() {
    const worldW = 12;
    const worldH = 12;
    const sx = canvas.width / worldW;
    const sy = canvas.height / worldH;
    scale = Math.min(sx, sy) * 0.95;
}

function drawGrid() {
    const bounds = getWorldBounds();
    const step = 1;
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 0.5;

    const startX = Math.floor(bounds.xMin / step) * step;
    const endX = Math.ceil(bounds.xMax / step) * step;
    const startY = Math.floor(bounds.yMin / step) * step;
    const endY = Math.ceil(bounds.yMax / step) * step;

    for (let wx = startX; wx <= endX; wx += step) {
        if (Math.abs(wx) < 0.01) continue;
        const p1 = worldToScreen(wx, bounds.yMin);
        const p2 = worldToScreen(wx, bounds.yMax);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }

    for (let wy = startY; wy <= endY; wy += step) {
        if (Math.abs(wy) < 0.01) continue;
        const p1 = worldToScreen(bounds.xMin, wy);
        const p2 = worldToScreen(bounds.xMax, wy);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }

    // Small grid
    ctx.strokeStyle = '#1e1e32';
    ctx.lineWidth = 0.3;
    const smallStep = 0.5;
    const sStartX = Math.floor(bounds.xMin / smallStep) * smallStep;
    const sEndX = Math.ceil(bounds.xMax / smallStep) * smallStep;
    const sStartY = Math.floor(bounds.yMin / smallStep) * smallStep;
    const sEndY = Math.ceil(bounds.yMax / smallStep) * smallStep;
    for (let wx = sStartX; wx <= sEndX; wx += smallStep) {
        if (Math.abs(wx % 1) < 0.01) continue;
        const p1 = worldToScreen(wx, bounds.yMin);
        const p2 = worldToScreen(wx, bounds.yMax);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }
    for (let wy = sStartY; wy <= sEndY; wy += smallStep) {
        if (Math.abs(wy % 1) < 0.01) continue;
        const p1 = worldToScreen(bounds.xMin, wy);
        const p2 = worldToScreen(bounds.xMax, wy);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }
}

function getWorldBounds() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const hw = canvas.width / (2 * scale);
    const hh = canvas.height / (2 * scale);
    return { xMin: -hw, xMax: hw, yMin: -hh, yMax: hh };
}

function drawAxes() {
    const bounds = getWorldBounds();
    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 1.5;

    // X axis
    if (bounds.yMin <= 0 && bounds.yMax >= 0) {
        const p1 = worldToScreen(bounds.xMin, 0);
        const p2 = worldToScreen(bounds.xMax, 0);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        // arrow
        const arr = worldToScreen(bounds.xMax - 0.15, 0);
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(arr.x, arr.y - 5);
        ctx.lineTo(arr.x, arr.y + 5);
        ctx.closePath();
        ctx.fillStyle = '#444466';
        ctx.fill();
    }

    // Y axis
    if (bounds.xMin <= 0 && bounds.xMax >= 0) {
        const p1 = worldToScreen(0, bounds.yMin);
        const p2 = worldToScreen(0, bounds.yMax);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        const arr = worldToScreen(0, bounds.yMax - 0.15);
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(arr.x - 5, arr.y);
        ctx.lineTo(arr.x + 5, arr.y);
        ctx.closePath();
        ctx.fillStyle = '#444466';
        ctx.fill();
    }

    // Labels
    ctx.fillStyle = '#556677';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xLabel = worldToScreen(bounds.xMax - 0.3, -0.25);
    ctx.fillText('x', xLabel.x, xLabel.y);
    ctx.textBaseline = 'bottom';
    const yLabel = worldToScreen(-0.3, bounds.yMax - 0.3);
    ctx.fillText('y', yLabel.x, yLabel.y);

    // Tick marks
    ctx.fillStyle = '#556677';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const step = 1;
    for (let wx = Math.ceil(bounds.xMin); wx <= Math.floor(bounds.xMax); wx += step) {
        if (Math.abs(wx) < 0.01) continue;
        const p = worldToScreen(wx, 0);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 3);
        ctx.lineTo(p.x, p.y + 3);
        ctx.strokeStyle = '#444466';
        ctx.stroke();
        if (mode === '2d') {
            ctx.fillText(wx.toFixed(0), p.x, p.y + 5);
        }
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let wy = Math.ceil(bounds.yMin); wy <= Math.floor(bounds.yMax); wy += step) {
        if (Math.abs(wy) < 0.01) continue;
        const p = worldToScreen(0, wy);
        ctx.beginPath();
        ctx.moveTo(p.x - 3, p.y);
        ctx.lineTo(p.x + 3, p.y);
        ctx.strokeStyle = '#444466';
        ctx.stroke();
        if (mode === '2d') {
            ctx.fillText(wy.toFixed(0), p.x - 5, p.y);
        }
    }

    // Origin label
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const o = worldToScreen(0, 0);
    ctx.fillStyle = '#556677';
    ctx.font = '10px sans-serif';
    ctx.fillText('O', o.x - 4, o.y + 4);
}

function drawCharge(c, selected) {
    const p = worldToScreen(c.x, c.y);
    if (mode === '1d') {
        c.y = 0;
        p.y = canvas.height / 2;
    }

    const absQ = Math.abs(c.q / MICRO);
    const radius = Math.max(12, Math.min(30, 10 + absQ * 2));

    // Glow
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius + 10);
    const color = c.q > 0 ? 'rgba(255,107,107,' : 'rgba(77,171,247,';
    grad.addColorStop(0, color + '0.4)');
    grad.addColorStop(1, color + '0)');
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Circle
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = c.q > 0 ? '#ff6b6b' : '#4dabf7';
    ctx.fill();
    ctx.strokeStyle = c.q > 0 ? '#ff8787' : '#74c0fc';
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.stroke();

    // Selection ring
    if (selected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffd43b';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Sign
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(14, radius * 0.7)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.q > 0 ? '+' : '−', p.x, p.y);

    // Name label above
    ctx.fillStyle = '#ccc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const nf = (c.q / MICRO).toFixed(1);
    ctx.fillText(`${c.name} = ${nf} μC`, p.x, p.y - radius - 6);
}

function drawForceArrow(charge, fx, fy, mag) {
    const p = worldToScreen(charge.x, charge.y);
    if (mode === '1d') p.y = canvas.height / 2;

    const maxLen = 80;
    let allForceMags = [];
    const sel = charges.find(c => c.id === selectedId);
    if (sel) {
        const r = netForceOn(sel);
        allForceMags.push(r.mag);
    }
    const refMag = Math.max(...allForceMags.filter(m => m > 1e-20), 1e-20);
    const finalLen = Math.max(12, Math.min(maxLen, 20 + 60 * mag / refMag));

    const angle = Math.atan2(fy, fx);
    const ex = p.x + Math.cos(angle) * finalLen;
    const ey = p.y - Math.sin(angle) * finalLen;

    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    const headLen = 12;
    const headAngle = 0.4;
    for (const side of [-1, 1]) {
        const hx = ex - Math.cos(angle + side * headAngle) * headLen;
        const hy = ey + Math.sin(angle + side * headAngle) * headLen;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(hx, hy);
        ctx.strokeStyle = '#ffd43b';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    ctx.fillStyle = '#ffd43b';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`F_net = ${mag.toFixed(3)} N`, ex + 5, ey - 3);
}

function drawComponents(charge, fx, fy) {

    const p = worldToScreen(charge.x, charge.y);

    if (mode === '1d') {
        p.y = canvas.height / 2;
    }

    const maxForce = Math.max(
    Math.abs(fx),
    Math.abs(fy),
    0.001
);

const scaleComp = 80 / maxForce;

    // Fx (rojo)
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + fx * scaleComp, p.y);
    ctx.stroke();

    // Flecha Fx
    ctx.beginPath();
    ctx.moveTo(p.x + fx * scaleComp, p.y);
    ctx.lineTo(
        p.x + fx * scaleComp - Math.sign(fx) * 8,
        p.y - 4
    );
    ctx.moveTo(p.x + fx * scaleComp, p.y);
    ctx.lineTo(
        p.x + fx * scaleComp - Math.sign(fx) * 8,
        p.y + 4
    );
    ctx.stroke();

    // Etiqueta Fx
    ctx.fillStyle = '#ff4444';
    ctx.font = '12px sans-serif';
    ctx.fillText(
        'Fx',
        p.x + fx * scaleComp + 5,
        p.y - 5
    );

    // Fy (verde)
    ctx.strokeStyle = '#00ff88';

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(
        p.x,
        p.y - fy * scaleComp
    );
    ctx.stroke();

    // Flecha Fy
    ctx.beginPath();
    ctx.moveTo(
        p.x,
        p.y - fy * scaleComp
    );

    ctx.lineTo(
        p.x - 4,
        p.y - fy * scaleComp + Math.sign(fy) * 8
    );

    ctx.moveTo(
        p.x,
        p.y - fy * scaleComp
    );

    ctx.lineTo(
        p.x + 4,
        p.y - fy * scaleComp + Math.sign(fy) * 8
    );

    ctx.stroke();

    // Etiqueta Fy
    ctx.fillStyle = '#00ff88';
    ctx.fillText(
        'Fy',
        p.x + 5,
        p.y - fy * scaleComp - 5
    );
}

function drawFieldLines() {
    const bounds = getWorldBounds();
    const stepSize = 0.12;
    const maxSteps = 80;

    if (charges.length === 0) return;

    for (const c of charges) {
        if (Math.abs(c.q) < 1e-20) continue;
        const dir = c.q > 0 ? 1 : -1;
        const numLines = Math.max(6, Math.min(16, Math.round(Math.abs(c.q / MICRO) * 2.5)));

        for (let i = 0; i < numLines; i++) {
            const angle = (i / numLines) * 2 * Math.PI + 0.01;
            let cx = c.x + 0.45 * Math.cos(angle);
            let cy = c.y + 0.45 * Math.sin(angle);

            const points = [{x: cx, y: cy}];
            let terminated = false;

            for (let s = 0; s < maxSteps; s++) {
                const e = electricFieldAt(cx, cy);
                const mag = Math.sqrt(e.ex * e.ex + e.ey * e.ey);
                if (mag < 1e-20) break;

                cx += stepSize * dir * e.ex / mag;
                cy += stepSize * dir * e.ey / mag;

                if (cx < bounds.xMin || cx > bounds.xMax || cy < bounds.yMin || cy > bounds.yMax) break;

                for (const other of charges) {
                    if (other.id === c.id) continue;
                    const ddx = cx - other.x;
                    const ddy = cy - other.y;
                    if (ddx * ddx + ddy * ddy < 0.2) { terminated = true; break; }
                }
                if (terminated) break;

                points.push({x: cx, y: cy});
            }

            if (points.length < 2) continue;

            // Draw the red field line
            ctx.strokeStyle = 'rgba(233, 69, 96, 0.4)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            const first = worldToScreen(points[0].x, points[0].y);
            ctx.moveTo(first.x, first.y);
            for (let p = 1; p < points.length; p++) {
                const sp = worldToScreen(points[p].x, points[p].y);
                ctx.lineTo(sp.x, sp.y);
            }
            ctx.stroke();

            // Small arrows along the line (in E direction at each point)
            const arrowEvery = Math.max(1, Math.floor(points.length / 5));
            for (let p = arrowEvery; p < points.length - 1; p += arrowEvery) {
                const ae = electricFieldAt(points[p].x, points[p].y);
                const aMag = Math.sqrt(ae.ex * ae.ex + ae.ey * ae.ey);
                if (aMag < 1e-20) continue;
                const sp = worldToScreen(points[p].x, points[p].y);
                const ang = Math.atan2(ae.ey, ae.ex);
                const aLen = 5;
                ctx.strokeStyle = 'rgba(233, 69, 96, 0.7)';
                ctx.lineWidth = 1.3;
                const ha = 0.5;
                for (const side of [-1, 1]) {
                    const hx = sp.x - Math.cos(ang + side * ha) * aLen;
                    const hy = sp.y + Math.sin(ang + side * ha) * aLen;
                    ctx.beginPath();
                    ctx.moveTo(sp.x, sp.y);
                    ctx.lineTo(hx, hy);
                    ctx.stroke();
                }
            }
        }
    }

    // Blue grid arrows showing E field direction in the plane
    const spacing = 0.9;
    const maxArrowLen = 22;
    let maxE = 0;
    const samples = [];
    const startX = Math.ceil(bounds.xMin / spacing) * spacing;
    const endX = Math.floor(bounds.xMax / spacing) * spacing;
    const startY = Math.ceil(bounds.yMin / spacing) * spacing;
    const endY = Math.floor(bounds.yMax / spacing) * spacing;
    for (let wx = startX; wx <= endX; wx += spacing) {
        for (let wy = startY; wy <= endY; wy += spacing) {
            let tooClose = false;
            for (const c of charges) {
                const dx = wx - c.x;
                const dy = wy - c.y;
                if (dx * dx + dy * dy < 0.3) { tooClose = true; break; }
            }
            if (tooClose) continue;
            const e = electricFieldAt(wx, wy);
            if (e.mag > 1e-20) {
                samples.push({ x: wx, y: wy, ex: e.ex, ey: e.ey, mag: e.mag });
                if (e.mag > maxE) maxE = e.mag;
            }
        }
    }
    if (maxE > 1e-20) {
        for (const s of samples) {
            const p = worldToScreen(s.x, s.y);
            const intensity = s.mag / maxE;
            const arrowLen = Math.max(5, Math.min(maxArrowLen, 6 + intensity * 16));
            const angle = Math.atan2(s.ey, s.ex);
            const ex = p.x + Math.cos(angle) * arrowLen;
            const ey = p.y - Math.sin(angle) * arrowLen;
            const alpha = 0.2 + intensity * 0.6;
            ctx.strokeStyle = `rgba(77, 171, 247, ${alpha})`;
            ctx.lineWidth = 1.0 + intensity * 1.2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            const headLen = 3 + intensity * 4;
            const headAngle = 0.5;
            for (const side of [-1, 1]) {
                const hx = ex - Math.cos(angle + side * headAngle) * headLen;
                const hy = ey + Math.sin(angle + side * headAngle) * headLen;
                ctx.beginPath();
                ctx.moveTo(ex, ey);
                ctx.lineTo(hx, hy);
                ctx.stroke();
            }
        }
    }
}

function drawFieldVector(fp) {
    const p = worldToScreen(fp.x, fp.y);
    const mag = Math.sqrt(fp.ex * fp.ex + fp.ey * fp.ey);
    if (mag < 1e-20) return;

    // Draw per-charge contribution arrows (small, colored by charge)
    let maxContrib = 0;
    const contribs = [];
    for (const c of charges) {
        const e = fieldFromCharge(c, fp.x, fp.y);
        if (e.mag > maxContrib) maxContrib = e.mag;
        contribs.push({ charge: c, ex: e.ex, ey: e.ey, mag: e.mag });
    }
    if (maxContrib < 1e-20) maxContrib = 1e-20;

    for (const ct of contribs) {
        if (ct.mag < 1e-20) continue;
        const color = ct.charge.q > 0 ? 'rgba(255,107,107,' : 'rgba(77,171,247,';
        const aLen = Math.max(3, Math.min(20, 4 + 16 * ct.mag / maxContrib));
        const aAngle = Math.atan2(ct.ey, ct.ex);
        const aex = p.x + Math.cos(aAngle) * aLen;
        const aey = p.y - Math.sin(aAngle) * aLen;
        ctx.strokeStyle = `${color}0.6)`;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(aex, aey);
        ctx.stroke();
        ctx.setLineDash([]);
        // tiny arrowhead
        const hLen = 3;
        const hAng = 0.5;
        for (const side of [-1, 1]) {
            const hx = aex - Math.cos(aAngle + side * hAng) * hLen;
            const hy = aey + Math.sin(aAngle + side * hAng) * hLen;
            ctx.beginPath();
            ctx.moveTo(aex, aey);
            ctx.lineTo(hx, hy);
            ctx.stroke();
        }
    }

    // Arrow scale for total E
    const allMag = fieldPoints.map(f => Math.sqrt(f.ex*f.ex + f.ey*f.ey));
    const maxMag = Math.max(...allMag.filter(m => m > 1e-20), 1e-20);
    const arrowLen = Math.max(10, Math.min(70, 25 + 45 * mag / maxMag));

    const angle = Math.atan2(fp.ey, fp.ex);
    const ex = p.x + Math.cos(angle) * arrowLen;
    const ey = p.y - Math.sin(angle) * arrowLen;

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = '#69db7c';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const headLen = 10;
    const headAngle = 0.4;
    for (const side of [-1, 1]) {
        const hx = ex - Math.cos(angle + side * headAngle) * headLen;
        const hy = ey + Math.sin(angle + side * headAngle) * headLen;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(hx, hy);
        ctx.strokeStyle = '#69db7c';
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    // Field point dot
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#69db7c';
    ctx.fill();

    // Label
    ctx.fillStyle = '#69db7c';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const eMag = mag.toFixed(2);
    ctx.fillText(`E_total = ${eMag} N/C`, ex + 5, ey - 3);
}

function drawLegend() {
    const x = 10, y = canvas.height - 50;
    ctx.font = '11px sans-serif';
    let ly = y;

    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(x, ly, 14, 14);
    ctx.fillStyle = '#8899aa';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Carga positiva', x + 20, ly + 7);

    ly += 20;
    ctx.fillStyle = '#4dabf7';
    ctx.fillRect(x, ly, 14, 14);
    ctx.fillStyle = '#8899aa';
    ctx.fillText('Carga negativa', x + 20, ly + 7);

    ly += 20;
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, ly + 7);
    ctx.lineTo(x + 14, ly + 7);
    ctx.stroke();
    ctx.fillStyle = '#8899aa';
    ctx.fillText('Líneas de campo E', x + 20, ly + 7);

    ly += 20;
    ctx.strokeStyle = '#4dabf7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, ly + 7);
    ctx.lineTo(x + 8, ly + 3);
    ctx.moveTo(x, ly + 7);
    ctx.lineTo(x + 8, ly + 11);
    ctx.stroke();
    ctx.fillStyle = '#8899aa';
    ctx.fillText('Campo E en el plano', x + 20, ly + 7);

    ly += 20;
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, ly + 7);
    ctx.lineTo(x + 12, ly + 3);
    ctx.moveTo(x, ly + 7);
    ctx.lineTo(x + 12, ly + 11);
    ctx.stroke();
    ctx.fillStyle = '#8899aa';
    ctx.fillText('Fuerza neta / E puntual', x + 20, ly + 7);
}

// ═══════════════════════════════════════════════════════════════════
// UI - LISTA DE CARGAS
// ═══════════════════════════════════════════════════════════════════
function renderChargeList() {
    chargeListEl.innerHTML = '';
    if (charges.length === 0) {
        chargeListEl.innerHTML = '<div class="empty-msg">No hay cargas. Añade una.</div>';
        return;
    }
    for (const c of charges) {
        const div = document.createElement('div');
        div.className = `charge-item${c.id === selectedId ? ' selected' : ''}`;
        div.dataset.id = c.id;
        const dot = document.createElement('div');
        dot.className = `charge-dot ${c.q > 0 ? 'positive' : 'negative'}`;
        const name = document.createElement('span');
        name.className = 'charge-name';
        name.textContent = c.name;
        const qv = document.createElement('span');
        qv.className = 'charge-q';
        const val = (c.q / MICRO);
        qv.textContent = `${val >= 0 ? '+' : ''}${val.toFixed(1)} μC`;
        qv.style.color = c.q > 0 ? '#ff6b6b' : '#4dabf7';
        const del = document.createElement('button');
        del.className = 'charge-del';
        del.textContent = '✕';
        del.title = 'Eliminar carga';
        del.addEventListener('click', e => { e.stopPropagation(); removeCharge(c.id); });
        div.appendChild(dot);
        div.appendChild(name);
        div.appendChild(qv);
        div.appendChild(del);
        div.addEventListener('click', () => selectCharge(c.id));
        chargeListEl.appendChild(div);
    }
}

function selectCharge(id) {
    selectedId = id;
    const c = charges.find(ch => ch.id === id);
    if (c) {
        editX.value = c.x.toFixed(2);
        editY.value = c.y.toFixed(2);
        editQ.value = (c.q / MICRO).toFixed(2);
    }
    renderChargeList();
    updateResults();
    draw();
}

function updateFormFromSelected() {
    if (selectedId === null) return;
    const c = charges.find(ch => ch.id === selectedId);
    if (!c) return;
    editX.value = c.x.toFixed(2);
    editY.value = c.y.toFixed(2);
    editQ.value = (c.q / MICRO).toFixed(2);
}

// ═══════════════════════════════════════════════════════════════════
// RESULTADOS
// ═══════════════════════════════════════════════════════════════════
function updateResults() {
    let html = '';
    if (selectedId !== null && showForces) {
        const sel = charges.find(c => c.id === selectedId);
        if (sel) {
            const r = netForceOn(sel);
            html += `<div class="label">Fuerza neta sobre ${sel.name}</div>`;
            if (r.mag > 1e-20) {
html += `<div class="fnet">Fx = ${r.fx.toFixed(4)} N</div>`;
html += `<div class="fnet">Fy = ${r.fy.toFixed(4)} N</div>`;
html += `<div class="fnet">|F_net| = ${r.mag.toFixed(4)} N</div>`;
                const angle = Math.atan2(r.fy, r.fx) * 180 / Math.PI;
                html += `<div class="fnet">Dirección: ${angle.toFixed(1)}°</div>`;
                html += `<br><div class="label">Fuerzas individuales</div>`;

for (const p of r.pairs) {

    html += `
    <div>
        ${p.other.name}
        <br>Fx = ${p.fx.toFixed(4)} N
        <br>Fy = ${p.fy.toFixed(4)} N
        <br>|F| = ${p.mag.toFixed(4)} N
    </div><br>`;
}
            } else {
                html += `<div class="val">F_net ≈ 0 N (equilibrio)</div>`;
            }

        }
    }
    if (showField && fieldPoints.length > 0) {
        const fp = fieldPoints[fieldPoints.length - 1];
        const e = electricFieldAt(fp.x, fp.y);
        fp.ex = e.ex;
        fp.ey = e.ey;
        html += `<div class="label mt-8">Campo en (${fp.x.toFixed(2)}, ${fp.y.toFixed(2)})</div>`;
html += `<div class="efield">Ex = ${e.ex.toFixed(4)} N/C</div>`;
html += `<div class="efield">Ey = ${e.ey.toFixed(4)} N/C</div>`;
html += `<div class="efield">|E| = ${e.mag.toFixed(4)} N/C</div>`;
        const ang = Math.atan2(e.ey, e.ex) * 180 / Math.PI;
        html += `<div class="efield">Dirección: ${ang.toFixed(1)}°</div>`;
        // Per-charge contributions
        html += `<div class="label mt-8">Contribuciones por carga</div>`;
        for (const c of charges) {
            const ec = fieldFromCharge(c, fp.x, fp.y);
            if (ec.mag < 1e-20) continue;
            const col = c.q > 0 ? '#ff6b6b' : '#4dabf7';
            const angC = Math.atan2(ec.ey, ec.ex) * 180 / Math.PI;
            html += `<div style="color:${col}">${c.name} (${(c.q/MICRO).toFixed(1)}μC): ${ec.mag.toFixed(4)} N/C · ${angC.toFixed(1)}°</div>`;
        }
    }
    if (!html) {
        html = `<div class="label">Selecciona una carga o calcula el campo</div>`;
    }
    resultsBox.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════
// CRUD CARGAS
// ═══════════════════════════════════════════════════════════════════
function addCharge(x, y, q) {
    if (mode === '1d') y = 0;
    const name = `q${nextId}`;
    charges.push({ id: nextId, name, x, y, q: q * MICRO });
    nextId++;
    selectCharge(charges[charges.length - 1].id);
    renderChargeList();
    draw();
}

function removeCharge(id) {
    const idx = charges.findIndex(c => c.id === id);
    if (idx === -1) return;
    charges.splice(idx, 1);
    if (selectedId === id) {
        selectedId = charges.length > 0 ? charges[0].id : null;
        if (selectedId === null) {
            editX.value = '';
            editY.value = '';
            editQ.value = '';
        }
    }
    renderChargeList();
    updateResults();
    draw();
}

function updateCharge(id, x, y, qMicroC) {

    const c = charges.find(ch => ch.id === id);
    if (!c) return;

    for (const other of charges) {
        if (other.id === id) continue;

        const dx = x - other.x;
        const dy = y - other.y;

        if ((dx * dx + dy * dy) < 0.01) {
            alert("No pueden existir dos cargas en la misma posición");
            return;
        }
    }

    if (mode === '1d') y = 0;

    c.x = x;
    c.y = y;
    c.q = qMicroC * MICRO;

    renderChargeList();
    updateResults();
    draw();
}

// ═══════════════════════════════════════════════════════════════════
// EVENTOS DEL CANVAS
// ═══════════════════════════════════════════════════════════════════
function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function hitTestCharge(sx, sy) {
    for (let i = charges.length - 1; i >= 0; i--) {
        const c = charges[i];
        const p = worldToScreen(c.x, c.y);
        if (mode === '1d') p.y = canvas.height / 2;
        const absQ = Math.abs(c.q / MICRO);
        const radius = Math.max(12, Math.min(30, 10 + absQ * 2));
        const dx = sx - p.x;
        const dy = sy - p.y;
        if (dx * dx + dy * dy <= (radius + 5) * (radius + 5)) {
            return c;
        }
    }
    return null;
}

canvas.addEventListener('mousedown', e => {
    const pos = getCanvasPos(e);
    const hit = hitTestCharge(pos.x, pos.y);
    if (hit) {
        selectCharge(hit.id);
        const wp = worldToScreen(hit.x, hit.y);
        drag = { chargeId: hit.id, offX: pos.x - wp.x, offY: pos.y - wp.y };
        canvas.style.cursor = 'grabbing';
    } else {
        // Click on empty space - add charge if shift held, else deselect
        if (e.shiftKey) {
            const w = screenToWorld(pos.x, pos.y);
            addCharge(w.x, mode === '1d' ? 0 : w.y, 2);
        } else {
            selectedId = null;
            editX.value = '';
            editY.value = '';
            editQ.value = '';
            renderChargeList();
            updateResults();
            draw();
        }
    }
});

canvas.addEventListener('mousemove', e => {
    const pos = getCanvasPos(e);
    if (drag) {
        const w = screenToWorld(pos.x - drag.offX, pos.y - drag.offY);
        const c = charges.find(ch => ch.id === drag.chargeId);
        if (c) {
            c.x = w.x;
            c.y = mode === '1d' ? 0 : w.y;
            updateFormFromSelected();
            renderChargeList();
            updateResults();
            draw();
        }
    } else {
        const hit = hitTestCharge(pos.x, pos.y);
        canvas.style.cursor = hit ? 'grab' : 'crosshair';
    }
});

canvas.addEventListener('mouseup', () => {
    if (drag) {
        drag = null;
        canvas.style.cursor = 'crosshair';
    }
});

canvas.addEventListener('mouseleave', () => {
    drag = null;
    canvas.style.cursor = 'crosshair';
});

// Touch support
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const pos = { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    const hit = hitTestCharge(pos.x, pos.y);
    if (hit) {
        selectCharge(hit.id);
        drag = { chargeId: hit.id, offX: 0, offY: 0 };
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!drag) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const pos = { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    const w = screenToWorld(pos.x, pos.y);
    const c = charges.find(ch => ch.id === drag.chargeId);
    if (c) {
        c.x = w.x;
        c.y = mode === '1d' ? 0 : w.y;
        updateFormFromSelected();
        renderChargeList();
        updateResults();
        draw();
    }
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    drag = null;
}, { passive: false });

// ═══════════════════════════════════════════════════════════════════
// EVENTOS DE FORMULARIO
// ═══════════════════════════════════════════════════════════════════
document.getElementById('btnAddCharge').addEventListener('click', () => {
    const x = Math.round((Math.random() - 0.5) * 6 * 10) / 10;
    const y = mode === '1d' ? 0 : Math.round((Math.random() - 0.5) * 6 * 10) / 10;
    const q = Math.round((Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 4) * 10) / 10;
    addCharge(x, y, q);
});

document.getElementById('btnDelCharge').addEventListener('click', () => {
    if (selectedId !== null) removeCharge(selectedId);
});

document.getElementById('btnUpdate').addEventListener('click', () => {
    if (selectedId === null) return;
    const x = parseFloat(editX.value);
    const y = mode === '1d' ? 0 : parseFloat(editY.value);
    const q = parseFloat(editQ.value);
    if (isNaN(x) || isNaN(y) || isNaN(q)) return;
    if (q === 0) { alert('La carga no puede ser cero.'); return; }
    updateCharge(selectedId, x, y, q);
});

// Also update on enter key
[editX, editY, editQ].forEach(input => {
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('btnUpdate').click();
    });
});

document.getElementById('btnCalcField').addEventListener('click', () => {
const x = parseFloat(fieldX.value);
const y = parseFloat(fieldY.value);

if (isNaN(x) || isNaN(y)) {
    alert("Ingrese coordenadas válidas");
    return;
}

for (const c of charges) {

    const dx = x - c.x;
    const dy = y - c.y;

    if ((dx * dx + dy * dy) < 0.01) {

        alert(
            `No se puede calcular el campo eléctrico en la posición de ${c.name}`
        );

        return;
    }
}

const e = electricFieldAt(x, y);
    // Remove existing field point at same location if any
    fieldPoints = fieldPoints.filter(fp => Math.abs(fp.x - x) > 0.01 || Math.abs(fp.y - y) > 0.01);
    fieldPoints.push({ x, y, ex: e.ex, ey: e.ey });
    showField = true;
    chkField.checked = true;
    updateResults();
    draw();
});

document.getElementById('btnClearField').addEventListener('click', () => {
    fieldPoints = [];
    showField = false;
    chkField.checked = false;
    updateResults();
    draw();
});

// Toggle mode
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.mode;
        if (mode === '1d') {
            for (const c of charges) c.y = 0;
            editY.disabled = true;
            editY.value = '0';
        } else {
            editY.disabled = false;
            updateFormFromSelected();
        }
        fieldPoints = [];
        chkField.checked = false;
        showField = false;
        renderChargeList();
        updateResults();
        draw();
    });
});

// Checkboxes
chkForces.addEventListener('change', () => {
    showForces = chkForces.checked;
    updateResults();
    draw();
});

chkField.addEventListener('change', () => {
    showField = chkField.checked;
    updateResults();
    draw();
});

chkFieldLines.addEventListener('change', () => {
    showFieldLines = chkFieldLines.checked;
    draw();
});

// ═══════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════
function init() {
    // Default charges
    addCharge(-2.5, 1.5, 3);
    addCharge(2.0, -1.0, -1);
    addCharge(0.5, 2.0, 2);
    editY.disabled = false;

    // Default field point example
    fieldX.value = '0';
    fieldY.value = '0';

    draw();
}
function resizeCanvas() {
    const frame = document.querySelector('.canvas-frame');

    canvas.width = frame.clientWidth;
    canvas.height = frame.clientHeight;

    draw();
}
//Perdon si leyo el anterior com
window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', resizeCanvas);
init();