// Team Angelic, Jennifer, Rina
// Rain Prayer Performance
// Main interactions:
// - initial hard shake: spawn particles at an edge (chosen based on current gravity tilt)
// particles float across the screen in response to gyroscope
// - second shake: send each particle out through its nearest edge
// Reference: 
// Acceleration display we learnt from the class, https://github.com/DigitalFuturesOCADU/P5-Phone-Interactions/blob/main/examples/Phone%20Sensor%20Examples/movement/03_acceleration/sketch.js
// Basic concepts behind fluid simulation by Sebastian Lague, https://www.youtube.com/watch?v=rSKMYc1CQHE, access on Oct 10, 2025

let particles = [];
const NUM_PARTICLES = 300;
const PARTICLE_RADIUS = 16;
const REST_DISTANCE = 10; // target spacing between particles
const RELAXATION_ITER = 3; // iterate 3 times per frame to separate the particles sufficiently (Generated using GPT5 on Oct12, 2025)

const EXIT_ACCEL = 5;
const SHAKE_COOLDOWN = 800; // ms
let lastShakeTime = 0;

let gyroEnabled = false;
let gravity; 

// use var to avoid TDZ for globals referenced across functions (generated using GPT5 on Oct12, 2025)
var activeEdges = { spawn: null, exit: null };
var edgeHighlightStartTime = 0;
const EDGE_HIGHLIGHT_DURATION = 3000; // ms

function setup() {
  createCanvas(windowWidth, windowHeight);

  gravity = createVector(0, 0.5);

  // iOS 13+ motion permission, safely detect device motion features while avoiding referenceerror (generated using GPT5 on Oct12, 2025)
  if (
    typeof DeviceMotionEvent !== 'undefined' &&
    typeof DeviceMotionEvent.requestPermission === 'function'
  ) {
    const btn = select('#gyro-btn'); //select html element from index.html
    if (btn) {
      btn.style('display', 'block');
      btn.mousePressed(() => {
        DeviceMotionEvent.requestPermission().then(response => {
          if (response === 'granted') { 
//.then(...) attaches a callback to run after the Promise resolves.response => { ... } is a concise function receiving the resolved value
            gyroEnabled = true;
            btn.style('display', 'none'); //after the permission is granted, hide the button
          }
        });
      });
    }
  } else {
    gyroEnabled = true; // other phone models don't need permissions
  }

  if (typeof setShakeThreshold === 'function') {
    setShakeThreshold(30);
  }
}

// Function added by Rina
// Resize the canvas when phone screen orientation is changed
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

//Function added by Rina
// pick the dominant axis (x / y), then spawn from the opposite side so they "pour in".
function chooseSpawnEdgeFromGravity() {
  const gx = gyroEnabled ? gravity.x : 0; // if enabled, choose gravity x/y, otherwise, 0
  const gy = gyroEnabled ? gravity.y : 0;
  const mag = Math.hypot(gx, gy); // safe calculation for √(gx² + gy²)

  if (mag < 0.2) { // ignore random gyroscope move
    const edges = ['left', 'right', 'top', 'bottom'];
    return random(edges);
  }

  if (abs(gx) >= abs(gy)) { //if horizontal direction dominates,
    return gx >= 0 ? 'left' : 'right'; // if gx is positive, choose left, otherwise right
  } else {
    return gy >= 0 ? 'top' : 'bottom'; // if gy is positive, choose top, otherwise bottom
  }
}


//Function added by Rina
// find nearest edge for a given position
function nearestEdgeForPosition(x, y) {
  const dLeft = x;
  const dRight = width - x;
  const dTop = y;
  const dBottom = height - y;

  const minD = min(dLeft, dRight, dTop, dBottom);
  if (minD === dLeft) return 'left';
  if (minD === dRight) return 'right';
  if (minD === dTop) return 'top';
  return 'bottom';
}

// Functions added by Rina
// Spawn particles along a given edge
function spawnParticlesFromEdge(edge) {
  particles = [];

  activeEdges.spawn = edge;
  activeEdges.exit = null;
  edgeHighlightStartTime = millis();

  for (let i = 0; i < NUM_PARTICLES; i++) {
    let x, y;
    if (edge === 'left') {
      x = PARTICLE_RADIUS / 2;
      y = random(PARTICLE_RADIUS, height - PARTICLE_RADIUS);
    } else if (edge === 'right') {
      x = width - PARTICLE_RADIUS / 2;
      y = random(PARTICLE_RADIUS, height - PARTICLE_RADIUS);
    } else if (edge === 'top') {
      x = random(PARTICLE_RADIUS, width - PARTICLE_RADIUS);
      y = PARTICLE_RADIUS / 2;
    } else if (edge === 'bottom') {
      x = random(PARTICLE_RADIUS, width - PARTICLE_RADIUS);
      y = height - PARTICLE_RADIUS / 2;
    } else {
      x = width / 2;
      y = height / 2;
    }
    particles.push({ //creates object with properties named pos, prev, exiting, exitDir.
      pos: createVector(x, y),
      prev: createVector(x, y),
      // vel: createVector(0, 0), vel not needed since verlet integration is used to calculate motions safely
      exiting: false,
      exitDir: null
    });
  }
}

