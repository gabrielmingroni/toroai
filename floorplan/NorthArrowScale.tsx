"use client";

/**
 * Standard architectural notation block: north arrow, scale bar, drawing title,
 * and key info. Placed bottom-right of the canvas.
 */
export function NorthArrowScale({
  scale, projectNumber, drawingTitle = "FLOOR 1 PLAN — ICT", sheetNumber = "ICT-001", scaleLabel = "1\" = 8'-0\"",
  rcdd = "J. TORRES · RCDD #12847", revision = "REV A",
}: {
  scale: number;
  projectNumber: string;
  drawingTitle?: string;
  sheetNumber?: string;
  scaleLabel?: string;
  rcdd?: string;
  revision?: string;
}) {
  // The block sits as a transformed group; canvas wrap places it via translation.
  // Block is rendered in grid units, then scaled.

  const W = 38, H = 22;   // grid units
  return (
    <g>
      <rect
        x={0} y={0} width={W * scale} height={H * scale}
        fill="white" stroke="#222" strokeWidth={1.2}
      />
      {/* Divider lines */}
      <line x1={0}            y1={6 * scale} x2={W * scale} y2={6 * scale}  stroke="#222" strokeWidth={0.6} />
      <line x1={0}            y1={12 * scale} x2={W * scale} y2={12 * scale} stroke="#222" strokeWidth={0.6} />
      <line x1={0}            y1={17 * scale} x2={W * scale} y2={17 * scale} stroke="#222" strokeWidth={0.6} />
      <line x1={9 * scale}    y1={0}          x2={9 * scale} y2={6 * scale}  stroke="#222" strokeWidth={0.6} />

      {/* North arrow (top-left cell) */}
      <g transform={`translate(${4.5 * scale}, ${3 * scale})`}>
        <circle cx={0} cy={0} r={2.4 * scale} fill="none" stroke="#222" strokeWidth={0.7} />
        <polygon
          points={`0,${-1.9 * scale} ${1 * scale},${1.3 * scale} 0,${0.5 * scale} ${-1 * scale},${1.3 * scale}`}
          fill="#222"
        />
        <text x={0} y={-2.6 * scale} textAnchor="middle" fontSize={6.5} fontWeight={700} fill="#222"
          style={{ fontFamily: "Inter, sans-serif" }}>N</text>
      </g>

      {/* Scale bar (top-right cell) */}
      <g transform={`translate(${10 * scale}, ${1.4 * scale})`}>
        <text x={0} y={1.4 * scale} fontSize={5.5} fill="#444"
          style={{ fontFamily: "JetBrains Mono, monospace" }}>SCALE  {scaleLabel}</text>
        {/* Bar */}
        <rect x={0} y={2.2 * scale} width={2 * scale} height={1.3 * scale} fill="#222" />
        <rect x={2 * scale} y={2.2 * scale} width={2 * scale} height={1.3 * scale} fill="white" stroke="#222" strokeWidth={0.4} />
        <rect x={4 * scale} y={2.2 * scale} width={2 * scale} height={1.3 * scale} fill="#222" />
        <rect x={6 * scale} y={2.2 * scale} width={2 * scale} height={1.3 * scale} fill="white" stroke="#222" strokeWidth={0.4} />
        <rect x={8 * scale} y={2.2 * scale} width={2 * scale} height={1.3 * scale} fill="#222" />
        {/* Tick labels */}
        {[0, 4, 8, 12, 16, 20].map((ft, i) => (
          <text key={i} x={(i * 2) * scale} y={(2.2 + 2.5) * scale} textAnchor="middle" fontSize={5} fill="#444"
            style={{ fontFamily: "JetBrains Mono, monospace" }}>
            {ft}{i === 5 ? " ft" : ""}
          </text>
        ))}
      </g>

      {/* Title row */}
      <text x={W * scale / 2} y={9 * scale} textAnchor="middle" fontSize={9} fontWeight={700} fill="#222"
        style={{ fontFamily: "Inter, sans-serif" }}>{drawingTitle}</text>

      {/* Project / RCDD row */}
      <text x={1 * scale} y={15 * scale} fontSize={6} fill="#444"
        style={{ fontFamily: "JetBrains Mono, monospace" }}>{projectNumber} · {revision}</text>
      <text x={1 * scale} y={(15 + 1.5) * scale} fontSize={5.5} fill="#444"
        style={{ fontFamily: "JetBrains Mono, monospace" }}>{rcdd}</text>

      {/* Sheet number (bottom row) */}
      <text x={W * scale / 2} y={20.6 * scale} textAnchor="middle" fontSize={16} fontWeight={800} fill="#1d4ed8"
        style={{ fontFamily: "Inter, sans-serif" }}>{sheetNumber}</text>
    </g>
  );
}
