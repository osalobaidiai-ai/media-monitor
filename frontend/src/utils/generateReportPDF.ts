/**
 * generateReportPDF — Professional Arabic PDF Report Generator
 * ──────────────────────────────────────────────────────────────────────
 * Strategy: html2canvas + jsPDF
 *
 * The browser shapes Arabic text correctly (HarfBuzz / CoreText),
 * html2canvas captures it at 2.5× for sharp output, jsPDF assembles
 * multi-page A4 PDF.
 * ──────────────────────────────────────────────────────────────────────
 */

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { ReportResponse, Stats } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────
const PW       = 794   // A4 width  at 96 dpi (pixels)
const PH       = 1123  // A4 height at 96 dpi (pixels)
const SCALE    = 2.5   // html2canvas scale → ~240 dpi effective
const PH_SCALED = PH * SCALE

// ── Colour palette (Saudi government professional) ─────────────────────────────
const C = {
  navy:       '#0d1b2e',
  navyMid:    '#1a3057',
  primary:    '#1e3a8a',
  green:      '#00573F',
  greenLight: '#00875f',
  gold:       '#C9A84C',
  goldLight:  '#e8c97a',
  accent:     '#0ea5e9',
  accentDark: '#0284c7',
  pos:        '#16a34a',
  neg:        '#dc2626',
  neut:       '#64748b',
  crs:        '#ea580c',
  purple:     '#7c3aed',
  amber:      '#d97706',
  teal:       '#0d9488',
  bg:         '#f8fafc',
  bgAlt:      '#f0f4f8',
  white:      '#ffffff',
  txt:        '#1e293b',
  muted:      '#475569',
  border:     '#e2e8f0',
  borderDark: '#cbd5e1',
}

const F = "'Cairo', 'Segoe UI', Arial, sans-serif"

// ── Labels ────────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  overview: 'شامل', crisis: 'أزمات', sentiment: 'مشاعر', sources: 'مصادر',
}
const SENT_LABELS: Record<string, string> = {
  positive: 'إيجابي', negative: 'سلبي', neutral: 'محايد',
}
const SENT_COLORS: Record<string, string> = {
  positive: C.pos, negative: C.neg, neutral: C.neut,
}
const CRISIS_COLORS: Record<string, string> = {
  security:       C.neg,
  political:      C.purple,
  economic:       C.amber,
  health:         C.greenLight,
  natural:        C.teal,
  direct_mention: C.crs,
  participants:   C.accent,
  topics_sessions:'#8b5cf6',
}
const CRISIS_LABELS: Record<string, string> = {
  direct_mention:  'ذكر مباشر',
  participants:    'شخصيات',
  topics_sessions: 'جلسات ومحاور',
  security:        'أمني',
  political:       'سياسي',
  economic:        'اقتصادي',
  health:          'صحي',
  natural:         'طبيعي',
}

// ── Logo SVG (radar / monitoring emblem) ──────────────────────────────────────
const LOGO_SVG = `
  <svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22" cy="22" r="21" fill="none" stroke="${C.gold}" stroke-width="1.5"/>
    <circle cx="22" cy="22" r="17" fill="${C.navyMid}"/>
    <circle cx="22" cy="22" r="7.5" fill="none" stroke="${C.gold}" stroke-width="1.8"/>
    <circle cx="22" cy="22" r="3" fill="${C.gold}"/>
    <line x1="22" y1="8"  x2="22" y2="13" stroke="${C.goldLight}" stroke-width="1.4" stroke-linecap="round"/>
    <line x1="22" y1="31" x2="22" y2="36" stroke="${C.goldLight}" stroke-width="1.4" stroke-linecap="round"/>
    <line x1="8"  y1="22" x2="13" y2="22" stroke="${C.goldLight}" stroke-width="1.4" stroke-linecap="round"/>
    <line x1="31" y1="22" x2="36" y2="22" stroke="${C.goldLight}" stroke-width="1.4" stroke-linecap="round"/>
    <line x1="11.5" y1="11.5" x2="15" y2="15" stroke="${C.goldLight}" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
    <line x1="29"   y1="29"   x2="32.5" y2="32.5" stroke="${C.goldLight}" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
    <line x1="32.5" y1="11.5" x2="29"   y2="15"   stroke="${C.goldLight}" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
    <line x1="15"   y1="29"   x2="11.5" y2="32.5" stroke="${C.goldLight}" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
  </svg>`

