import { useEffect, useRef, useState } from "react";

interface Props {
  state: "idle" | "walking" | "attacking" | "hurt";
  classIcon: string;
  floor: number;
  kills: number;
  hpPercent: number;
}

const COLORS = {
  red: "#dc3228",
  redLight: "#f05a46",
  redDark: "#aa2319",
  orange: "#f09c3c",
  claw: "#eb4632",
  clawDark: "#b42d1e",
  clawLight: "#f5785a",
  eye: "#f0f0f5",
  pupil: "#0f0f19",
  scouter: "#00ffb4",
  scouter2: "#009e70",
  scoGray: "#464b5a",
  mouth: "#8c1914",
  ground: "#2a1a0a",
  groundLight: "#3a2a1a",
  wall: "#3a2a20",
  wallLight: "#4a3a30",
  torch: "#ff8800",
  bone: "#aaa088",
  blood: "#550000",
  monster: "#446644",
  monsterEye: "#ff0000",
};

function px(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x * s, y * s, s, s);
}

// OpenClaw Lobster with Scouter (8x10 sprite)
function drawLobster(ctx: CanvasRenderingContext2D, bx: number, by: number, s: number, frame: number, state: string) {
  const p = (dx: number, dy: number, color: string) => px(ctx, bx + dx, by + dy, s, color);
  const bob = state === "walking" ? (frame % 2 === 0 ? 0 : -1) : 0;
  const hurtShake = state === "hurt" ? (frame % 2 === 0 ? -1 : 1) : 0;
  const ox = hurtShake;

  // Antennae
  p(ox + 2, bob - 2, COLORS.redDark);
  p(ox + 5, bob - 2, COLORS.redDark);
  p(ox + 2, bob - 3, COLORS.orange);
  p(ox + 5, bob - 3, COLORS.orange);

  // Head (round-ish, 5 wide)
  p(ox + 2, bob + -1, COLORS.red);
  p(ox + 3, bob + -1, COLORS.red);
  p(ox + 4, bob + -1, COLORS.red);
  p(ox + 5, bob + -1, COLORS.red);
  for (let dx = 1; dx <= 6; dx++) p(ox + dx, bob + 0, COLORS.red);
  for (let dx = 1; dx <= 6; dx++) p(ox + dx, bob + 1, COLORS.red);
  for (let dx = 1; dx <= 6; dx++) p(ox + dx, bob + 2, COLORS.red);
  for (let dx = 2; dx <= 5; dx++) p(ox + dx, bob + 3, COLORS.red);

  // Head highlight
  p(ox + 2, bob + 0, COLORS.redLight);
  p(ox + 3, bob + 0, COLORS.redLight);

  // Left eye
  p(ox + 2, bob + 1, COLORS.eye);
  p(ox + 3, bob + 1, COLORS.eye);
  p(ox + 3, bob + 1, COLORS.pupil);

  // Right eye (behind scouter)
  p(ox + 5, bob + 1, COLORS.eye);
  p(ox + 5, bob + 1, COLORS.pupil);

  // Scouter (left side, green lens)
  p(ox + 0, bob + 0, COLORS.scoGray);
  p(ox + 0, bob + 1, COLORS.scoGray);
  p(ox + 0, bob + 2, COLORS.scoGray);
  p(ox + 1, bob + 1, COLORS.scouter);
  p(ox + 1, bob + 2, COLORS.scouter);
  // Scouter glow animation
  if (frame % 4 < 2) {
    p(ox + 1, bob + 0, COLORS.scouter2);
  }

  // Smirk
  p(ox + 4, bob + 2, COLORS.mouth);
  p(ox + 5, bob + 2, COLORS.mouth);

  // Body (segmented, tapers)
  for (let dx = 2; dx <= 5; dx++) p(ox + dx, bob + 4, COLORS.red);
  for (let dx = 2; dx <= 5; dx++) p(ox + dx, bob + 5, COLORS.redDark);
  p(ox + 3, bob + 4, COLORS.redLight); // segment highlight
  p(ox + 3, bob + 5, COLORS.red);

  // Big right claw (raised when attacking)
  if (state === "attacking") {
    const atkF = frame % 2;
    p(ox + 7, bob + 0 - atkF, COLORS.claw);
    p(ox + 8, bob + -1 - atkF, COLORS.claw);
    p(ox + 9, bob + -1 - atkF, COLORS.clawLight);
    p(ox + 8, bob + 0 - atkF, COLORS.clawDark);
    p(ox + 9, bob + 0 - atkF, COLORS.claw);
    // Snapping animation
    if (atkF === 0) {
      p(ox + 10, bob + -1 - atkF, COLORS.clawLight);
    }
  } else {
    p(ox + 7, bob + 1, COLORS.claw);
    p(ox + 8, bob + 0, COLORS.claw);
    p(ox + 8, bob + 1, COLORS.clawDark);
    p(ox + 9, bob + 0, COLORS.clawLight);
    p(ox + 9, bob + 1, COLORS.claw);
  }

  // Small left claw
  p(ox + 0, bob + 3, COLORS.claw);
  p(ox - 1, bob + 3, COLORS.clawDark);

  // Legs (3 pairs, walking animation)
  if (state === "walking") {
    if (frame % 2 === 0) {
      p(ox + 2, bob + 6, COLORS.redDark);
      p(ox + 4, bob + 6, COLORS.redDark);
      p(ox + 1, bob + 7, COLORS.redDark);
      p(ox + 5, bob + 7, COLORS.redDark);
    } else {
      p(ox + 3, bob + 6, COLORS.redDark);
      p(ox + 5, bob + 6, COLORS.redDark);
      p(ox + 2, bob + 7, COLORS.redDark);
      p(ox + 4, bob + 7, COLORS.redDark);
    }
  } else {
    p(ox + 2, bob + 6, COLORS.redDark);
    p(ox + 3, bob + 6, COLORS.redDark);
    p(ox + 4, bob + 6, COLORS.redDark);
    p(ox + 5, bob + 6, COLORS.redDark);
  }

  // Tail fan
  p(ox + 2, bob + 7, COLORS.redDark);
  p(ox + 3, bob + 7, COLORS.red);
  p(ox + 4, bob + 7, COLORS.red);
  p(ox + 5, bob + 7, COLORS.redDark);

  // Hurt flash
  if (state === "hurt" && frame % 2 === 0) {
    ctx.fillStyle = "rgba(255,0,0,0.3)";
    ctx.fillRect((bx) * s, (by - 3) * s, 11 * s, 11 * s);
  }

  // Scouter power reading (floating numbers when idle/walking)
  if (state !== "hurt" && frame % 6 < 3) {
    ctx.fillStyle = COLORS.scouter;
    ctx.fillRect((bx + ox - 2) * s, (by + bob - 1) * s, s * 0.6, s * 0.6);
    ctx.fillRect((bx + ox - 1) * s, (by + bob - 2) * s, s * 0.6, s * 0.6);
  }
}

