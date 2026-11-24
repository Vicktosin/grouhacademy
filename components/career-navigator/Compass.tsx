import { SKILLS, SKILL_IDS, bearing, type RankedSkill } from "@/lib/career-navigator";

// The compass: one point per skill. The needle swings towards the skill the
// answers lean to; the names only show once the result is in.

const CENTER = 200;

function point(degrees: number, radius: number) {
  const angle = ((degrees - 90) * Math.PI) / 180;
  // Rounded, so the server and the browser write the same numbers.
  return { x: +(CENTER + radius * Math.cos(angle)).toFixed(2), y: +(CENTER + radius * Math.sin(angle)).toFixed(2) };
}

export default function Compass({
  ranking,
  needle,
  named = false,
  className = "",
}: {
  ranking: RankedSkill[];
  /** Degrees; keeps counting past 360 so the needle takes the short way. */
  needle: number;
  named?: boolean;
  className?: string;
}) {
  const score = new Map(ranking.map((item) => [item.id, item.score]));
  const best = ranking[0]?.id;
  return (
    <svg viewBox="0 0 400 400" className={className} role="img" aria-label={named && best ? `Your compass points to ${SKILLS[best].name}` : "Compass"}>
      {[186, 150, 96].map((radius) => (
        <circle key={radius} cx={CENTER} cy={CENTER} r={radius} fill="none" stroke="#fff" strokeOpacity={radius === 150 ? 0.28 : 0.12} />
      ))}
      {Array.from({ length: 72 }, (_, index) => {
        const from = point(index * 5, index % 2 ? 182 : 177);
        const to = point(index * 5, 186);
        return <line key={index} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#fff" strokeOpacity="0.3" />;
      })}
      {SKILL_IDS.map((id) => {
        const degrees = bearing(id);
        const dot = point(degrees, 150);
        const inner = point(degrees, 40);
        const label = point(degrees, 100 + 20 * Math.abs(Math.cos((degrees * Math.PI) / 180)));
        const value = score.get(id) ?? 0;
        const lit = named ? id === best : value > 0;
        return (
          <g key={id}>
            <line x1={inner.x} y1={inner.y} x2={dot.x} y2={dot.y} stroke="#fff" strokeOpacity="0.08" />
            <circle
              cx={dot.x}
              cy={dot.y}
              r={lit ? Math.min(11, 6 + Math.max(0, value) * 2) : 4}
              fill={lit ? "#7BE05E" : "#fff"}
              fillOpacity={lit ? 1 : 0.4}
              style={{ transition: "all .6s ease" }}
            />
            {named && (
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="13"
                fontWeight={id === best ? 800 : 400}
                fill={id === best ? "#7BE05E" : "#fff"}
                fillOpacity={id === best ? 1 : 0.65}
              >
                {SKILLS[id].short}
              </text>
            )}
          </g>
        );
      })}
      <g className="navigator-needle" style={{ transform: `rotate(${needle}deg)`, transformOrigin: "200px 200px" }}>
        <path d={`M200 ${named ? 112 : 70} L212 200 L188 200 Z`} fill="#7BE05E" opacity={named ? 0 : 1} />
        <path d="M200 318 L212 200 L188 200 Z" fill="#fff" fillOpacity={named ? 0 : 0.25} />
        {named && <path d="M200 122 L210 200 L200 250 L190 200 Z" fill="#7BE05E" />}
      </g>
      <circle cx={CENTER} cy={CENTER} r="9" fill="#0B0D33" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}
