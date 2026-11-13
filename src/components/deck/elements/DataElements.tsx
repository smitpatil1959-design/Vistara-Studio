import type { ChartContent, DiagramContent, ElementStyle, TableContent } from '../../../deck-spec';
import { diagramGeometry, readableText, tint } from '../../../deck-spec';
import { useRenderCtx } from './context';

export function ChartElement({ content, style = {} }: { content: ChartContent; style?: ElementStyle }) {
  const { theme } = useRenderCtx(), ink = style.color || theme.colors.text;
  const data = content.series.filter(point => Number.isFinite(point.value)).slice(0, 24);
  const palette = content.colors?.length ? content.colors : [theme.colors.accent, theme.colors.accent2, '#8BA17B', '#D8AF5F', '#6E8BC6', '#B984A9'];
  if (!data.length) return <div className="w-full h-full flex flex-col justify-center items-center gap-3 rounded-xl" style={{ color: ink, border: `1px dashed ${theme.colors.line}`, background: style.backgroundColor || theme.colors.surface }}><span className="text-base font-semibold">Your data, clearly told.</span><span className="text-sm opacity-65">Select this chart to add verified or user-provided data.</span></div>;
  const values = data.map(point => point.value), min = Math.min(0, ...values), max = Math.max(1, ...values), range = max - min;
  const y = (value: number) => 240 - (value - min) / range * 200;
  const points = data.map((point, index) => `${64 + index * (480 / Math.max(1, data.length - 1))},${y(point.value)}`).join(' ');
  const circular = content.chart === 'pie' || content.chart === 'donut', sum = data.reduce((total, point) => total + Math.max(0, point.value), 0) || 1;
  let cursor = -90;
  return <div className="w-full h-full rounded-xl overflow-hidden flex flex-col" style={{ background: style.backgroundColor || theme.colors.surface, color: ink, padding: 18 }}>
    <svg viewBox="0 0 600 290" className="w-full flex-1 min-h-0" role="img" aria-label={`${content.chart} chart: ${data.map(point => `${point.label} ${point.value}`).join(', ')}`}>
      {!circular && <><line x1="48" y1={y(0)} x2="566" y2={y(0)} stroke={ink} opacity="0.15" /><text x="42" y="30" fill={ink} opacity="0.65" fontSize="12" textAnchor="end">{max}</text><text x="42" y="244" fill={ink} opacity="0.65" fontSize="12" textAnchor="end">{min}</text></>}
      {circular ? data.map((point, index) => {
        const angle = Math.max(0, point.value) / sum * 360, start = cursor; cursor += angle;
        if (angle >= 359.99) return <circle key={index} cx="300" cy="138" r="104" fill={palette[index % palette.length]} />;
        const pointAt = (degrees: number) => `${300 + 104 * Math.cos(degrees * Math.PI / 180)} ${138 + 104 * Math.sin(degrees * Math.PI / 180)}`;
        return <path key={index} d={`M 300 138 L ${pointAt(start)} A 104 104 0 ${angle > 180 ? 1 : 0} 1 ${pointAt(cursor)} Z`} fill={palette[index % palette.length]} stroke={style.backgroundColor || theme.colors.surface} strokeWidth="3" />;
      }) : content.chart === 'line' || content.chart === 'area' ? <>
        {content.chart === 'area' && <polygon points={`64,${y(0)} ${points} 544,${y(0)}`} fill={palette[0]} opacity="0.16" />}
        <polyline points={points} fill="none" stroke={palette[0]} strokeWidth="4" strokeLinejoin="round" />
        {data.map((point, index) => <g key={index}><circle cx={64 + index * (480 / Math.max(1, data.length - 1))} cy={y(point.value)} r="5" fill={palette[0]} />{content.showValues !== false && <text x={64 + index * (480 / Math.max(1, data.length - 1))} y={y(point.value) - 12} textAnchor="middle" fill={ink} fontSize="13">{point.value}</text>}<text x={64 + index * (480 / Math.max(1, data.length - 1))} y="271" textAnchor="middle" fill={ink} fontSize="11">{point.label.slice(0, 15)}</text></g>)}
      </> : content.chart === 'progress' ? data.map((point, index) => {
        const rowHeight = 230 / data.length, top = 20 + index * rowHeight, barHeight = Math.max(4, rowHeight * 0.33);
        return <g key={index}><text x="60" y={top + 12} fill={ink} fontSize="12">{point.label}</text><text x="550" y={top + 12} fill={ink} textAnchor="end" fontSize="12">{point.value}</text><rect x="60" y={top + 20} width="490" height={barHeight} rx="3" fill={ink} opacity="0.08" /><rect x="60" y={top + 20} width={Math.abs(point.value) / Math.max(1, ...values.map(Math.abs)) * 490} height={barHeight} rx="3" fill={palette[index % palette.length]} /></g>;
      }) : data.map((point, index) => {
        const width = 480 / data.length, x = 64 + index * width;
        return <g key={index}><rect x={x + 7} y={Math.min(y(0), y(point.value))} width={Math.max(4, width - 14)} height={Math.max(2, Math.abs(y(0) - y(point.value)))} rx="5" fill={palette[index % palette.length]} />{content.showValues !== false && <text x={x + width / 2} y={point.value >= 0 ? y(point.value) - 9 : y(point.value) + 16} textAnchor="middle" fill={ink} fontSize="13">{point.value}</text>}<text x={x + width / 2} y="271" textAnchor="middle" fill={ink} fontSize="11">{point.label.slice(0, 15)}</text></g>;
      })}
      {content.chart === 'donut' && <circle cx="300" cy="138" r="65" fill={style.backgroundColor || theme.colors.surface} />}
    </svg>
    {content.legend !== false && circular && <div className="flex justify-center flex-wrap gap-x-5 gap-y-1.5 text-xs">{data.map((point, index) => <span key={index} className="inline-flex items-center gap-2"><i className="w-2 h-2 rounded-full" style={{ background: palette[index % palette.length] }} />{point.label} · {point.value}</span>)}</div>}
    {content.axisLabel && <p className="text-center text-xs opacity-65">{content.axisLabel}</p>}
  </div>;
}

