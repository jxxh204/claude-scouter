import { useEffect, useRef, useState } from "react";

interface Props {
  state: "idle" | "walking" | "attacking" | "hurt";
  classIcon: string;
  floor: number;
  kills: number;
  hpPercent: number;
}

// Simple pixel art sprites (8x8 grid per frame)
const COLORS = {
  skin: "#e8b878",
  hair: "#4a3020",
  armor: "#707090",
  weapon: "#c0c0d0",
  red: "#cc2222",
  darkRed: "#8b0000",
  eye: "#222",
  boot: "#554433",
  ground: "#2a1a0a",
  groundLight: "#3a2a1a",
  wall: "#3a2a20",
  wallLight: "#4a3a30",
  torch: "#ff8800",
  torchGlow: "#ff440044",
  blood: "#550000",
  bone: "#aaa088",
  monster: "#446644",
  monsterEye: "#ff0000",
};

function drawPixel(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);
}

// Character sprite frames
function drawCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, frame: number, state: string) {
  const px = (dx: number, dy: number, color: string) => drawPixel(ctx, x + dx, y + dy, s, color);

  // Body based on frame
  const bobY = state === "walking" ? (frame % 2 === 0 ? 0 : -1) : 0;
  const atkX = state === "attacking" ? (frame % 2 === 0 ? 1 : 2) : 0;
  const hurtShake = state === "hurt" ? (frame % 2 === 0 ? -1 : 1) : 0;
  const ox = hurtShake;

  // Hair
  px(ox + 2, bobY + 0, COLORS.hair);
  px(ox + 3, bobY + 0, COLORS.hair);
  px(ox + 4, bobY + 0, COLORS.hair);

  // Head
  px(ox + 2, bobY + 1, COLORS.skin);
  px(ox + 3, bobY + 1, COLORS.skin);
  px(ox + 4, bobY + 1, COLORS.skin);

  // Eyes
  px(ox + 4, bobY + 1, COLORS.eye);

  // Body / armor
  px(ox + 2, bobY + 2, COLORS.armor);
  px(ox + 3, bobY + 2, COLORS.armor);
  px(ox + 4, bobY + 2, COLORS.armor);
  px(ox + 2, bobY + 3, COLORS.armor);
  px(ox + 3, bobY + 3, COLORS.armor);
  px(ox + 4, bobY + 3, COLORS.armor);

  // Arms
  if (state === "attacking") {
    px(ox + 5 + atkX, bobY + 2, COLORS.skin);
    // Weapon swing
    px(ox + 6 + atkX, bobY + 1, COLORS.weapon);
    px(ox + 7 + atkX, bobY + 0, COLORS.weapon);
  } else {
    px(ox + 1, bobY + 2, COLORS.skin);
    px(ox + 5, bobY + 2, COLORS.skin);
    // Weapon at rest
    px(ox + 5, bobY + 3, COLORS.weapon);
    px(ox + 5, bobY + 4, COLORS.weapon);
  }

  // Legs
  if (state === "walking") {
    if (frame % 2 === 0) {
      px(ox + 2, bobY + 4, COLORS.boot);
      px(ox + 4, bobY + 4, COLORS.boot);
      px(ox + 2, bobY + 5, COLORS.boot);
      px(ox + 5, bobY + 5, COLORS.boot);
    } else {
      px(ox + 3, bobY + 4, COLORS.boot);
      px(ox + 3, bobY + 5, COLORS.boot);
      px(ox + 4, bobY + 5, COLORS.boot);
    }
  } else {
    px(ox + 2, bobY + 4, COLORS.boot);
    px(ox + 4, bobY + 4, COLORS.boot);
    px(ox + 2, bobY + 5, COLORS.boot);
    px(ox + 4, bobY + 5, COLORS.boot);
  }

  // Hurt flash
  if (state === "hurt" && frame % 2 === 0) {
    ctx.fillStyle = "rgba(255,0,0,0.3)";
    ctx.fillRect((x + 1) * s, y * s, 5 * s, 6 * s);
  }
}