// Function added by Rina
// set each particle to exit via its nearest common edge 
function setParticlesToExitNearestEdge() {
  const edgeCounts = { left: 0, right: 0, top: 0, bottom: 0 }; // start the counter to keep track of how many particles will exit via left/right/top/bottom.

  for (let p of particles) {
    const edge = nearestEdgeForPosition(p.pos.x, p.pos.y);
    edgeCounts[edge]++;
    p.exiting = true; // update status to exit
    if (edge === 'left') { // create vector directly towards the exiting edge
      p.exitDir = createVector(-1, 0);
    } else if (edge === 'right') {
      p.exitDir = createVector(1, 0);
    } else if (edge === 'top') {
      p.exitDir = createVector(0, -1);
    } else {
      p.exitDir = createVector(0, 1); // bottom
    }
  }

  // Find the most common edge
  let maxCount = 0;
  let mostCommonEdge = 'left';
  for (let edge in edgeCounts) { //Loop over the edges and update when a larger count is found
    if (edgeCounts[edge] > maxCount) {
      maxCount = edgeCounts[edge];
      mostCommonEdge = edge;
    }
  }

  activeEdges.exit = mostCommonEdge;
  activeEdges.spawn = null;
  edgeHighlightStartTime = millis();
}

// Draw a teardrop centered at (x, y), with overall size and rotation angle (radians).
function drawTeardrop(x, y, size, angle) {
  const w = size;        // bulb width
  const h = size * 1.6;  // drop height

  push();
  translate(x, y); // translate centers
  rotate(angle + HALF_PI);
  noStroke();

  beginShape();
  vertex(0, -h / 2);
  bezierVertex(
    +w / 2, -h / 2 + h * 0.25,
    +w / 2, +h * 0.20,
    0, +h / 2
  );
  bezierVertex(
    -w / 2, +h * 0.20,
    -w / 2, -h / 2 + h * 0.25,
    0, -h / 2
  );
  endShape(CLOSE);

  pop();
}

// Function added by Jennifer
// Draw edge highlight effect
function drawEdgeHighlight() {
  const currentTime = millis();
  const elapsed = currentTime - edgeHighlightStartTime;

  if (elapsed > EDGE_HIGHLIGHT_DURATION) {
    activeEdges.spawn = null;
    activeEdges.exit = null;
    return; // end the operation
  }

  noFill();

  if (activeEdges.exit) {
    drawEdgeLine(activeEdges.exit);
  } else if (activeEdges.spawn) {
    drawEdgeLine(activeEdges.spawn);
  }
}

//Function added by Jennifer
// Draw specified edge line (with glow effect)
function drawEdgeLine(edge) { //dade alpha from 255 to 0 over the highlight duration
    const elapsed = millis() - edgeHighlightStartTime;
  const currentAlpha = map(elapsed, 0, EDGE_HIGHLIGHT_DURATION, 255, 0);

// add a brief flicker in the first second using a sine wave
let flickerAlpha;
if (elapsed < 1000) {
  flickerAlpha = currentAlpha * (0.8 + 0.4 * sin(millis() * 0.02));
} else {
  flickerAlpha = currentAlpha;
}

  // Overlay different stroke/opacity lines on top of each other to create a halo effect
  stroke(150, 200, 255, flickerAlpha * 0.2);
  strokeWeight(40);
  drawSingleEdgeLine(edge);

  stroke(120, 180, 255, flickerAlpha * 0.4);
  strokeWeight(32);
  drawSingleEdgeLine(edge);

  stroke(100, 170, 255, flickerAlpha * 0.6);
  strokeWeight(28);
  drawSingleEdgeLine(edge);

  stroke(80, 160, 255, flickerAlpha * 0.8);
  strokeWeight(24);
  drawSingleEdgeLine(edge);

  stroke(60, 150, 255, flickerAlpha * 0.9);
  strokeWeight(20);
  drawSingleEdgeLine(edge);

  stroke(40, 140, 255, flickerAlpha);
  strokeWeight(16);
  drawSingleEdgeLine(edge);
}

// Function added by Jennifer
// Draw single edge line
function drawSingleEdgeLine(edge) {
  if (edge === 'left') {
    line(0, 0, 0, height);
  } else if (edge === 'right') {
    line(width, 0, width, height);
  } else if (edge === 'top') {
    line(0, 0, width, 0);
  } else if (edge === 'bottom') {
    line(0, height, width, height);
  }
}

