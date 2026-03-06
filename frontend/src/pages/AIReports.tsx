import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { generateReport, fetchReportTypes, fetchStats } from '../utils/api'
import { Header } from '../components/Header'
import { motion, AnimatePresence } from 'framer-motion'
import { generateReportPDF } from '../utils/generateReportPDF'
import type { ReportResponse, Stats } from '../types'

const HOURS_OPTIONS = [
  { value: 6,   label: '6 ساعات' },
  { value: 12,  label: '12 ساعة' },
  { value: 24,  label: '24 ساعة' },
  { value: 48,  label: '48 ساعة' },
  { value: 168, label: 'أسبوع' },
]

const TYPE_ICONS: Record<string, string> = {
  overview:  '📊',
  crisis:    '🚨',
  sentiment: '💡',
  sources:   '🌐',
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-2 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
      {lines.map((line, i) => {
        if (line.startsWith('# ')) {
          return (
            <h2 key={i} className="text-lg font-bold mt-4 mb-2 pb-2 border-b"
                style={{ borderColor: 'var(--border)' }}>
              {line.slice(2)}
            </h2>
          )
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={i} className="font-bold text-base mt-3 mb-1 text-sky-500">
              {line.slice(3)}
            </h3>
          )
        }
        if (line.startsWith('### ')) {
          return (
            <h4 key={i} className="font-semibold text-sm mt-2" style={{ color: 'var(--text-primary)' }}>
              {line.slice(4)}
            </h4>
          )
        }
        if (line.startsWith('- ')) {
          return (
            <div key={i} className="flex gap-2 items-start pr-2">
              <span className="text-sky-400 mt-0.5 flex-shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          )
        }
        if (line.startsWith('---')) {
          return <hr key={i} className="my-3 opacity-20" style={{ borderColor: 'var(--border)' }} />
        }
        if (line.trim() === '') {
          return <div key={i} className="h-1" />
        }
        return (
          <p key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
        )
      })}
    </div>
  )
}

