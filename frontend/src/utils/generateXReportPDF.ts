/**
 * generateXReportPDF — Professional Arabic PDF for X (Twitter) Analysis
 * Strategy: html2canvas + jsPDF (same pattern as generateReportPDF)
 */

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface XProfile {
  username: string
  display_name: string
  bio: string
  followers: string
  following: string
  tweets_count: string
  verified: boolean
}

export interface XAnalysisData {
  username: string
  profile: XProfile | null
  tweet_count: number
  top_hashtags: Array<{ tag: string; count: number }>
  hour_distribution: Array<{ hour: number; count: number }>
  content_breakdown: { original: number; retweets: number; replies: number; total: number }
  analysis: string
  model_used: string
  generated_at: string
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PW       = 794
const PH       = 1123
const SCALE    = 2.5
const PH_SCALED = PH * SCALE

const C = {
  navy:    '#0d1b2e',
  navyMid: '#1a3057',
  primary: '#1e3a8a',
  gold:    '#C9A84C',
  goldLight:'#e8c97a',
  accent:  '#0ea5e9',
  x:       '#000000',    // X brand color
  xBlue:   '#1d9bf0',   // X legacy blue
  pos:     '#16a34a',
  neg:     '#dc2626',
  neut:    '#64748b',
  bg:      '#f8fafc',
  white:   '#ffffff',
  txt:     '#1e293b',
  muted:   '#475569',
  border:  '#e2e8f0',
}

const F = "'Cairo', 'Segoe UI', Arial, sans-serif"

// ── X Logo SVG ─────────────────────────────────────────────────────────────────
const X_LOGO = `
  <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="${C.x}"/>
    <path d="M18.244 13.244L26.414 4H24.5L17.414 12.114L11.828 4H4L12.586 16.356L4 26H5.914L13.414 17.414L19.414 26H27.242L18.244 13.244ZM14.328 16.242L13.414 14.914L6.414 5.414H11L15.5 11.8L16.414 13.128L24.5 23.214H19.914L14.328 16.242Z"
          fill="white"/>
  </svg>`

// Radar logo
const RADAR_LOGO = `
  <svg width="36" height="36" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22" cy="22" r="21" fill="none" stroke="${C.gold}" stroke-width="1.5"/>
    <circle cx="22" cy="22" r="17" fill="${C.navyMid}"/>
    <circle cx="22" cy="22" r="7.5" fill="none" stroke="${C.gold}" stroke-width="1.8"/>
    <circle cx="22" cy="22" r="3" fill="${C.gold}"/>
    <line x1="22" y1="8" x2="22" y2="13" stroke="${C.goldLight}" stroke-width="1.4" stroke-linecap="round"/>
    <line x1="22" y1="31" x2="22" y2="36" stroke="${C.goldLight}" stroke-width="1.4" stroke-linecap="round"/>
    <line x1="8"  y1="22" x2="13" y2="22" stroke="${C.goldLight}" stroke-width="1.4" stroke-linecap="round"/>
    <line x1="31" y1="22" x2="36" y2="22" stroke="${C.goldLight}" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`

// ── Wrappers ───────────────────────────────────────────────────────────────────
const pageWrap = (inner: string) => `
  <div style="font-family:${F};direction:rtl;background:${C.white};
    width:${PW}px;height:${PH}px;overflow:hidden;
    box-sizing:border-box;color:${C.txt};display:flex;flex-direction:column;"
  >${inner}</div>`

const contentWrap = (inner: string) => `
  <div style="font-family:${F};direction:rtl;background:${C.white};
    width:${PW}px;box-sizing:border-box;color:${C.txt};display:flex;flex-direction:column;"
  >${inner}</div>`

// ── Header ─────────────────────────────────────────────────────────────────────
function header(username: string, genDate: string): string {
  const dateStr = new Date(genDate).toLocaleDateString('ar-SA', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  return `
    <div style="background:${C.navy};flex-shrink:0;overflow:hidden;position:relative;">
      <div style="height:4px;background:${C.gold};"></div>
      <div style="padding:11px 28px;display:flex;align-items:center;
                  justify-content:space-between;direction:ltr;position:relative;z-index:1;">
        <!-- Left -->
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-start;min-width:160px;">
          <div style="background:${C.gold};color:${C.navy};padding:3px 12px;border-radius:3px;
                      font-size:9px;font-weight:bold;font-family:${F};direction:rtl;">
            للاستخدام الرسمي الداخلي
          </div>
          <div style="color:rgba(255,255,255,0.6);font-size:8.5px;font-family:${F};direction:rtl;">
            ${dateStr}
          </div>
        </div>
        <!-- Center -->
        <div style="text-align:center;direction:rtl;flex:1;padding:0 16px;">
          <div style="color:${C.white};font-size:17px;font-weight:bold;font-family:${F};">
            تحليل حساب X (تويتر)
          </div>
          <div style="color:${C.goldLight};font-size:9px;margin-top:3px;font-family:${F};">
            @${username} &nbsp;·&nbsp; منظومة رصد الإعلام الذكي
          </div>
        </div>
        <!-- Right -->
        <div style="display:flex;align-items:center;gap:10px;min-width:160px;justify-content:flex-end;">
          ${RADAR_LOGO}
          ${X_LOGO}
        </div>
      </div>
      <div style="height:3px;background:${C.xBlue};opacity:0.6;"></div>
      <div style="height:3px;background:${C.accent};"></div>
    </div>`
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function footer(genDate: string, pageNum: number): string {
  const d = new Date(genDate).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  return `
    <div style="border-top:2px solid ${C.border};padding:7px 28px;
                display:flex;justify-content:space-between;align-items:center;
                direction:ltr;flex-shrink:0;background:${C.bg};">
      <div style="display:flex;align-items:center;gap:5px;">
        <div style="background:${C.primary};color:${C.white};font-size:8px;font-weight:bold;
                    font-family:${F};padding:2px 8px;border-radius:3px;direction:ltr;">
          صفحة ${pageNum}
        </div>
      </div>
      <span style="color:${C.muted};font-size:8px;font-family:${F};text-align:center;">
        منظومة رصد الإعلام الذكي &nbsp;·&nbsp; تحليل X &nbsp;·&nbsp; جميع الحقوق محفوظة
      </span>
      <span style="color:${C.muted};font-size:8px;font-family:${F};direction:rtl;">${d}</span>
    </div>`
}

// ── Section title ──────────────────────────────────────────────────────────────
function secTitle(text: string): string {
  return `
    <div style="display:flex;align-items:center;gap:10px;direction:rtl;margin-top:15px;margin-bottom:9px;">
      <div style="width:4px;height:18px;background:${C.xBlue};border-radius:2px;flex-shrink:0;"></div>
      <div style="font-size:12.5px;font-weight:bold;color:${C.primary};font-family:${F};flex:1;">${text}</div>
    </div>
    <div style="height:1px;background:${C.border};margin-bottom:10px;"></div>`
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function statCard(val: string, label: string, color: string): string {
  return `
    <div style="flex:1;background:${C.white};border-radius:10px;padding:12px 10px;
                border:1px solid ${C.border};box-shadow:0 2px 6px rgba(0,0,0,0.05);
                display:flex;flex-direction:column;gap:5px;direction:rtl;position:relative;overflow:hidden;">
      <div style="position:absolute;bottom:0;right:0;left:0;height:3px;background:${color};border-radius:0 0 10px 10px;"></div>
      <div style="font-size:20px;font-weight:bold;color:${color};font-family:${F};direction:ltr;">${val}</div>
      <div style="font-size:9px;color:${C.muted};font-family:${F};line-height:1.4;padding-bottom:4px;">${label}</div>
    </div>`
}

// ── Hashtag bar ────────────────────────────────────────────────────────────────
function hashtagBar(tag: string, count: number, max: number, i: number): string {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  const bg  = i % 2 === 1 ? C.bg : C.white
  return `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;
                background:${bg};border-radius:6px;margin-bottom:3px;direction:rtl;">
      <span style="width:120px;font-size:10px;font-family:${F};color:${C.xBlue};
                   font-weight:bold;text-align:right;flex-shrink:0;">#${tag}</span>
      <div style="flex:1;background:${C.border};border-radius:8px;height:13px;overflow:hidden;direction:ltr;">
        <div style="width:${pct}%;height:100%;background:${C.xBlue};border-radius:8px;"></div>
      </div>
      <span style="width:55px;font-size:9.5px;color:${C.muted};font-family:${F};text-align:left;direction:ltr;">
        ${count} مرة (${pct}%)
      </span>
    </div>`
}

// ── 24h activity chart ─────────────────────────────────────────────────────────
function hourChart(dist: Array<{ hour: number; count: number }>): string {
  const max   = Math.max(...dist.map(d => d.count), 1)
  const bars  = dist.map(d => {
    const pct = Math.max(3, (d.count / max) * 100)
    const col = d.count > max * 0.7 ? C.xBlue : d.count > max * 0.4 ? C.accent : C.border
    return `<div style="flex:1;height:${pct}%;background:${col};border-radius:2px 2px 0 0;
                        margin:0 0.5px;min-height:3px;title:${d.hour}:00"></div>`
  }).join('')

  // Tick labels: 0, 6, 12, 18, 23
  const ticks = [0, 6, 12, 18, 23].map(h => {
    const leftPct = (h / 23) * 100
    return `<span style="position:absolute;left:${leftPct}%;transform:translateX(-50%);
                         font-size:7.5px;color:${C.muted};font-family:${F};">${h}:00</span>`
  }).join('')

  return `
    <div style="background:${C.bg};border-radius:8px;padding:12px 12px 24px;border:1px solid ${C.border};">
      <div style="height:80px;display:flex;align-items:flex-end;border-bottom:1px solid ${C.border};
                  direction:ltr;padding-bottom:2px;">${bars}</div>
      <div style="position:relative;height:16px;margin-top:2px;">${ticks}</div>
    </div>`
}

// ── Content donut ──────────────────────────────────────────────────────────────
function contentDonut(cb: { original: number; retweets: number; replies: number; total: number }): string {
  const total = cb.total || 1
  const data  = [
    { label: 'أصلية', value: cb.original,  color: C.pos  },
    { label: 'إعادة', value: cb.retweets,  color: C.xBlue },
    { label: 'ردود',  value: cb.replies,   color: C.neut },
  ].filter(d => d.value > 0)

  const cx = 55, cy = 55, r = 48, ir = 24
  let angle = -Math.PI / 2
  const paths = data.map(d => {
    const sweep = (d.value / total) * 2 * Math.PI
    const x1  = cx + r * Math.cos(angle),    y1  = cy + r * Math.sin(angle)
    const ix1 = cx + ir * Math.cos(angle),   iy1 = cy + ir * Math.sin(angle)
    angle += sweep
    const x2  = cx + r * Math.cos(angle),    y2  = cy + r * Math.sin(angle)
    const ix2 = cx + ir * Math.cos(angle),   iy2 = cy + ir * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    const path  = `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L${ix2.toFixed(1)} ${iy2.toFixed(1)} A${ir} ${ir} 0 ${large} 0 ${ix1.toFixed(1)} ${iy1.toFixed(1)}Z`
    return `<path d="${path}" fill="${d.color}" stroke="white" stroke-width="2"/>`
  }).join('')

  const legend = data.map(d => {
    const pct = Math.round((d.value / total) * 100)
    return `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;direction:rtl;">
        <div style="width:11px;height:11px;background:${d.color};border-radius:3px;flex-shrink:0;"></div>
        <span style="font-size:10px;font-family:${F};flex:1;">${d.label}</span>
        <span style="font-size:10px;font-weight:bold;color:${d.color};font-family:${F};">${pct}%</span>
        <span style="font-size:9px;color:${C.muted};font-family:${F};min-width:30px;text-align:left;direction:ltr;">${d.value}</span>
      </div>`
  }).join('')

  return `
    <div style="display:flex;align-items:center;gap:16px;direction:rtl;">
      <svg width="110" height="110" viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
        <circle cx="${cx}" cy="${cy}" r="${r+4}" fill="${C.bg}"/>
        ${paths}
        <circle cx="${cx}" cy="${cy}" r="${ir-2}" fill="white"/>
        <text x="${cx}" y="${cy-4}" text-anchor="middle" font-size="11" font-weight="bold" fill="${C.txt}" font-family="Cairo,Arial">${total}</text>
        <text x="${cx}" y="${cy+11}" text-anchor="middle" font-size="7.5" fill="${C.muted}" font-family="Cairo,Arial">تغريدة</text>
      </svg>
      <div style="flex:1;">${legend}</div>
    </div>`
}

// ── Markdown → array of block HTML strings ────────────────────────────────────
// Each element is one renderable block (heading / paragraph / list item / spacer).
// Keeping them separate lets us measure each block's height independently.
function md2blocks(content: string): string[] {
  const esc = (s: string) => s.replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.txt};">$1</strong>`)
  return content.split('\n').map(line => {
    if (line.startsWith('# '))
      return `<div style="display:flex;align-items:center;gap:10px;direction:rtl;
        font-size:15px;font-weight:bold;color:${C.primary};margin:18px 0 8px;
        padding-bottom:6px;border-bottom:2px solid ${C.xBlue};font-family:${F};">
        <div style="width:4px;height:18px;background:${C.xBlue};border-radius:2px;flex-shrink:0;"></div>
        ${esc(line.slice(2))}</div>`
    if (line.startsWith('## '))
      return `<div style="font-size:12.5px;font-weight:bold;color:${C.navyMid};
        margin:12px 0 6px;font-family:${F};padding-right:10px;
        border-right:3px solid ${C.gold};">${esc(line.slice(3))}</div>`
    if (line.startsWith('### '))
      return `<div style="font-size:11.5px;font-weight:bold;color:${C.txt};margin:8px 0 4px;font-family:${F};">
        ${esc(line.slice(4))}</div>`
    if (line.startsWith('---'))
      return `<hr style="border:none;border-top:1px solid ${C.border};margin:12px 0;">`
    if (line.trim() === '')
      return '<div style="height:6px;"></div>'
    if (line.startsWith('- '))
      return `<div style="display:flex;gap:8px;margin-bottom:5px;direction:rtl;align-items:flex-start;padding-right:4px;">
        <div style="width:6px;height:6px;background:${C.xBlue};border-radius:50%;flex-shrink:0;margin-top:6px;"></div>
        <span style="flex:1;font-size:11px;line-height:1.8;font-family:${F};color:${C.txt};">${esc(line.slice(2))}</span>
      </div>`
    return `<p style="font-size:11px;line-height:1.8;margin:0 0 5px;font-family:${F};color:${C.txt};">${esc(line)}</p>`
  })
}

// ── Page 1: Profile + KPIs + Charts ───────────────────────────────────────────
function buildPage1(data: XAnalysisData): string {
  const { profile, content_breakdown: cb, top_hashtags, hour_distribution } = data
  const total = cb.total || 1
  const pct   = (n: number) => `${Math.round((n / total) * 100)}%`

  const maxTag  = top_hashtags.length ? Math.max(...top_hashtags.map(t => t.count)) : 1
  const topTags = top_hashtags.slice(0, 8)

  const inner = `
    ${header(data.username, data.generated_at)}

    <div style="flex:1;padding:14px 28px 8px;overflow:hidden;display:flex;flex-direction:column;">

      <!-- Profile card -->
      <div style="background:${C.bg};border-radius:10px;padding:12px 16px;margin-bottom:13px;
                  border:1px solid ${C.border};border-right:4px solid ${C.xBlue};direction:rtl;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <!-- X icon placeholder -->
          <div style="width:44px;height:44px;border-radius:50%;background:${C.x};
                      display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="22" height="22" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.244 13.244L26.414 4H24.5L17.414 12.114L11.828 4H4L12.586 16.356L4 26H5.914L13.414 17.414L19.414 26H27.242L18.244 13.244ZM14.328 16.242L13.414 14.914L6.414 5.414H11L15.5 11.8L16.414 13.128L24.5 23.214H19.914L14.328 16.242Z" fill="white"/>
            </svg>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:bold;color:${C.txt};font-family:${F};line-height:1.3;">
              ${profile?.display_name ?? data.username}
              ${profile?.verified ? ' ✓' : ''}
            </div>
            <div style="font-size:10px;color:${C.muted};font-family:${F};margin-top:2px;">@${data.username}</div>
            ${profile?.bio ? `<div style="font-size:10px;color:${C.txt};font-family:${F};margin-top:5px;line-height:1.5;">${profile.bio}</div>` : ''}
          </div>
          ${profile ? `
            <div style="display:flex;gap:16px;direction:rtl;flex-shrink:0;">
              ${[
                { v: profile.followers, l: 'متابِع'   },
                { v: profile.following, l: 'يتابع'     },
                { v: profile.tweets_count, l: 'تغريدة' },
              ].map(s => `
                <div style="text-align:center;">
                  <div style="font-size:13px;font-weight:bold;color:${C.primary};font-family:${F};direction:ltr;">${s.v}</div>
                  <div style="font-size:8.5px;color:${C.muted};font-family:${F};">${s.l}</div>
                </div>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Stats row -->
      <div style="display:flex;gap:10px;margin-bottom:13px;direction:ltr;">
        ${statCard(String(total), 'إجمالي التغريدات المحللة', C.xBlue)}
        ${statCard(String(cb.original), `تغريدات أصلية (${pct(cb.original)})`, '#16a34a')}
        ${statCard(String(cb.retweets), `إعادة تغريد (${pct(cb.retweets)})`, C.accent)}
        ${statCard(String(cb.replies),  `ردود (${pct(cb.replies)})`, '#64748b')}
      </div>

      <!-- Two-column: Hashtags + Donut + Hours -->
      <div style="display:flex;gap:16px;flex:1;overflow:hidden;align-items:flex-start;">

        <!-- Left: hashtags -->
        <div style="flex:1.4;display:flex;flex-direction:column;min-width:0;">
          ${secTitle('أبرز الهاشتاقات تكراراً')}
          ${topTags.map((t, i) => hashtagBar(t.tag, t.count, maxTag, i)).join('')}
          ${topTags.length === 0 ? `<div style="font-size:10px;color:${C.muted};font-family:${F};padding:8px;">لا توجد هاشتاقات</div>` : ''}
        </div>

        <!-- Right: donut + hours -->
        <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
          ${secTitle('توزيع المحتوى')}
          ${contentDonut(cb)}
          ${secTitle('نشاط النشر على مدار الساعة')}
          ${hourChart(hour_distribution)}
        </div>

      </div>
    </div>

    ${footer(data.generated_at, 1)}
  `
  return pageWrap(inner)
}

// ── Single fixed-height analysis page ─────────────────────────────────────────
// blocksHtml: pre-joined HTML for this page's blocks only.
// isFirst: shows "التحليل الذكي" title + model badge on the first analysis page.
function buildAnalysisPage(
  data: XAnalysisData,
  blocksHtml: string,
  pageNum: number,
  isFirst: boolean,
): string {
  const modelLabel = data.model_used === 'rule-based'
    ? 'التحليل الآلي'
    : 'Claude AI (claude-sonnet-4-6)'
  const inner = `
    ${header(data.username, data.generated_at)}
    <div style="padding:14px 28px 8px;direction:rtl;overflow:hidden;flex:1;">
      ${isFirst ? `
        ${secTitle('التحليل الذكي الشامل')}
        <div style="font-size:8.5px;color:${C.muted};font-family:${F};margin-bottom:10px;direction:rtl;">
          النموذج: ${modelLabel}
        </div>
      ` : ''}
      <div style="direction:rtl;font-family:${F};line-height:1.7;">${blocksHtml}</div>
    </div>
    ${footer(data.generated_at, pageNum)}
  `
  return pageWrap(inner)   // fixed A4 height — no overflow
}

// ── html2canvas capture ────────────────────────────────────────────────────────

async function captureFixed(el: HTMLElement): Promise<string> {
  const canvas = await html2canvas(el, {
    scale: SCALE, useCORS: true, allowTaint: true,
    backgroundColor: '#ffffff', width: PW, windowWidth: PW, logging: false,
  })
  return canvas.toDataURL('image/jpeg', 0.94)
}

// ── Paragraph-aware multi-page analysis renderer ───────────────────────────────
//
// Algorithm:
//   1. Parse the analysis markdown into an array of independent block HTML strings.
//   2. Render each block in an off-screen measurer div (same width as content area)
//      to get its exact CSS pixel height via getBoundingClientRect().
//   3. Distribute blocks across pages: if a block doesn't fit in the remaining
//      space on the current page, open a new page for it. A block is NEVER split.
//   4. Render each page as a fixed A4 pageWrap div and capture with html2canvas.
//
async function addAnalysisPages(
  pdf: jsPDF,
  data: XAnalysisData,
  startPage: number,
): Promise<void> {
  // Approximate heights of chrome elements in CSS px (not scaled)
  const HEADER_H   = 74   // gold bar + nav row + two accent bars
  const FOOTER_H   = 36   // border + padding + text
  const PAD_V      = 22   // content div: 14px top + 8px bottom
  const FIRST_EXTRA = 55  // secTitle (~30px) + model badge line (~15px) + mb 10
  const CONTENT_H  = PH - HEADER_H - FOOTER_H - PAD_V  // ≈ 991px usable per page

  // 1. Split markdown into blocks
  const blocks = md2blocks(data.analysis)

  // 2. Measure each block off-screen at the exact content column width
  const CONTENT_W = PW - 56   // 28px padding each side
  const measurer  = document.createElement('div')
  measurer.style.cssText = [
    'position:fixed', 'top:-99999px', 'left:0',
    `width:${CONTENT_W}px`,
    'direction:rtl',
    `font-family:${F}`,
    'box-sizing:border-box',
    'visibility:hidden',
  ].join(';')
  document.body.appendChild(measurer)
  await document.fonts.ready

  const measured: Array<{ html: string; h: number }> = []
  for (const html of blocks) {
    measurer.innerHTML = html
    const h = Math.ceil(measurer.getBoundingClientRect().height) + 2  // +2px safety
    measured.push({ html, h })
  }
  document.body.removeChild(measurer)

  // 3. Distribute blocks across pages (never split a block)
  const pages: string[][] = [[]]
  let usedH = FIRST_EXTRA   // first page reserves space for title + model badge

  for (const { html, h } of measured) {
    const remaining = CONTENT_H - usedH
    if (h > remaining && pages[pages.length - 1].length > 0) {
      pages.push([])
      usedH = 0
    }
    pages[pages.length - 1].push(html)
    usedH += h
  }

  // 4. Render each page and add to PDF
  for (let i = 0; i < pages.length; i++) {
    const wrapper = document.createElement('div')
    wrapper.style.cssText = 'position:fixed;top:-99999px;left:0;z-index:-9999;'
    wrapper.innerHTML = buildAnalysisPage(
      data,
      pages[i].join(''),
      startPage + i,
      i === 0,
    )
    document.body.appendChild(wrapper)

    const canvas = await html2canvas(wrapper.firstElementChild as HTMLElement, {
      scale: SCALE, useCORS: true, allowTaint: true,
      backgroundColor: '#ffffff', width: PW, windowWidth: PW, logging: false,
    })
    pdf.addPage()
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297)
    document.body.removeChild(wrapper)
  }
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function generateXReportPDF(data: XAnalysisData): Promise<void> {
  // Page 1 (profile + charts) is a fixed A4 div — render it in isolation
  const p1Wrap = document.createElement('div')
  p1Wrap.style.cssText = 'position:fixed;top:-99999px;left:0;z-index:-9999;'
  p1Wrap.innerHTML = buildPage1(data)
  document.body.appendChild(p1Wrap)

  await document.fonts.ready
  await new Promise<void>(r => setTimeout(r, 300))

  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    // Page 1
    const img1 = await captureFixed(p1Wrap.firstElementChild as HTMLElement)
    pdf.addImage(img1, 'JPEG', 0, 0, 210, 297)

    // Pages 2+ — paragraph-aware pagination
    await addAnalysisPages(pdf, data, 2)

    const filename = `تحليل-X-${data.username}-${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(filename)
  } finally {
    document.body.removeChild(p1Wrap)
  }
}