function drawMonster(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, frame: number, alive: boolean) {
  const px = (dx: number, dy: number, color: string) => drawPixel(ctx, x + dx, y + dy, s, color);
  if (!alive) {
    // Dead monster - bones
    px(0, 5, COLORS.bone); px(1, 5, COLORS.bone); px(2, 5, COLORS.bone);
    px(1, 4, COLORS.blood);
    return;
  }
  const bob = frame % 2 === 0 ? 0 : -1;
  // Body
  px(1, bob + 1, COLORS.monster); px(2, bob + 1, COLORS.monster);
  px(0, bob + 2, COLORS.monster); px(1, bob + 2, COLORS.monster); px(2, bob + 2, COLORS.monster); px(3, bob + 2, COLORS.monster);
  px(0, bob + 3, COLORS.monster); px(1, bob + 3, COLORS.monster); px(2, bob + 3, COLORS.monster); px(3, bob + 3, COLORS.monster);
  px(1, bob + 4, COLORS.monster); px(2, bob + 4, COLORS.monster);
  // Eyes
  px(1, bob + 1, COLORS.monsterEye); px(2, bob + 1, COLORS.monsterEye);
  // Legs
  px(0, bob + 5, COLORS.monster); px(3, bob + 5, COLORS.monster);
}

function drawTorch(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, frame: number) {
  const px = (dx: number, dy: number, color: string) => drawPixel(ctx, x + dx, y + dy, s, color);
  // Stick
  px(0, 3, "#554433"); px(0, 4, "#554433"); px(0, 5, "#554433");
  // Flame (animated)
  const flicker = frame % 3;
  px(0, 2, COLORS.torch);
  if (flicker !== 2) px(-1 + flicker, 1, "#ffaa00");
  if (flicker !== 0) px(flicker - 1, 0, "#ff6600");
  // Glow
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
    const S = 4; // pixel size

    let animId: number;
    let tick = 0;

    const render = () => {
      tick++;
      if (tick % 8 === 0) frameRef.current++;
      const frame = frameRef.current;

      ctx.clearRect(0, 0, W, H);

      // Background - dungeon
      ctx.fillStyle = "#0a0505";
      ctx.fillRect(0, 0, W, H);

      // Floor
      for (let x = 0; x < W / S; x++) {
        for (let y = Math.floor(H / S) - 4; y < H / S; y++) {
          const color = (x + y) % 3 === 0 ? COLORS.groundLight : COLORS.ground;
          drawPixel(ctx, x, y, S, color);
        }
      }

      // Walls
      for (let x = 0; x < W / S; x++) {
        for (let y = 0; y < Math.floor(H / S) - 8; y++) {
          const color = (x + y) % 5 === 0 ? COLORS.wallLight : COLORS.wall;
          drawPixel(ctx, x, y, S, color);
        }
      }

      // Wall bottom edge
      for (let x = 0; x < W / S; x++) {
        drawPixel(ctx, x, Math.floor(H / S) - 8, S, "#1a0a05");
      }

      // Torches
      drawTorch(ctx, 8, Math.floor(H / S) - 12, S, frame);
      drawTorch(ctx, W / S - 10, Math.floor(H / S) - 12, S, frame);

      // Floor number
      ctx.fillStyle = "#4a3a2a";
      ctx.font = "10px Georgia";
      ctx.fillText(`Floor ${floor}`, 6, 14);

      // Character position (walking moves right)
      const charY = Math.floor(H / S) - 10;
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

      drawCharacter(ctx, charX, charY, S, frame, state);

      // Monster
      const monsterX = W / S - 10;
      const monsterY = Math.floor(H / S) - 10;

      if (state === "attacking" && frame % 4 === 0 && monsterAlive) {
        // Kill monster after a few frames
        if (tick % 60 === 0) setMonsterAlive(false);
      }

      drawMonster(ctx, monsterX, monsterY, S, frame, monsterAlive);

      // Respawn monster
      if (!monsterAlive && tick % 120 === 0) {
        setMonsterAlive(true);
        charPosRef.current = 4;
      }

      // HP bar overlay
      const hpBarW = 40;
      const hpBarH = 4;
      ctx.fillStyle = "#1a0808";
      ctx.fillRect((charX + 1) * S, (charY - 2) * S, hpBarW, hpBarH);
      ctx.fillStyle = hpPercent > 50 ? "#22aa22" : hpPercent > 25 ? "#aaaa22" : "#cc2222";
      ctx.fillRect((charX + 1) * S, (charY - 2) * S, hpBarW * (hpPercent / 100), hpBarH);

      // Particle effects for attacking
      if (state === "attacking" && monsterAlive) {
        for (let i = 0; i < 3; i++) {
          const px = (charX + 8 + Math.random() * 4) * S;
          const py = (charY + 1 + Math.random() * 3) * S;
          ctx.fillStyle = `rgba(255,${Math.floor(Math.random() * 150)},0,${0.3 + Math.random() * 0.5})`;
          ctx.fillRect(px, py, S, S);
        }
      }

      // Hurt screen flash
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