export const AIReports = () => {
  const [selectedType, setSelectedType] = useState('overview')
  const [selectedHours, setSelectedHours] = useState(24)
  const [generatedReport, setGeneratedReport] = useState<ReportResponse | null>(null)
  const [reportStats, setReportStats] = useState<Stats | null>(null)
  const [exportingPDF, setExportingPDF] = useState(false)

  const { data: reportTypes } = useQuery({
    queryKey: ['report-types'],
    queryFn: fetchReportTypes,
    staleTime: Infinity,
  })

  const mutation = useMutation({
    mutationFn: () => Promise.all([
      generateReport({ report_type: selectedType, hours: selectedHours }),
      fetchStats(selectedHours),
    ]),
    onSuccess: ([report, stats]) => {
      setGeneratedReport(report)
      setReportStats(stats)
    },
  })

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })

  const handleExportPDF = async () => {
    if (!generatedReport) return
    setExportingPDF(true)
    try {
      await generateReportPDF(generatedReport, reportStats)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExportingPDF(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Header title="تقارير الذكاء الاصطناعي" />

      <main className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Config Card */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">✦</span>
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              توليد تقرير ذكي
            </h3>
            <span className="badge bg-sky-500/15 text-sky-400 text-[10px] mr-auto">
              Claude AI
            </span>
          </div>

          {/* Report Type Selection */}
          <div className="mb-4">
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
              نوع التقرير
            </p>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
              {(reportTypes || [
                { id: 'overview',  label: 'تقرير شامل' },
                { id: 'crisis',    label: 'تحليل الأزمات' },
                { id: 'sentiment', label: 'تحليل المشاعر' },
                { id: 'sources',   label: 'نشاط المصادر' },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  className="p-3 rounded-xl text-right transition-all border"
                  style={selectedType === t.id ? {
                    background: 'rgba(14,165,233,0.15)',
                    borderColor: '#0ea5e9',
                    color: 'var(--text-primary)',
                  } : {
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div className="text-xl mb-1">{TYPE_ICONS[t.id] ?? '📋'}</div>
                  <div className="text-xs font-medium">{t.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Time Period */}
          <div className="mb-5">
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
              الفترة الزمنية
            </p>
            <div className="flex gap-2 flex-wrap">
              {HOURS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedHours(opt.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                  style={selectedHours === opt.value
                    ? { background: '#0ea5e9', color: '#fff' }
                    : { background: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {mutation.isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                جارٍ التوليد...
              </>
            ) : (
              <>✦ توليد التقرير</>
            )}
          </button>

          {mutation.isError && (
            <p className="text-xs text-red-500 mt-2 text-center">
              حدث خطأ أثناء توليد التقرير. تأكد من اتصال الخادم.
            </p>
          )}
        </div>

        {/* Generated Report */}
        <AnimatePresence>
          {generatedReport && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              {/* Report Header */}
              <div className="flex items-start justify-between mb-5 pb-4 border-b"
                   style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                    {TYPE_ICONS[generatedReport.report_type]} {generatedReport.title}
                  </h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    صدر بتاريخ {formatDate(generatedReport.generated_at)}
                  </p>
                </div>
                <div className="text-left space-y-1 flex-shrink-0">
                  <div className="badge bg-emerald-500/15 text-emerald-500">
                    {generatedReport.total_articles.toLocaleString('ar')} مقالة
                  </div>
                  <div className="block text-[10px] text-center mt-1"
                       style={{ color: 'var(--text-muted)' }}>
                    {generatedReport.model_used === 'rule-based' ? '⚙ آلي' : '✦ Claude AI'}
                  </div>
                </div>
              </div>

              {/* Report Content */}
              <MarkdownRenderer content={generatedReport.content} />

              {/* Actions */}
              <div className="flex gap-2 mt-5 pt-4 border-t flex-wrap" style={{ borderColor: 'var(--border)' }}>

                {/* PDF Export */}
                <button
                  onClick={handleExportPDF}
                  disabled={exportingPDF}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-60"
                  style={{ background: 'rgba(14,165,233,0.15)', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.3)' }}
                >
                  {exportingPDF ? (
                    <>
                      <span className="w-3 h-3 border border-sky-400/40 border-t-sky-400 rounded-full animate-spin" />
                      جارٍ التصدير...
                    </>
                  ) : (
                    <>
                      <PdfIcon />
                      تصدير PDF احترافي
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    const blob = new Blob([generatedReport.content], { type: 'text/plain;charset=utf-8' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = `report-${generatedReport.report_type}-${Date.now()}.txt`
                    a.click()
                  }}
                  className="px-4 py-2 rounded-xl text-xs transition-colors"
                  style={{ background: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  ⬇ تنزيل نص
                </button>

                <button
                  onClick={() => navigator.clipboard.writeText(generatedReport.content)}
                  className="px-4 py-2 rounded-xl text-xs transition-colors"
                  style={{ background: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  ⎘ نسخ
                </button>

                <button
                  onClick={() => { setGeneratedReport(null); setReportStats(null) }}
                  className="px-4 py-2 rounded-xl text-xs transition-colors mr-auto"
                  style={{ color: '#ef4444', background: 'var(--border)' }}
                >
                  × إغلاق
                </button>
              </div>

              {/* PDF preview hint */}
              {reportStats && (
                <p className="text-[10px] mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
                  ✦ PDF يتضمن: إحصائيات، رسوم بيانية للمشاعر والأزمات، النشاط الزمني، جدول المصادر ({reportStats.top_sources?.length ?? 0} مصدر)
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Card */}
        {!generatedReport && (
          <div className="card p-5 opacity-60">
            <h4 className="font-semibold text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              أنواع التقارير المتاحة
            </h4>
            <div className="space-y-2">
              {[
                { icon: '📊', title: 'التقرير الشامل',    desc: 'ملخص كامل للمشهد الإعلامي والمؤشرات الرئيسية' },
                { icon: '🚨', title: 'تحليل الأزمات',     desc: 'تقييم المخاطر وتحليل الأزمات المرصودة' },
                { icon: '💡', title: 'تحليل المشاعر',     desc: 'توزيع المشاعر الإعلامية والتوجهات العامة' },
                { icon: '🌐', title: 'نشاط المصادر',      desc: 'تقييم وترتيب المصادر الإخبارية بحسب النشاط' },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 items-start">
                  <span className="text-base">{item.icon}</span>
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

// PDF icon SVG
const PdfIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)