function draw() {
  background(30);

  // Use verlet integration
  for (let p of particles) {
    const temp = p.pos.copy();

    let ax = gravity.x + random(-0.1, 0.1); // add jitter for more natural motion
    let ay = gravity.y + random(-0.1, 0.1);

    if (p.exiting && p.exitDir) { //if this particle is exiting, override acceleration to push it toward its exit direction
      ax = p.exitDir.x * EXIT_ACCEL;
      ay = p.exitDir.y * EXIT_ACCEL;
    }

    p.pos.x += (p.pos.x - p.prev.x) * 0.98 + ax;
    p.pos.y += (p.pos.y - p.prev.y) * 0.98 + ay;
    p.prev = temp;
  }

  // Relaxation, generated by GPT5 on Oct 15, 2025
  for (let iter = 0; iter < RELAXATION_ITER; iter++) {
    for (let i = 0; i < particles.length; i++) {
      let p1 = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        let p2 = particles[j];
        let delta = p5.Vector.sub(p1.pos, p2.pos);
        let d = delta.mag();
        if (d < REST_DISTANCE && d > 0) {
          let overlap = (REST_DISTANCE - d) / 2;
          delta.normalize(); // direction to push along
        // Push both particles away equally, half the overlap each
          p1.pos.add(p5.Vector.mult(delta, overlap));
          p2.pos.sub(p5.Vector.mult(delta, overlap));
        }
      }
    }
  }

  // Bounds / exit
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    if (p.exiting && p.exitDir) { //if this particle is exiting
      if (
        (p.exitDir.x < 0 && p.pos.x < -PARTICLE_RADIUS) || //or
        (p.exitDir.x > 0 && p.pos.x > width + PARTICLE_RADIUS) || //or
        (p.exitDir.y < 0 && p.pos.y < -PARTICLE_RADIUS) || //or
        (p.exitDir.y > 0 && p.pos.y > height + PARTICLE_RADIUS)
      ) {
        particles.splice(i, 1); //delete the particles exited, generated by GPT5 on Oct15, 2025
      }
    } else { // make sure the particles staying in the screen is within the edges
      if (p.pos.x < PARTICLE_RADIUS / 2) p.pos.x = PARTICLE_RADIUS / 2;
      if (p.pos.x > width - PARTICLE_RADIUS / 2) p.pos.x = width - PARTICLE_RADIUS / 2;
      if (p.pos.y < PARTICLE_RADIUS / 2) p.pos.y = PARTICLE_RADIUS / 2;
      if (p.pos.y > height - PARTICLE_RADIUS / 2) p.pos.y = height - PARTICLE_RADIUS / 2;
    }
  }

  // Draw particles
  fill(0, 150, 255, 180);
  noStroke();
  for (let p of particles) {
    const vx = p.pos.x - p.prev.x;
    const vy = p.pos.y - p.prev.y;
    let angle = atan2(vy, vx);

    const speed = Math.hypot(vx, vy);
    if (speed < 0.01) { //use gravity value instead of velocity when velocity is too small to be reliable. Generated by GPT5 on Oct15, 2025
      const gmag = Math.hypot(gravity.x, gravity.y);
      angle = gmag > 0.001 ? atan2(gravity.y, gravity.x) : 0;
    }

    drawTeardrop(p.pos.x, p.pos.y, PARTICLE_RADIUS, angle);
  }

  // Edge highlight
  drawEdgeHighlight();

  // Permission hint
  if (!gyroEnabled) {
    fill(255, 255, 255, 150);
    textSize(16);
    textAlign(CENTER, CENTER);
    text("Click 'Enable Motion' button to start", width / 2, height - 30);
  }
}

// Function added by Rina
// Shake handler
function deviceShaken() {
  if (!gyroEnabled) return; //end this if gyroEnabled is false.

  const now = millis();
  if (now - lastShakeTime < SHAKE_COOLDOWN) return; // Debounce
  lastShakeTime = now; //generated by GPT5, Oct12, 2025

  
  if (particles.length === 0) { //if there are no particles yet in the screen,
    const edge = chooseSpawnEdgeFromGravity(); //prepare to spawn particles
    spawnParticlesFromEdge(edge);
  } else {
    const anyNotExiting = particles.some(p => !p.exiting); //check if any particle is not yet in the exiting mode..some() returns true as soon as one element satisfies the predicate (not exiting). Generated by GPT5 on Oct16 2025.
    if (anyNotExiting) { //then prepare for exit mode
      setParticlesToExitNearestEdge();
    }
  }
}

//Function added by Rina
// Tilt
function deviceMoved() {
  if (
    gyroEnabled &&
    typeof accelerationX !== 'undefined' &&
    typeof accelerationY !== 'undefined'
  ) {
    gravity.x = accelerationX * 0.5;
    gravity.y = accelerationY * 0.5;
  }
}

// Desktop fallback
function mouseMoved() {
  if (!gyroEnabled) {
    gravity.x = map(mouseX, 0, width, -1, 1);
    gravity.y = map(mouseY, 0, height, -1, 1);
  }
}