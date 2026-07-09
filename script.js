const canvas = document.getElementById('fieldCanvas');
const ctx = canvas.getContext('2d');
const waypointsContainer = document.getElementById('waypointsContainer');
const timelineSlider = document.getElementById('timelineSlider');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const codeModal = document.getElementById('codeModal');

const FIELD_MAX = 365.75; 

let robotW = 40, robotH = 45;

let waypoints = [
    { name: "Start", x: 50, y: 50, heading: 90 }, 
    { name: "P1", x: 150, y: 150, heading: 45, color: '#379aa0' } 
];

let isPlaying = false;
let playProgress = 0; 
const PLAY_SPEED = 0.013; 
let draggedPointIndex = -1;

// === FUNCȚII CONVERSIE & MATEMATICĂ ===
function toCanvasX(worldX) { return (worldX / FIELD_MAX) * canvas.width; }
function toCanvasY(worldY) { return canvas.height - ((worldY / FIELD_MAX) * canvas.height); }
function toCanvasScale(worldVal) { return (worldVal / FIELD_MAX) * canvas.width; }
function toWorldX(canvasX) { return (canvasX / canvas.width) * FIELD_MAX; }
function toWorldY(canvasY) { return ((canvas.height - canvasY) / canvas.height) * FIELD_MAX; }

function lerp(start, end, t) { return start + (end - start) * t; }
function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    return a + diff * t;
}

// Suportă atât Mouse cât și Touch pe telefon
function getPointerPos(evt) {
    let rect = canvas.getBoundingClientRect();
    let scaleX = canvas.width / rect.width;
    let scaleY = canvas.height / rect.height;
    
    let clientX = evt.clientX;
    let clientY = evt.clientY;

    if (evt.touches && evt.touches.length > 0) {
        clientX = evt.touches[0].clientX;
        clientY = evt.touches[0].clientY;
    }

    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

// === DESENARE ===
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (waypoints.length > 1) {
        for (let i = 1; i < waypoints.length; i++) {
            let cx1 = toCanvasX(waypoints[i-1].x);
            let cy1 = toCanvasY(waypoints[i-1].y);
            let cx2 = toCanvasX(waypoints[i].x);
            let cy2 = toCanvasY(waypoints[i].y);

            ctx.beginPath();
            ctx.strokeStyle = waypoints[i].color || '#ffffff';
            ctx.lineWidth = 4;
            ctx.moveTo(cx1, cy1);
            ctx.lineTo(cx2, cy2);
            ctx.stroke();
        }
    }

    waypoints.forEach((pt, i) => {
        let cx = toCanvasX(pt.x);
        let cy = toCanvasY(pt.y);
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
        ctx.fillStyle = i === 0 ? '#4285f4' : (pt.color || '#2ecc71'); 
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });

    let currentX = 50, currentY = 50, currentHeading = 90;
    
    if (waypoints.length > 0) {
        let maxIndex = waypoints.length - 1;
        let clampedProgress = Math.max(0, Math.min(playProgress, maxIndex));
        let lowerIndex = Math.floor(clampedProgress);
        let upperIndex = Math.ceil(clampedProgress);
        let t = clampedProgress - lowerIndex; 

        if (lowerIndex === upperIndex) {
            currentX = waypoints[lowerIndex].x;
            currentY = waypoints[lowerIndex].y;
            currentHeading = waypoints[lowerIndex].heading;
        } else {
            let p1 = waypoints[lowerIndex];
            let p2 = waypoints[upperIndex];
            currentX = lerp(p1.x, p2.x, t);
            currentY = lerp(p1.y, p2.y, t);
            currentHeading = lerpAngle(p1.heading, p2.heading, t);
        }
    }

    let rx = toCanvasX(currentX);
    let ry = toCanvasY(currentY);
    let rw = toCanvasScale(robotW);
    let rh = toCanvasScale(robotH);

    ctx.save();
    ctx.translate(rx, ry);
    let headingRad = (90 - currentHeading) * (Math.PI / 180); 
    ctx.rotate(headingRad);
    ctx.fillStyle = 'rgba(0, 122, 204, 0.5)';
    ctx.strokeStyle = '#007acc';
    ctx.lineWidth = 2;
    ctx.fillRect(-rw / 2, -rh / 2, rw, rh);
    ctx.strokeRect(-rw / 2, -rh / 2, rw, rh);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -rh / 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
}