function drawMonster(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, frame: number, alive: boolean) {
  if (!alive) {
    px(ctx, x, y + 5, s, COLORS.bone);
    px(ctx, x + 1, y + 5, s, COLORS.bone);
    px(ctx, x + 2, y + 5, s, COLORS.bone);
    px(ctx, x + 1, y + 4, s, COLORS.blood);
    return;
  }
  const bob = frame % 2 === 0 ? 0 : -1;
  px(ctx, x + 1, y + bob + 1, s, COLORS.monster);
  px(ctx, x + 2, y + bob + 1, s, COLORS.monster);
  px(ctx, x, y + bob + 2, s, COLORS.monster);
  px(ctx, x + 1, y + bob + 2, s, COLORS.monster);
  px(ctx, x + 2, y + bob + 2, s, COLORS.monster);
  px(ctx, x + 3, y + bob + 2, s, COLORS.monster);
  px(ctx, x, y + bob + 3, s, COLORS.monster);
  px(ctx, x + 1, y + bob + 3, s, COLORS.monster);
  px(ctx, x + 2, y + bob + 3, s, COLORS.monster);
  px(ctx, x + 3, y + bob + 3, s, COLORS.monster);
  px(ctx, x + 1, y + bob + 4, s, COLORS.monster);
  px(ctx, x + 2, y + bob + 4, s, COLORS.monster);
  px(ctx, x + 1, y + bob + 1, s, COLORS.monsterEye);
  px(ctx, x + 2, y + bob + 1, s, COLORS.monsterEye);
  px(ctx, x, y + bob + 5, s, COLORS.monster);
  px(ctx, x + 3, y + bob + 5, s, COLORS.monster);
}

