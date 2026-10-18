import { today } from "../lib/constants";

// Murciélago 8 bits que cruza volando la pantalla de inicio de sesión.
// Decoración de temporada: se muestra solo hasta el 10 de noviembre de 2026.
const BAT_SEASON_END = "2026-11-10";
const batSeasonActive = () => today() <= BAT_SEASON_END;

// Cuadrícula de 16 × 8 "píxeles": # = cuerpo/alas, o = ojos
const FRAME_UP = [
  "#..............#",
  "##............##",
  "###...#..#...###",
  "####.#o##o#.####",
  ".##############.",
  "..############..",
  ".....######.....",
  "......#..#......",
];
const FRAME_DOWN = [
  "......#..#......",
  ".....#o##o#.....",
  "....########....",
  "..############..",
  ".##############.",
  "####.######.####",
  "##....#..#....##",
  "#..............#",
];

function Frame({ rows, className }) {
  const px = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === ".") return;
    px.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={c === "o" ? "#ffd23f" : "#5b3594"}/>);
  }));
  return <g className={className}>{px}</g>;
}

export default function PixelBat() {
  if (!batSeasonActive()) return null;
  return (
    <div aria-hidden="true" style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:2,overflow:"hidden"}}>
      <style>{`
        .pb-fly{position:absolute;top:14vh;left:0;animation:pbFly 13s linear infinite;}
        .pb-bob{animation:pbBob 1.6s ease-in-out infinite alternate;}
        .pb-up{animation:pbFlapA .36s steps(1) infinite;}
        .pb-down{animation:pbFlapB .36s steps(1) infinite;}
        @keyframes pbFly{
          0%{transform:translateX(-90px) translateY(0);}
          45%{transform:translateX(55vw) translateY(10vh);}
          70%{transform:translateX(80vw) translateY(-2vh);}
          100%{transform:translateX(calc(100vw + 90px)) translateY(6vh);}
        }
        @keyframes pbBob{from{transform:translateY(-10px);}to{transform:translateY(12px);}}
        @keyframes pbFlapA{0%{opacity:1;}50%{opacity:0;}}
        @keyframes pbFlapB{0%{opacity:0;}50%{opacity:1;}}
        @media (prefers-reduced-motion: reduce){
          .pb-fly{animation:none;left:auto;right:8vw;}
          .pb-bob,.pb-up,.pb-down{animation:none;}
          .pb-down{opacity:0;}
        }
      `}</style>
      <div className="pb-fly">
        <div className="pb-bob" style={{filter:"drop-shadow(0 0 6px rgba(157,36,73,.55))"}}>
          <svg width="64" height="32" viewBox="0 0 16 8" shapeRendering="crispEdges">
            <Frame rows={FRAME_UP} className="pb-up"/>
            <Frame rows={FRAME_DOWN} className="pb-down"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
