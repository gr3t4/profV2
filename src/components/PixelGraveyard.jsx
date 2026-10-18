import { halloweenActive } from "../lib/season";

// Cementerio 8 bits en la parte de abajo del inicio de sesión: lápidas, tierra
// y manos de zombi que salen de las tumbas. Temporada hasta el 10 de noviembre.
const P = 4; // tamaño de cada "píxel" en px

const COLORS = {
  "#": "#7d7f96", // piedra
  "l": "#a3a6bd", // brillo de la piedra
  "d": "#4b4d63", // cruz / sombra
  "g": "#6fbf4a", // piel de zombi
  "G": "#4a8a32", // sombra de piel
  "s": "#5b3a6e", // manga rota
  "e": "#3b2a1e", // tierra
  "E": "#56402c", // tierra clara
};

const TOMB = [
  "...####...",
  ".l#######.",
  ".l##dd###.",
  "l#dddddd##",
  "l###dd####",
  "l###dd####",
  "l#########",
  "l#########",
  "##########",
  "dddddddddd",
];

const TOMB_ROUND = [
  "..######..",
  ".l#######.",
  "l#########",
  "l#d#d#d###",
  "l#########",
  "l##dddd###",
  "l#########",
  "##########",
  "dddddddddd",
];

const HAND = [
  ".g.g.g..",
  ".g.g.g..",
  ".ggggg.g",
  ".gggggGg",
  ".GggggG.",
  "..gggG..",
  "..GggG..",
  "..ssss..",
  ".s.ss.s.",
  "..ssss..",
];

const MOUND = [
  "..EEEEEEEE..",
  ".EeeEeeeEee.",
  "eeeeeeeeeeee",
];

function Sprite({ rows, style, className }) {
  const w = rows[0].length, h = rows.length;
  return (
    <svg className={className} width={w * P} height={h * P} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" style={{display:"block",...style}}>
      {rows.flatMap((row, y) => [...row].map((c, x) => c === "." ? null :
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={COLORS[c]}/>))}
    </svg>
  );
}

// Tumbas: posición horizontal (%), tipo de lápida y si tiene mano (con retraso de animación)
const GRAVES = [
  { left: "2%",  tomb: TOMB,       hand: 0.0 },
  { left: "30%", tomb: TOMB_ROUND, hand: null },
  { left: "48%", tomb: TOMB,       hand: 2.2 },
  { left: "78%", tomb: TOMB_ROUND, hand: 4.1 },
];

export default function PixelGraveyard() {
  if (!halloweenActive()) return null;
  const ground = 6 * P; // alto de la franja de tierra
  return (
    <div aria-hidden="true" style={{position:"fixed",left:0,right:0,bottom:0,height:120,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
      <style>{`
        .gy-hand{animation:gyRise 6.5s ease-in-out infinite;transform:translateY(${HAND.length * P}px);}
        @keyframes gyRise{
          0%,18%{transform:translateY(${HAND.length * P}px) rotate(0);}
          32%{transform:translateY(${2 * P}px) rotate(-6deg);}
          40%{transform:translateY(0) rotate(7deg);}
          48%{transform:translateY(0) rotate(-7deg);}
          56%{transform:translateY(0) rotate(6deg);}
          64%{transform:translateY(${P}px) rotate(0);}
          80%,100%{transform:translateY(${HAND.length * P}px) rotate(0);}
        }
        @media (prefers-reduced-motion: reduce){ .gy-hand{animation:none;transform:translateY(${3 * P}px);} }
      `}</style>

      {/* Tierra con pasto pixelado */}
      <div style={{position:"absolute",left:0,right:0,bottom:0,height:ground,
        background:`linear-gradient(#2f6b3a 0 ${P}px, #3b2a1e ${P}px 100%)`,
        boxShadow:"0 -2px 0 #1f4a28"}}/>
      <div style={{position:"absolute",left:0,right:0,bottom:ground - P,height:P,
        backgroundImage:`repeating-linear-gradient(90deg, transparent 0 ${3*P}px, #56402c ${3*P}px ${4*P}px, transparent ${4*P}px ${9*P}px, #2f6b3a ${9*P}px ${10*P}px)`}}/>

      {GRAVES.map((g, i) => (
        <div key={i} style={{position:"absolute",left:g.left,bottom:ground - P,display:"flex",alignItems:"flex-end",gap:P * 2}}>
          <Sprite rows={g.tomb}/>
          {g.hand !== null && (
            <div style={{position:"relative",width:MOUND[0].length * P,height:(HAND.length + MOUND.length) * P}}>
              {/* La mano sale de debajo de la tierra: el contenedor recorta lo que queda abajo */}
              <div style={{position:"absolute",left:2 * P,bottom:MOUND.length * P - P,width:HAND[0].length * P,height:HAND.length * P,overflow:"hidden"}}>
                <Sprite rows={HAND} className="gy-hand" style={{animationDelay:`${g.hand}s`,transformOrigin:"50% 100%"}}/>
              </div>
              <Sprite rows={MOUND} style={{position:"absolute",left:0,bottom:0}}/>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