export function TableElement({ content, style = {} }: { content: TableContent; style?: ElementStyle }) {
  const { theme } = useRenderCtx(), ink = style.color || theme.colors.text;
  const columns = Math.max(1, ...content.rows.map(row => row.length));
  return <div className="w-full h-full overflow-hidden" style={{ borderRadius: style.radius ?? 12, border: `1px solid ${style.borderColor || theme.colors.line}` }}><table className="w-full h-full border-collapse table-fixed" style={{ color: ink, fontSize: style.fontSize || 17 }}><tbody>{content.rows.map((row, index) => <tr key={index} style={{ background: index === 0 && content.headerRow ? theme.colors.accent : index % 2 ? style.backgroundColor || theme.colors.surface : theme.colors.surfaceAlt, color: index === 0 && content.headerRow ? readableText(theme.colors.accent) : ink }}>{Array.from({ length: columns }, (_, cell) => <td key={cell} style={{ padding: 14, borderBottom: `1px solid ${theme.colors.line}`, fontWeight: index === 0 && content.headerRow ? 650 : 400, overflowWrap: 'anywhere' }}>{row[cell] || ''}</td>)}</tr>)}</tbody></table></div>;
}

export function DiagramElement({ content, style = {}, size }: { content: DiagramContent; style?: ElementStyle; size: { w: number | string; h: number | string } }) {
  const { theme } = useRenderCtx(), width = typeof size.w === 'number' ? size.w : 800, height = typeof size.h === 'number' ? size.h : 220;
  const nodes = diagramGeometry(content, width, height), ink = style.color || theme.colors.text, bg = style.backgroundColor || theme.colors.surface;
  return <div className="relative w-full h-full">
    <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} aria-hidden><defs><marker id={`arrow-${content.nodes[0]?.id}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill={theme.colors.accent} /></marker></defs>{content.edges.map((edge, index) => { const from = nodes.find(node => node.id === edge.from), to = nodes.find(node => node.id === edge.to); if (!from || !to) return null; return <line key={index} x1={from.x + from.w} y1={from.y + from.h / 2} x2={to.x - 4} y2={to.y + to.h / 2} stroke={theme.colors.accent} strokeWidth="2" markerEnd={`url(#arrow-${content.nodes[0]?.id})`} />; })}</svg>
    {nodes.map((node, index) => <div key={node.id} className="absolute flex flex-col justify-center overflow-hidden" style={{ left: node.x, top: node.y, width: node.w, height: node.h, padding: 22, borderRadius: style.radius ?? 16, background: bg, border: `1px solid ${style.borderColor || theme.colors.line}`, color: ink }}><span style={{ color: theme.colors.accent, fontSize: 12, fontWeight: 650, marginBottom: 16 }}>{content.layout === 'timeline' ? '•' : String(index + 1).padStart(2, '0')}</span><strong className="line-clamp-3" style={{ fontSize: style.fontSize || 20, lineHeight: 1.2 }}>{node.label}</strong>{node.detail && <p className="mt-3 line-clamp-4" style={{ fontSize: 14, lineHeight: 1.5, color: tint(ink, bg, 0.2) }}>{node.detail}</p>}</div>)}
  </div>;
}