// ── KPI icon SVGs ─────────────────────────────────────────────────────────────
function kpiIconSVG(type: 'articles' | 'crisis' | 'rate' | 'sources', color: string): string {
  const icons: Record<string, string> = {
    articles: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="12" height="12" rx="2" stroke="${color}" stroke-width="1.5"/>
      <line x1="5" y1="5.5" x2="11" y2="5.5" stroke="${color}" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="5" y1="8"   x2="11" y2="8"   stroke="${color}" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="5" y1="10.5" x2="8.5" y2="10.5" stroke="${color}" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,
    crisis: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2L14 13H2L8 2Z" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
      <line x1="8" y1="6.5" x2="8" y2="9.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="8" cy="11.5" r="0.8" fill="${color}"/>
    </svg>`,
    rate: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="${color}" stroke-width="1.5"/>
      <path d="M8 8 L8 4" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 8 L11 10" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    sources: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8"  cy="8"  r="3"   stroke="${color}" stroke-width="1.5"/>
      <circle cx="8"  cy="8"  r="6.5" stroke="${color}" stroke-width="1" stroke-dasharray="2 2"/>
      <line x1="2" y1="8" x2="5"  y2="8"  stroke="${color}" stroke-width="1" stroke-linecap="round" opacity="0.6"/>
      <line x1="11" y1="8" x2="14" y2="8" stroke="${color}" stroke-width="1" stroke-linecap="round" opacity="0.6"/>
    </svg>`,
  }
  return icons[type] ?? ''
}

// ── Page wrappers ─────────────────────────────────────────────────────────────
const pageWrap = (inner: string) => `
  <div style="
    font-family:${F}; direction:rtl; background:${C.white};
    width:${PW}px; height:${PH}px; overflow:hidden;
    box-sizing:border-box; color:${C.txt};
    display:flex; flex-direction:column;
  ">${inner}</div>
`
const contentWrap = (inner: string) => `
  <div style="
    font-family:${F}; direction:rtl; background:${C.white};
    width:${PW}px; box-sizing:border-box; color:${C.txt};
    display:flex; flex-direction:column;
  ">${inner}</div>
`

