import {
  getWindow,
  listMonitors,
  onCursorPosition,
  onTrayAction,
} from "./game/bindings";

const PET_WIDTH = 240;
const PET_HEIGHT = 260;

window.addEventListener("DOMContentLoaded", async () => {
  let canvas = document.querySelector<HTMLCanvasElement>("#pet");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "pet";
    document.body.appendChild(canvas);
  }

  // Backing store scales by device pixel ratio; CSS size stays 240x260 and
  // all drawing coordinates remain logical.
  const dpr = window.devicePixelRatio || (await getWindow().scaleFactor()) || 1;
  canvas.width = PET_WIDTH * dpr;
  canvas.height = PET_HEIGHT * dpr;

  // Placeholder fill until todo 5's renderer takes over the context.
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "rgba(255, 227, 236, 0.9)";
    ctx.beginPath();
    ctx.ellipse(PET_WIDTH / 2, PET_HEIGHT / 2, 70, 60, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  console.log("[healing-pet] bindings ready");

  const monitors = await listMonitors();
  console.log("[healing-pet]", "listMonitors:", monitors.length);

  onCursorPosition((pos) => console.log("[healing-pet] cursor", pos.x, pos.y));
  onTrayAction((action) => console.log("[healing-pet] tray", action));
});