function drawTorch(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, frame: number) {
  px(ctx, x, y + 3, s, "#554433");
  px(ctx, x, y + 4, s, "#554433");
  px(ctx, x, y + 5, s, "#554433");
  px(ctx, x, y + 2, s, COLORS.torch);
  const flicker = frame % 3;
  if (flicker !== 2) px(ctx, x - 1 + flicker, y + 1, s, "#ffaa00");
  if (flicker !== 0) px(ctx, x + flicker - 1, y, s, "#ff6600");
  ctx.fillStyle = "rgba(255,140,0,0.08)";
  ctx.beginPath();
  ctx.arc((x + 0.5) * s, (y + 1) * s, s * 4, 0, Math.PI * 2);
  ctx.fill();
}

export default function PixelDungeon({ state, classIcon, floor, kills, hpPercent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const [monsterAlive, setMonsterAlive] = useState(true);
  const charPosRef = useRef(4);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    const S = 4;

    let animId: number;
    let tick = 0;

    const render = () => {
      tick++;
      if (tick % 8 === 0) frameRef.current++;
      const frame = frameRef.current;

      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = "#0a0505";
      ctx.fillRect(0, 0, W, H);

      // Floor
      for (let x = 0; x < W / S; x++) {
        for (let y = Math.floor(H / S) - 4; y < H / S; y++) {
          px(ctx, x, y, S, (x + y) % 3 === 0 ? COLORS.groundLight : COLORS.ground);
        }
      }

      // Walls
      for (let x = 0; x < W / S; x++) {
        for (let y = 0; y < Math.floor(H / S) - 8; y++) {
          px(ctx, x, y, S, (x + y) % 5 === 0 ? COLORS.wallLight : COLORS.wall);
        }
      }

      // Wall edge
      for (let x = 0; x < W / S; x++) {
        px(ctx, x, Math.floor(H / S) - 8, S, "#1a0a05");
      }

      // Torches
      drawTorch(ctx, 8, Math.floor(H / S) - 12, S, frame);
      drawTorch(ctx, W / S - 10, Math.floor(H / S) - 12, S, frame);

      // Floor number
      ctx.fillStyle = "#4a3a2a";
      ctx.font = "10px Georgia";
      ctx.fillText(`Floor ${floor}`, 6, 14);

      // Character
      const charY = Math.floor(H / S) - 12;
      let charX = charPosRef.current;

      if (state === "walking" && tick % 4 === 0) {
        charX += 1;
        if (charX > W / S - 15) charX = 4;
        charPosRef.current = charX;
      }

      if (state === "attacking") {
        charPosRef.current = Math.min(charPosRef.current, W / S - 18);
        charX = charPosRef.current;
      }

      drawLobster(ctx, charX, charY, S, frame, state);

      // Monster
      const monsterX = W / S - 10;
      const monsterY = Math.floor(H / S) - 10;

      if (state === "attacking" && monsterAlive && tick % 60 === 0) {
        setMonsterAlive(false);
      }

      drawMonster(ctx, monsterX, monsterY, S, frame, monsterAlive);

      if (!monsterAlive && tick % 120 === 0) {
        setMonsterAlive(true);
        charPosRef.current = 4;
      }

      // HP bar
      const hpBarW = 40;
      const hpBarH = 4;
      ctx.fillStyle = "#1a0808";
      ctx.fillRect((charX + 1) * S, (charY - 4) * S, hpBarW, hpBarH);
      ctx.fillStyle = hpPercent > 50 ? "#22aa22" : hpPercent > 25 ? "#aaaa22" : "#cc2222";
      ctx.fillRect((charX + 1) * S, (charY - 4) * S, hpBarW * (hpPercent / 100), hpBarH);

      // Attack particles (claw snaps!)
      if (state === "attacking" && monsterAlive) {
        for (let i = 0; i < 3; i++) {
          const ppx = (charX + 10 + Math.random() * 4) * S;
          const ppy = (charY + 1 + Math.random() * 3) * S;
          ctx.fillStyle = `rgba(255,${Math.floor(Math.random() * 150)},0,${0.3 + Math.random() * 0.5})`;
          ctx.fillRect(ppx, ppy, S, S);
        }
      }

      // Hurt flash
      if (state === "hurt" && frame % 4 < 2) {
        ctx.fillStyle = "rgba(180,0,0,0.15)";
        ctx.fillRect(0, 0, W, H);
      }

      // Vignette
      const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.6)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [state, floor, kills, hpPercent, monsterAlive]);

  return (
    <canvas
      ref={canvasRef}
      width={332}
      height={140}
      className="pixel-dungeon-canvas"
    />
  );
}