// === ANIMAȚIE ===
function animate() {
    if (!isPlaying) return;
    playProgress += PLAY_SPEED;
    let maxProgress = Math.max(0, waypoints.length - 1);
    if (playProgress >= maxProgress) {
        playProgress = maxProgress;
        isPlaying = false;
        playBtn.innerText = '▶';
    }
    timelineSlider.value = maxProgress > 0 ? (playProgress / maxProgress) * 1000 : 0;
    draw();
    if (isPlaying) requestAnimationFrame(animate);
}

playBtn.addEventListener('click', () => {
    if (waypoints.length < 2) return; 
    let maxProgress = waypoints.length - 1;
    if (playProgress >= maxProgress) playProgress = 0; 
    isPlaying = !isPlaying;
    playBtn.innerText = isPlaying ? '⏸' : '▶'; 
    if (isPlaying) animate();
});

stopBtn.addEventListener('click', () => {
    isPlaying = false;
    playProgress = 0;
    playBtn.innerText = '▶';
    timelineSlider.value = 0;
    draw();
});

timelineSlider.addEventListener('input', (e) => {
    isPlaying = false;
    playBtn.innerText = '▶';
    let maxProgress = Math.max(0, waypoints.length - 1);
    playProgress = (parseFloat(e.target.value) / 1000) * maxProgress;
    draw();
});

// === INTERACȚIUNE MOUSE & TOUCH PENTRU PUNCTE ===
function getHitWaypoint(canvasX, canvasY) {
    // Am mărit raza de detectare de la 15 la 40 pentru ecranele touch
    const HIT_RADIUS = 40; 

    for (let i = waypoints.length - 1; i >= 0; i--) {
        let dist = Math.sqrt((toCanvasX(waypoints[i].x) - canvasX) ** 2 + (toCanvasY(waypoints[i].y) - canvasY) ** 2);
        if (dist <= HIT_RADIUS) return i;
    }
    return -1;
}

function handlePointerDown(e) {
    let pos = getPointerPos(e);
    let hitIndex = getHitWaypoint(pos.x, pos.y);

    if (hitIndex !== -1) {
        draggedPointIndex = hitIndex;
    } else {
        let newX = Math.max(0, Math.min(FIELD_MAX, toWorldX(pos.x)));
        let newY = Math.max(0, Math.min(FIELD_MAX, toWorldY(pos.y)));
        let newHeading = waypoints.length > 0 ? waypoints[waypoints.length - 1].heading : 90;
        let newColor = waypoints.length > 0 && waypoints[waypoints.length - 1].color ? waypoints[waypoints.length - 1].color : '#e74c3c';
        
        let newName = "P" + waypoints.length;
        waypoints.push({ name: newName, x: newX, y: newY, heading: newHeading, color: newColor });
        updateUI();
        draw();
    }
}

function handlePointerMove(e) {
    if (draggedPointIndex !== -1) {
        // Dacă tragem de punct pe telefon, împiedicăm ecranul să dea scroll
        if(e.cancelable) e.preventDefault(); 

        let pos = getPointerPos(e);
        waypoints[draggedPointIndex].x = Math.max(0, Math.min(FIELD_MAX, toWorldX(pos.x)));
        waypoints[draggedPointIndex].y = Math.max(0, Math.min(FIELD_MAX, toWorldY(pos.y)));
        
        let inputX = document.getElementById(`wp-x-${draggedPointIndex}`);
        let inputY = document.getElementById(`wp-y-${draggedPointIndex}`);
        if (inputX) inputX.value = waypoints[draggedPointIndex].x.toFixed(2);
        if (inputY) inputY.value = waypoints[draggedPointIndex].y.toFixed(2);
        draw();
    }
}

function handlePointerUp() {
    draggedPointIndex = -1;
    updateUI();
}

// Listeners pentru Desktop (Mouse)
canvas.addEventListener('mousedown', handlePointerDown);
canvas.addEventListener('mousemove', handlePointerMove);
canvas.addEventListener('mouseup', handlePointerUp);
canvas.addEventListener('mouseleave', handlePointerUp);

// Listeners pentru Mobile/Tablete (Touch)
canvas.addEventListener('touchstart', (e) => {
    // Opțional blocăm comportamentul de scroll doar dacă începem o acțiune pe canvas
    if(e.cancelable) e.preventDefault(); 
    handlePointerDown(e);
}, { passive: false });
canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
canvas.addEventListener('touchend', handlePointerUp);
canvas.addEventListener('touchcancel', handlePointerUp);

