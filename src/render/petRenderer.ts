/**
 * Canvas 2D renderer for the blob-cat.
 *
 * `drawPet` is a stateless renderer: it takes only a 2D context, a Pose, and a
 * stopwatch phase `t` (used solely for particle animation). It never touches
 * the DOM and holds no internal state — every visible value comes from the
 * pose. All drawing uses Canvas 2D primitives; no images or sprites.
 */

import type { EyeState, Mouth, Pose } from "./pose";

/** Logical canvas size (DPR scaling is handled by the caller). */
const CANVAS_W = 240;
const CANVAS_H = 260;

/** Character body center in logical canvas coordinates. */
const BODY_X = 120;
const BODY_Y = 150;

/** Pastel palette for the blob-cat. */
const PALETTE = {
  body: "#FFE3EC",
  outline: "#F2B8C8",
  innerEar: "#F8A8BC",
  eye: "#2B2B2B",
  blush: "rgba(255, 150, 170, 0.45)",
  shadow: "rgba(0, 0, 0, 0.12)",
  zzz: "#B0A8C8",
  heart: "#FF6B8A",
} as const;

const DEG = Math.PI / 180;

/** Draw the blob-cat for the given pose. `t` is a stopwatch in seconds. */
export function drawPet(ctx: CanvasRenderingContext2D, pose: Pose, t: number): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const cx = BODY_X + pose.leanX;
  const cy = BODY_Y + pose.bodyY;

  drawShadow(ctx, cx, pose);
  drawTail(ctx, cx, cy, pose);
  drawCharacter(ctx, cx, cy, pose);
  if (pose.zzz) drawZzz(ctx, cx, cy, t);
  if (pose.hearts) drawHearts(ctx, cx, cy, t);
}

/** Ground shadow under the body; shrinks as the pet floats up. */
function drawShadow(ctx: CanvasRenderingContext2D, cx: number, pose: Pose): void {
  const scale = Math.max(0.6, 1 - pose.bodyY * 0.01);
  const y = 208 + pose.bodyY * 0.4;
  ctx.beginPath();
  ctx.ellipse(cx, y, 34 * scale, 8 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.shadow;
  ctx.fill();
}

/** Tail: a quadratic bezier from the body's right side, swaying with tailAngle. */
function drawTail(ctx: CanvasRenderingContext2D, cx: number, cy: number, pose: Pose): void {
  const rad = pose.tailAngle * DEG;
  const baseX = cx + 30;
  const baseY = cy + 10;
  const tipX = cx + 42 + Math.sin(rad) * 14;
  const tipY = cy - 26 + Math.cos(rad) * 8;
  const ctrlX = cx + 48;
  const ctrlY = cy - 4;

  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
  ctx.strokeStyle = PALETTE.body;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Body + ears + face + paws, squashed together around the body center. */
function drawCharacter(ctx: CanvasRenderingContext2D, cx: number, cy: number, pose: Pose): void {
  const squashX = 1 + pose.squash * 0.25;
  const squashY = 1 - pose.squash * 0.5;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(squashX, squashY);

  // Body
  ctx.beginPath();
  ctx.ellipse(0, 0, 35, 30, 0, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.body;
  ctx.fill();
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ears (on top of the body, behind the face)
  drawEar(ctx, -16, -18, pose.earAngle);
  drawEar(ctx, 16, -18, pose.earAngle);

  // Face
  drawEye(ctx, -12, -4, pose.eyeState);
  drawEye(ctx, 12, -4, pose.eyeState);
  drawMouth(ctx, pose.mouth);
  if (pose.blush) drawBlush(ctx);

  // Paws
  drawPaws(ctx);

  ctx.restore();
}

/** One ear as a rounded triangle, rotated around its base by earAngle. */
function drawEar(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  angleDeg: number,
): void {
  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.rotate(angleDeg * DEG);
  ctx.beginPath();
  ctx.moveTo(-11, 0);
  ctx.quadraticCurveTo(-1, -26, 0, -24);
  ctx.quadraticCurveTo(1, -26, 11, 0);
  ctx.closePath();
  ctx.fillStyle = PALETTE.body;
  ctx.fill();
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner ear
  ctx.beginPath();
  ctx.moveTo(-5.5, -2);
  ctx.quadraticCurveTo(-1, -15, 0, -14);
  ctx.quadraticCurveTo(1, -15, 5.5, -2);
  ctx.closePath();
  ctx.fillStyle = PALETTE.innerEar;
  ctx.fill();
  ctx.restore();
}

/** One eye, shaped by the eye state. */
function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, state: EyeState): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = "round";
  switch (state) {
    case "open":
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.eye;
      ctx.fill();
      break;
    case "half":
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI);
      ctx.closePath();
      ctx.fillStyle = PALETTE.eye;
      ctx.fill();
      break;
    case "closed":
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI);
      ctx.strokeStyle = PALETTE.eye;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    case "happy":
      ctx.beginPath();
      ctx.arc(0, 0, 4, Math.PI, Math.PI * 2);
      ctx.strokeStyle = PALETTE.eye;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** Mouth shapes: smile arc, "o" circle, or none. */
function drawMouth(ctx: CanvasRenderingContext2D, mouth: Mouth): void {
  ctx.lineCap = "round";
  switch (mouth) {
    case "smile":
      ctx.beginPath();
      ctx.arc(0, 6, 3.5, 0, Math.PI);
      ctx.strokeStyle = PALETTE.eye;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    case "o":
      ctx.beginPath();
      ctx.arc(0, 6, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.eye;
      ctx.fill();
      break;
    case "none":
      break;
  }
}

/** Two translucent pink cheek blushes. */
function drawBlush(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE.blush;
  ctx.beginPath();
  ctx.ellipse(-18, 2, 5.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(18, 2, 5.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Two small paws at the bottom of the body. */
function drawPaws(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE.body;
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 1.5;
  for (const x of [-12, 12]) {
    ctx.beginPath();
    ctx.ellipse(x, 27, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/** Rising "Z" letters, staggered by the stopwatch phase. */
function drawZzz(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
  ctx.fillStyle = PALETTE.zzz;
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 3; i++) {
    const phase = (t * 0.8 + i * 0.33) % 1;
    const x = cx + 26 + i * 5;
    const y = cy - 42 - phase * 28;
    ctx.globalAlpha = Math.max(0, 1 - phase);
    ctx.fillText("Z", x, y);
  }
  ctx.globalAlpha = 1;
}

/** Rising hearts, staggered by the stopwatch phase. */
function drawHearts(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
  ctx.fillStyle = PALETTE.heart;
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 3; i++) {
    const phase = (t * 1.2 + i * 0.3) % 1;
    const x = cx - 22 + i * 14 + Math.sin((t + i) * 3) * 3;
    const y = cy - 34 - phase * 30;
    ctx.globalAlpha = Math.max(0, 1 - phase);
    ctx.fillText("♥", x, y);
  }
  ctx.globalAlpha = 1;
}