// ── Header ─────────────────────────────────────────────────────────────────────
function blockHeader(reportType: string, genDate: string): string {
  const typeLabel = TYPE_LABELS[reportType] ?? reportType
  const dateStr   = new Date(genDate).toLocaleDateString('ar-SA', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return `
    <div style="
      background:${C.navy};
      flex-shrink:0; overflow:hidden; position:relative;
    ">
      <!-- Diagonal stripe overlay -->
      <div style="
        position:absolute; top:0; left:0; right:0; bottom:0; opacity:0.04;
        background:repeating-linear-gradient(
          -45deg, transparent, transparent 8px,
          rgba(255,255,255,1) 8px, rgba(255,255,255,1) 9px
        );
        pointer-events:none;
      "></div>

      <!-- Top accent strip -->
      <div style="height:4px; background:${C.gold};"></div>

      <div style="
        padding:12px 28px;
        display:flex; align-items:center; justify-content:space-between;
        direction:ltr; position:relative; z-index:1;
      ">
        <!-- Left: Date + Classification -->
        <div style="display:flex; flex-direction:column; gap:5px; align-items:flex-start; min-width:160px;">
          <div style="
            background:${C.gold}; color:${C.navy}; padding:3px 12px;
            border-radius:3px; font-size:9px; font-weight:bold;
            font-family:${F}; letter-spacing:0.5px; direction:rtl;
          ">للاستخدام الرسمي الداخلي</div>
          <div style="
            color:rgba(255,255,255,0.65); font-size:8.5px; font-family:${F};
            direction:rtl;
          ">${dateStr}</div>
        </div>

        <!-- Center: System title -->
        <div style="text-align:center; direction:rtl; flex:1; padding:0 16px;">
          <div style="
            color:${C.white}; font-size:18px; font-weight:bold;
            font-family:${F}; line-height:1.3; letter-spacing:0.3px;
          ">منظومة رصد الإعلام الذكي</div>
          <div style="
            color:${C.goldLight}; font-size:9px; margin-top:4px;
            font-family:${F}; letter-spacing:0.5px;
          ">Smart Media Monitoring System &nbsp;·&nbsp; المملكة العربية السعودية</div>
        </div>

        <!-- Right: Logo + Report type -->
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px; min-width:160px;">
          <div style="display:flex; align-items:center; gap:8px;">
            ${LOGO_SVG}
          </div>
          <div style="
            background:${C.accent}; color:${C.white}; padding:3px 12px;
            border-radius:3px; font-size:9px; font-weight:bold;
            font-family:${F}; direction:rtl;
          ">تقرير ${typeLabel}</div>
        </div>
      </div>

      <!-- Bottom tri-color accent bar -->
      <div style="height:3px; background:${C.gold}; opacity:0.25;"></div>
      <div style="height:3px; background:${C.accent};"></div>
    </div>
  `
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function blockFooter(genDate: string, pageNum: number): string {
  const d = new Date(genDate).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  return `
    <div style="
      border-top:2px solid ${C.border};
      padding:7px 28px;
      display:flex; justify-content:space-between; align-items:center;
      direction:ltr; flex-shrink:0; background:${C.bg};
    ">
      <div style="display:flex; align-items:center; gap:5px;">
        <div style="
          background:${C.primary}; color:${C.white}; font-size:8px;
          font-weight:bold; font-family:${F}; padding:2px 8px;
          border-radius:3px; direction:ltr;
        ">صفحة ${pageNum}</div>
      </div>
      <span style="color:${C.muted}; font-size:8px; font-family:${F}; text-align:center;">
        منظومة رصد الإعلام الذكي &nbsp;·&nbsp; النسخة الثالثة &nbsp;·&nbsp; جميع الحقوق محفوظة
      </span>
      <span style="color:${C.muted}; font-size:8px; font-family:${F}; direction:rtl;">
        ${d}
      </span>
    </div>
  `
}

// ── Section title ──────────────────────────────────────────────────────────────
function secTitle(text: string): string {
  return `
    <div style="
      display:flex; align-items:center; gap:10px; direction:rtl;
      margin-top:16px; margin-bottom:10px;
    ">
      <div style="
        width:4px; height:20px;
        background:${C.accent};
        border-radius:2px; flex-shrink:0;
      "></div>
      <div style="
        font-size:13px; font-weight:bold; color:${C.primary};
        font-family:${F}; flex:1;
      ">${text}</div>
    </div>
    <div style="
      height:1px;
      background:${C.border};
      margin-bottom:12px;
    "></div>
  `
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function kpiBox(
  val: string,
  label: string,
  color: string,
  iconType: 'articles' | 'crisis' | 'rate' | 'sources',
): string {
  return `
    <div style="
      flex:1; background:${C.white}; border-radius:10px; padding:14px 12px;
      border:1px solid ${C.border};
      box-shadow:0 2px 8px rgba(0,0,0,0.06);
      display:flex; flex-direction:column; gap:6px;
      position:relative; overflow:hidden; direction:rtl;
    ">
      <!-- Accent bottom bar -->
      <div style="
        position:absolute; bottom:0; right:0; left:0; height:3px;
        background:${color}; border-radius:0 0 10px 10px;
      "></div>
      <!-- Icon -->
      <div style="
        width:30px; height:30px; background:${color}18;
        border-radius:8px; display:flex; align-items:center;
        justify-content:center; flex-shrink:0;
      ">
        ${kpiIconSVG(iconType, color)}
      </div>
      <!-- Value -->
      <div style="
        font-size:22px; font-weight:bold; color:${color};
        font-family:${F}; direction:ltr; line-height:1; margin-top:2px;
      ">${val}</div>
      <!-- Label -->
      <div style="
        font-size:9.5px; color:${C.muted}; font-family:${F};
        line-height:1.4; padding-bottom:4px;
      ">${label}</div>
    </div>
  `
}

// ── SVG Donut pie chart ────────────────────────────────────────────────────────
function svgPieChart(
  data: Array<{ label: string; value: number; color: string }>
): string {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return `
    <div style="color:${C.muted};font-size:11px;font-family:${F};
                text-align:center;padding:20px;">لا توجد بيانات</div>`

  const cx = 80, cy = 80, r = 68, ir = 34
  let angle = -Math.PI / 2

  const paths = data.filter(d => d.value > 0).map(d => {
    const sweep = (d.value / total) * 2 * Math.PI
    const x1  = cx + r * Math.cos(angle),    y1  = cy + r * Math.sin(angle)
    const ix1 = cx + ir * Math.cos(angle),   iy1 = cy + ir * Math.sin(angle)
    angle += sweep
    const x2  = cx + r * Math.cos(angle),    y2  = cy + r * Math.sin(angle)
    const ix2 = cx + ir * Math.cos(angle),   iy2 = cy + ir * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    const path = [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
      `A ${ir} ${ir} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
      'Z',
    ].join(' ')
    return `<path d="${path}" fill="${d.color}" stroke="white" stroke-width="2.5"/>`
  }).join('\n')

  const legend = data.map(d => {
    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;direction:rtl;">
        <div style="
          width:13px;height:13px;background:${d.color};
          border-radius:4px;flex-shrink:0;
        "></div>
        <div style="flex:1;font-size:10.5px;font-family:${F};color:${C.txt};">${d.label}</div>
        <div style="font-size:10px;font-weight:bold;color:${d.color};font-family:${F};min-width:32px;text-align:left;direction:ltr;">${pct}%</div>
        <div style="font-size:9.5px;color:${C.muted};font-family:${F};min-width:44px;text-align:left;direction:ltr;">${d.value.toLocaleString()}</div>
      </div>`
  }).join('')

  return `
    <div style="display:flex;align-items:center;gap:20px;direction:rtl;padding:4px 0;">
      <div style="flex-shrink:0;">
        <svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${cx}" cy="${cy}" r="${r+5}" fill="${C.bg}"/>
          ${paths}
          <circle cx="${cx}" cy="${cy}" r="${ir-2}" fill="white"/>
          <text x="${cx}" y="${cy-5}"  text-anchor="middle" font-size="12" font-weight="bold" fill="${C.txt}" font-family="Cairo,Arial">${total.toLocaleString()}</text>
          <text x="${cx}" y="${cy+12}" text-anchor="middle" font-size="8.5" fill="${C.muted}" font-family="Cairo,Arial">إجمالي المقالات</text>
        </svg>
      </div>
      <div style="flex:1;">${legend}</div>
    </div>
  `
}

// ── Styled horizontal bar ──────────────────────────────────────────────────────
function hBar(label: string, value: number, max: number, color: string, rowIndex = 0): string {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const bg  = rowIndex % 2 === 1 ? C.bg : C.white
  return `
    <div style="
      display:flex; align-items:center; gap:8px; padding:7px 8px;
      background:${bg}; border-radius:6px; margin-bottom:3px; direction:rtl;
    ">
      <span style="
        width:130px; font-size:10.5px; flex-shrink:0;
        font-family:${F}; text-align:right; color:${C.txt};
      ">${label}</span>
      <div style="
        flex:1; background:${C.border}; border-radius:8px; height:15px;
        overflow:hidden; direction:ltr;
      ">
        <div style="
          width:${pct}%; height:100%; background:${color};
          border-radius:8px;
        "></div>
      </div>
      <div style="
        width:95px; display:flex; gap:4px; align-items:center;
        flex-shrink:0; direction:ltr; justify-content:flex-end;
      ">
        <span style="font-size:10px;font-weight:bold;color:${color};font-family:${F};">
          ${value.toLocaleString()}
        </span>
        <span style="font-size:9px;color:${C.muted};font-family:${F};">(${pct}%)</span>
      </div>
    </div>
  `
}

// ── Hourly activity chart ──────────────────────────────────────────────────────
function activityChart(data: Array<{ hour: string; count: number }>): string {
  const max  = Math.max(...data.map(h => h.count), 1)
  const bars = data.map(h => {
    const r     = h.count / max
    const col   = r > 0.7 ? C.neg : r > 0.4 ? C.crs : C.accent
    const hPct  = Math.max(4, r * 100)
    return `<div style="flex:1;height:${hPct}%;background:${col};border-radius:3px 3px 0 0;margin:0 0.5px;min-height:4px;"></div>`
  }).join('')

  const tickIdxs = [0, Math.floor(data.length / 4), Math.floor(data.length / 2),
    Math.floor(data.length * 3 / 4), data.length - 1]
  const ticks = tickIdxs.map(i => {
    const h = data[i]
    if (!h) return ''
    const lbl = h.hour.includes('T') ? h.hour.split('T')[1].slice(0, 5) : h.hour.slice(-5)
    return `<span style="font-size:8px;color:${C.muted};font-family:${F};">${lbl}</span>`
  }).join('')

  const legend = [
    { c: C.accent, l: 'منخفض' }, { c: C.crs, l: 'متوسط' }, { c: C.neg, l: 'مرتفع' },
  ].map(x => `
    <div style="display:flex;align-items:center;gap:5px;">
      <div style="width:10px;height:7px;background:${x.c};border-radius:2px;flex-shrink:0;"></div>
      <span style="font-size:9px;color:${C.muted};font-family:${F};">${x.l}</span>
    </div>`).join('')

  return `
    <div style="
      background:${C.bg}; border-radius:8px; padding:14px;
      border:1px solid ${C.border};
    ">
      <div style="
        height:90px; display:flex; align-items:flex-end;
        border-bottom:1px solid ${C.borderDark}; direction:ltr; padding-bottom:2px;
      ">${bars}</div>
      <div style="display:flex;justify-content:space-between;margin-top:5px;direction:ltr;">
        ${ticks}
      </div>
      <div style="display:flex;gap:14px;margin-top:8px;justify-content:flex-end;direction:rtl;">
        ${legend}
      </div>
    </div>
  `
}

// ── Sources table ──────────────────────────────────────────────────────────────
function sourcesTable(sources: Array<{ name: string; count: number }>): string {
  const total    = sources.reduce((s, x) => s + x.count, 0)
  const maxCount = Math.max(...sources.map(s => s.count), 1)

  const RANK_COLORS = [C.gold, '#94a3b8', '#CD7F32']  // gold / silver / bronze

  const rows = sources.map((src, i) => {
    const pct  = total > 0 ? ((src.count / total) * 100).toFixed(1) : '0'
    const barW = Math.round((src.count / maxCount) * 100)
    const bg   = i % 2 === 1 ? `background:${C.bg};` : `background:${C.white};`
    const rankColor = i < 3 ? RANK_COLORS[i] : C.muted

    const rankBadge = i < 3
      ? `<div style="
            width:22px;height:22px;border-radius:50%;
            background:${rankColor};display:flex;align-items:center;justify-content:center;
          ">
            <span style="color:white;font-size:9px;font-weight:bold;font-family:${F};direction:ltr;">${i+1}</span>
          </div>`
      : `<span style="color:${C.muted};font-size:10px;font-family:${F};direction:ltr;">${i+1}</span>`

    return `
      <div style="
        display:flex; align-items:center; padding:8px 14px;
        border-bottom:1px solid ${C.border}; ${bg} direction:rtl;
      ">
        <div style="width:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
          ${rankBadge}
        </div>
        <span style="flex:3;font-size:11px;padding-right:10px;font-family:${F};color:${C.txt};">
          ${src.name}
        </span>
        <div style="flex:3;padding:0 10px;">
          <div style="background:${C.border};border-radius:6px;height:9px;overflow:hidden;direction:ltr;">
            <div style="width:${barW}%;height:100%;background:${C.accent};border-radius:6px;"></div>
          </div>
        </div>
        <span style="flex:1;font-size:11px;font-weight:bold;text-align:center;direction:ltr;font-family:${F};color:${C.primary};">
          ${src.count.toLocaleString()}
        </span>
        <span style="width:45px;font-size:10px;color:${C.muted};text-align:center;direction:ltr;font-family:${F};flex-shrink:0;">
          ${pct}%
        </span>
      </div>`
  }).join('')

  return `
    <div style="border:1px solid ${C.border};border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
      <!-- Table header -->
      <div style="display:flex;align-items:center;padding:9px 14px;background:${C.navy};direction:rtl;">
        <span style="width:28px;color:${C.goldLight};font-size:9.5px;font-weight:bold;flex-shrink:0;text-align:center;font-family:${F};">#</span>
        <span style="flex:3;color:${C.white};font-size:9.5px;font-weight:bold;padding-right:10px;font-family:${F};">المصدر الإخباري</span>
        <span style="flex:3;color:${C.white};font-size:9.5px;font-weight:bold;padding:0 10px;font-family:${F};">الحجم النسبي</span>
        <span style="flex:1;color:${C.white};font-size:9.5px;font-weight:bold;text-align:center;font-family:${F};">المقالات</span>
        <span style="width:45px;color:${C.white};font-size:9.5px;font-weight:bold;text-align:center;font-family:${F};">النسبة</span>
      </div>
      ${rows}
    </div>
  `
}

// ── Markdown → HTML ────────────────────────────────────────────────────────────
function markdownToHTML(content: string): string {
  return content.split('\n').map(line => {
    const esc = (s: string) =>
      s.replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.txt};">$1</strong>`)
    if (line.startsWith('# '))
      return `
        <div style="
          display:flex;align-items:center;gap:10px;direction:rtl;
          font-size:15px;font-weight:bold;color:${C.primary};
          margin:18px 0 8px;padding-bottom:6px;
          border-bottom:2px solid ${C.accent};font-family:${F};
        ">
          <div style="width:4px;height:18px;background:${C.accent};border-radius:2px;flex-shrink:0;"></div>
          ${esc(line.slice(2))}
        </div>`
    if (line.startsWith('## '))
      return `<div style="
        font-size:13px;font-weight:bold;color:${C.navyMid};
        margin:12px 0 6px;font-family:${F};padding-right:10px;
        border-right:3px solid ${C.gold};
      ">${esc(line.slice(3))}</div>`
    if (line.startsWith('### '))
      return `<div style="font-size:12px;font-weight:bold;color:${C.txt};margin:8px 0 4px;font-family:${F};">
        ${esc(line.slice(4))}</div>`
    if (line.startsWith('---'))
      return `<hr style="border:none;border-top:1px solid ${C.border};margin:12px 0;">`
    if (line.trim() === '')
      return '<div style="height:5px;"></div>'
    if (line.startsWith('- '))
      return `
        <div style="display:flex;gap:8px;margin-bottom:5px;direction:rtl;align-items:flex-start;padding-right:4px;">
          <div style="width:6px;height:6px;background:${C.accent};border-radius:50%;flex-shrink:0;margin-top:6px;"></div>
          <span style="flex:1;font-size:11px;line-height:1.8;font-family:${F};color:${C.txt};">
            ${esc(line.slice(2))}
          </span>
        </div>`
    return `<p style="font-size:11px;line-height:1.8;margin-bottom:5px;font-family:${F};color:${C.txt};">
      ${esc(line)}</p>`
  }).join('')
}

// ── Page 1: Title + KPIs + Sentiment Pie + Crisis Bars ────────────────────────
function buildPage1(report: ReportResponse, stats: Stats | null): string {
  const sentDist  = stats?.sentiment_distribution ?? {}
  const sentTotal = Object.values(sentDist).reduce((a, b) => a + b, 0)

  const crisisEntries = stats
    ? Object.entries(stats.crisis_types).sort((a, b) => b[1] - a[1]).slice(0, 6)
    : []
  const crisisMax = crisisEntries.length ? Math.max(...crisisEntries.map(e => e[1])) : 1

  const metaLine = [
    `صدر بتاريخ: ${new Date(report.generated_at).toLocaleString('ar-SA', { dateStyle: 'long', timeStyle: 'short' })}`,
    `الفترة: آخر ${report.data_period_hours} ساعة`,
    `النموذج: ${report.model_used === 'rule-based' ? 'التحليل الآلي' : 'Claude AI'}`,
  ].join('   ·   ')

  const pieData = (['positive', 'negative', 'neutral'] as const)
    .filter(k => (sentDist[k] ?? 0) > 0)
    .map(k => ({ label: SENT_LABELS[k], value: sentDist[k] ?? 0, color: SENT_COLORS[k] }))

  const crisisBarsHTML = crisisEntries
    .map(([type, count], i) =>
      hBar(CRISIS_LABELS[type] ?? type, count, crisisMax, CRISIS_COLORS[type] ?? C.accent, i)
    ).join('')

  const inner = `
    ${blockHeader(report.report_type, report.generated_at)}

    <div style="flex:1; padding:14px 28px 8px; overflow:hidden; display:flex; flex-direction:column;">

      <!-- Title card -->
      <div style="
        background:${C.bg}; border-radius:10px; padding:12px 16px;
        margin-bottom:14px; border:1px solid ${C.border};
        border-right:4px solid ${C.accent}; direction:rtl;
      ">
        <div style="font-size:16px;font-weight:bold;color:${C.primary};margin-bottom:5px;font-family:${F};line-height:1.4;">
          ${report.title}
        </div>
        <div style="color:${C.muted};font-size:9px;font-family:${F};direction:rtl;line-height:1.6;">
          ${metaLine}
        </div>
      </div>

      <!-- KPI row -->
      <div style="display:flex;gap:10px;margin-bottom:14px;direction:ltr;">
        ${kpiBox(report.total_articles.toLocaleString(), 'إجمالي المقالات المرصودة', C.accent, 'articles')}
        ${kpiBox((stats?.crisis_articles ?? 0).toLocaleString(), 'مقالات بمؤشرات أزمة', C.neg, 'crisis')}
        ${kpiBox((stats?.crisis_rate ?? 0) + '%', 'معدل الأزمات الإعلامية', C.crs, 'rate')}
        ${kpiBox((stats?.top_sources?.length ?? 0).toString(), 'مصادر إخبارية نشطة', C.pos, 'sources')}
      </div>

      <!-- Two columns: Pie + Crisis bars -->
      <div style="display:flex;gap:16px;flex:1;overflow:hidden;align-items:flex-start;">

        ${sentTotal > 0 ? `
          <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
            ${secTitle('توزيع المشاعر الإعلامية')}
            ${svgPieChart(pieData)}
          </div>
        ` : ''}

        ${crisisEntries.length > 0 ? `
          <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
            ${secTitle('محاور التغطية الإعلامية')}
            ${crisisBarsHTML}
          </div>
        ` : ''}

      </div>
    </div>

    ${blockFooter(report.generated_at, 1)}
  `
  return pageWrap(inner)
}

// ── Page 2: Hourly Activity + Sources Table ────────────────────────────────────
function buildPage2(report: ReportResponse, stats: Stats): string {
  const hourlyData = stats.hourly_data ?? []
  const topSources = stats.top_sources?.slice(0, 10) ?? []

  const inner = `
    ${blockHeader(report.report_type, report.generated_at)}

    <div style="flex:1; padding:14px 28px 8px; overflow:hidden; display:flex; flex-direction:column;">

      ${hourlyData.length > 0 ? `
        ${secTitle('النشاط الزمني للتغطية الإخبارية')}
        <div style="font-size:9px;color:${C.muted};margin-bottom:8px;font-family:${F};direction:rtl;">
          توزيع التغطية الإخبارية خلال آخر ${hourlyData.length} فترة زمنية
        </div>
        ${activityChart(hourlyData)}
      ` : ''}

      ${topSources.length > 0 ? `
        ${secTitle('أكثر المصادر الإخبارية نشاطاً')}
        ${sourcesTable(topSources)}
      ` : ''}

      <!-- Disclaimer -->
      <div style="
        margin-top:auto; padding:10px 14px;
        background:#fef9c3; border-radius:8px;
        border:1px solid #fde047; border-right:4px solid #ca8a04; direction:rtl;
      ">
        <div style="font-size:8.5px;color:#713f12;font-family:${F};line-height:1.7;">
          <strong>تنويه:</strong> هذا التقرير مولَّد آلياً بواسطة نظام رصد الإعلام الذكي.
          البيانات الواردة تعكس المحتوى المرصود خلال الفترة المحددة فقط.
          يُرجى التحقق من المصادر الأصلية عند الاستشهاد بهذه البيانات.
          هذا التقرير للاستخدام الرسمي الداخلي فقط.
        </div>
      </div>

    </div>

    ${blockFooter(report.generated_at, 2)}
  `
  return pageWrap(inner)
}

// ── Page 3+: AI Report Content ─────────────────────────────────────────────────
function buildPage3(report: ReportResponse, hasPrevPages: boolean): string {
  const pageNum = hasPrevPages ? 3 : 2
  const inner = `
    ${blockHeader(report.report_type, report.generated_at)}
    <div style="padding:18px 28px 20px; flex:1; direction:rtl;">
      ${secTitle('محتوى التقرير التحليلي')}
      <div style="direction:rtl; font-family:${F}; line-height:1.7;">
        ${markdownToHTML(report.content)}
      </div>
    </div>
    ${blockFooter(report.generated_at, pageNum)}
  `
  return contentWrap(inner)
}

// ── html2canvas capture helpers ────────────────────────────────────────────────
async function captureFixed(el: HTMLElement): Promise<string> {
  const canvas = await html2canvas(el, {
    scale: SCALE,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    width: PW,
    windowWidth: PW,
    logging: false,
  })
  return canvas.toDataURL('image/jpeg', 0.94)
}

/**
 * Capture a variable-height element and split into A4-sized PDF pages.
 * Each chunk is padded to full A4 height with white.
 */
async function captureAndPaginate(
  pdf: jsPDF,
  el: HTMLElement,
  addNewPageFirst: boolean,
): Promise<void> {
  const canvas = await html2canvas(el, {
    scale: SCALE,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    width: PW,
    windowWidth: PW,
    logging: false,
  })

  let yOffset = 0
  let isFirst = true

  while (yOffset < canvas.height) {
    const chunkH = Math.min(PH_SCALED, canvas.height - yOffset)
    const chunk  = document.createElement('canvas')
    chunk.width  = canvas.width
    chunk.height = PH_SCALED

    const ctx = chunk.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, chunk.width, chunk.height)
    ctx.drawImage(canvas, 0, yOffset, canvas.width, chunkH, 0, 0, canvas.width, chunkH)

    if (addNewPageFirst || !isFirst) pdf.addPage()
    pdf.addImage(chunk.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297)

    yOffset        += PH_SCALED
    isFirst         = false
    addNewPageFirst = false
  }
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function generateReportPDF(
  report: ReportResponse,
  stats:  Stats | null,
): Promise<void> {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;top:-99999px;left:0;z-index:-9999;'

  const p1 = document.createElement('div')
  p1.innerHTML = buildPage1(report, stats)

  const p2 = stats ? document.createElement('div') : null
  if (p2 && stats) p2.innerHTML = buildPage2(report, stats)

  const p3 = document.createElement('div')
  p3.innerHTML = buildPage3(report, !!stats)

  container.appendChild(p1)
  if (p2) container.appendChild(p2)
  container.appendChild(p3)
  document.body.appendChild(container)

  // Wait for Cairo font and layout
  await document.fonts.ready
  await new Promise<void>(r => setTimeout(r, 300))

  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    // Page 1 — fixed A4
    const img1 = await captureFixed(p1.firstElementChild as HTMLElement)
    pdf.addImage(img1, 'JPEG', 0, 0, 210, 297)

    // Page 2 — fixed A4
    if (p2) {
      pdf.addPage()
      const img2 = await captureFixed(p2.firstElementChild as HTMLElement)
      pdf.addImage(img2, 'JPEG', 0, 0, 210, 297)
    }

    // Page 3+ — variable height, auto-paginate
    await captureAndPaginate(pdf, p3.firstElementChild as HTMLElement, true)

    const filename = `تقرير-${report.report_type}-${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(filename)
  } finally {
    document.body.removeChild(container)
  }
}