// === UI SIDEBAR ===
function updateUI() {
    waypointsContainer.innerHTML = ''; 

    waypoints.forEach((wp, index) => {
        let card = document.createElement('div');
        card.className = 'waypoint-card';
        
        card.innerHTML = `
            <div class="waypoint-header">
                <input type="text" class="wp-name-input" value="${wp.name}" onchange="updateWaypointName(${index}, this.value)">
                <div>
                    ${index > 0 ? `<input type="color" value="${wp.color}" title="Culoarea path-ului" style="height:25px; width:40px; margin-right:5px;" onchange="updateWaypointColor(${index}, this.value)">` : ''}
                    ${index > 0 ? `<button class="btn-danger" onclick="deleteWaypoint(${index})">X</button>` : ''}
                </div>
            </div>
            <div class="input-row">
                <label>X: <input type="number" id="wp-x-${index}" value="${wp.x.toFixed(2)}" step="1" onchange="updateWaypoint(${index}, 'x', this.value)"></label>
                <label>Y: <input type="number" id="wp-y-${index}" value="${wp.y.toFixed(2)}" step="1" onchange="updateWaypoint(${index}, 'y', this.value)"></label>
                <label>H(°): <input type="number" value="${wp.heading}" step="1" onchange="updateWaypoint(${index}, 'heading', this.value)"></label>
            </div>
        `;
        waypointsContainer.appendChild(card);
    });
}

document.getElementById('addWaypointBtn').addEventListener('click', () => {
    let lastPt = waypoints[waypoints.length - 1];
    let newX = lastPt ? lastPt.x + 10 : 50;
    let newY = lastPt ? lastPt.y + 10 : 50;
    let newH = lastPt ? lastPt.heading : 90;
    let newC = lastPt && lastPt.color ? lastPt.color : '#e74c3c'; 
    let newName = "P" + waypoints.length;
    
    waypoints.push({ name: newName, x: newX, y: newY, heading: newH, color: newC });
    updateUI();
    draw();
});

document.getElementById('robotW').addEventListener('input', e => { robotW = parseFloat(e.target.value) || 40; draw(); });
document.getElementById('robotH').addEventListener('input', e => { robotH = parseFloat(e.target.value) || 45; draw(); });

window.updateWaypointName = (index, value) => {
    waypoints[index].name = value.trim().replace(/\s+/g, '_');
    draw();
};

window.updateWaypoint = (index, prop, value) => { waypoints[index][prop] = parseFloat(value) || 0; draw(); };
window.updateWaypointColor = (index, color) => { waypoints[index].color = color; draw(); };
window.deleteWaypoint = (index) => {
    waypoints.splice(index, 1);
    isPlaying = false; playProgress = 0; playBtn.innerText = '▶'; timelineSlider.value = 0;
    updateUI(); draw();
};

// === GENERARE COD & MODAL ===
function generateJavaCode() {
    let code = `<span class="kw-acc">public</span> <span class="typ">Waypoint</span>[] Trajectory = {\n`;

    for (let i = 0; i < waypoints.length; i++) {
        let p = waypoints[i];
        
        let speed = (i === waypoints.length - 1) ? 1 : 0; 
        
        let isStopPoint = (i === waypoints.length - 1) ? "false" : "true";
        
        code += `        <span class="kw">new</span> <span class="typ">Waypoint</span>(`;
        code += `<span class="kw">new</span> <span class="typ">Pose2D</span>(<span class="num">${p.x.toFixed(4)}</span>, <span class="num">${p.y.toFixed(4)}</span>, Math.<span class="mth">toRadians</span>(<span class="num">${p.heading}</span>)), `;
        code += `<span class="num">${speed}</span>, `;
        code += `<span class="kw">new</span> <span class="typ">AdmissibleError</span>(<span class="num">1.5</span>, <span class="num">1.5</span>, Math.<span class="mth">toRadians</span>(<span class="num">1.5</span>)), `;
        code += `<span class="kw">${isStopPoint}</span>)`;
        
        code += `,\n`;
    }

    code += `    };`;
    document.getElementById('generatedCode').innerHTML = code;
}

document.getElementById('exportCodeBtn').addEventListener('click', () => {
    generateJavaCode();
    codeModal.classList.add('show');
});

document.getElementById('closeModalBtn').addEventListener('click', () => {
    codeModal.classList.remove('show');
});

window.addEventListener('click', (e) => {
    if (e.target === codeModal) codeModal.classList.remove('show');
});

updateUI();
draw();