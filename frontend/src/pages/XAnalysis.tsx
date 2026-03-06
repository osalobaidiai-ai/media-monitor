import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { Header } from '../components/Header'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { generateXReportPDF, type XAnalysisData } from '../utils/generateXReportPDF'

// ── API ────────────────────────────────────────────────────────────────────────

interface TweetItem {
  id: string
  text: string
  date: string
  hour: number
  hashtags: string[]
  mentions: string[]
  is_retweet: boolean
  is_reply: boolean
  likes: number
  retweets: number
}

interface XProfile {
  username: string
  display_name: string
  bio: string
  followers: string
  following: string
  tweets_count: string
  verified: boolean
}

interface XAnalysisResponse {
  username: string
  profile: XProfile | null
  tweets: TweetItem[]
  tweet_count: number
  top_hashtags: Array<{ tag: string; count: number }>
  hour_distribution: Array<{ hour: number; count: number }>
  content_breakdown: { original: number; retweets: number; replies: number; total: number }
  analysis: string
  model_used: string
  generated_at: string
  nitter_instance: string
}

const analyzeAccount = async (username: string, max_tweets: number): Promise<XAnalysisResponse> => {
  const { data } = await axios.get('/api/v1/twitter/analyze', {
    params: { username, max_tweets },
  })
  return data
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-primary)', direction: 'rtl' }}>
      {lines.map((line, i) => {
        const esc = (s: string) =>
          <span dangerouslySetInnerHTML={{ __html: s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="text-base font-bold mt-5 mb-2 pb-2 border-b flex items-center gap-2"
                style={{ borderColor: 'rgba(29,155,240,0.3)', color: '#1d9bf0' }}>
              <span className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: '#1d9bf0' }} />
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-bold text-sm mt-4 mb-1.5 pr-3"
                style={{ borderRight: '3px solid rgba(201,168,76,0.6)', color: 'var(--text-primary)' }}>
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('### '))
          return <h4 key={i} className="font-semibold text-sm mt-3" style={{ color: 'var(--text-primary)' }}>{line.slice(4)}</h4>
        if (line.startsWith('---'))
          return <hr key={i} className="my-4 opacity-20" style={{ borderColor: 'var(--border)' }} />
        if (line.trim() === '')
          return <div key={i} className="h-1" />
        if (line.startsWith('- '))
          return (
            <div key={i} className="flex gap-2 items-start pr-2">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2" style={{ background: '#1d9bf0' }} />
              <span className="flex-1 text-xs leading-relaxed">{esc(line.slice(2))}</span>
            </div>
          )
        return <p key={i} className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{esc(line)}</p>
      })}
    </div>
  )
}

// ── Mini bar chart ─────────────────────────────────────────────────────────────
function HourChart({ dist }: { dist: Array<{ hour: number; count: number }> }) {
  const max = Math.max(...dist.map(d => d.count), 1)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-0.5 h-16">
        {dist.map(d => {
          const pct = Math.max(3, (d.count / max) * 100)
          const col = d.count > max * 0.7 ? '#1d9bf0' : d.count > max * 0.4 ? '#0ea5e9' : 'rgba(0,212,255,0.15)'
          return (
            <div
              key={d.hour}
              title={`${d.hour}:00 — ${d.count} تغريدة`}
              className="flex-1 rounded-sm cursor-pointer transition-opacity hover:opacity-80"
              style={{ height: `${pct}%`, background: col }}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[8px]" style={{ color: 'var(--text-muted)' }}>
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  )
}

// ── X Logo ─────────────────────────────────────────────────────────────────────
function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M18.244 13.244L26.414 4H24.5L17.414 12.114L11.828 4H4L12.586 16.356L4 26H5.914L13.414 17.414L19.414 26H27.242L18.244 13.244ZM14.328 16.242L13.414 14.914L6.414 5.414H11L15.5 11.8L16.414 13.128L24.5 23.214H19.914L14.328 16.242Z"
        fill="currentColor"
      />
    </svg>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export function XAnalysis() {
  const [username, setUsername] = useState('')
  const [maxTweets, setMaxTweets] = useState(50)
  const [result, setResult] = useState<XAnalysisResponse | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'tweets' | 'analysis'>('overview')
  const [exporting, setExporting] = useState(false)

  const mutation = useMutation({
    mutationFn: () => analyzeAccount(username.trim().replace(/^@/, ''), maxTweets),
    onSuccess: (data) => {
      setResult(data)
      setActiveTab('overview')
      toast.success(`تم تحليل @${data.username} — ${data.tweet_count} تغريدة`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'فشل تحليل الحساب'
      toast.error(msg)
    },
  })

  const handleExportPDF = async () => {
    if (!result) return
    setExporting(true)
    try {
      const pdfData: XAnalysisData = {
        username:           result.username,
        profile:            result.profile,
        tweet_count:        result.tweet_count,
        top_hashtags:       result.top_hashtags,
        hour_distribution:  result.hour_distribution,
        content_breakdown:  result.content_breakdown,
        analysis:           result.analysis,
        model_used:         result.model_used,
        generated_at:       result.generated_at,
      }
      await generateXReportPDF(pdfData)
      toast.success('تم تصدير التقرير بنجاح')
    } catch (e) {
      toast.error('فشل تصدير PDF')
    } finally {
      setExporting(false)
    }
  }

  const cb = result?.content_breakdown
  const total = cb?.total || 1
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      <Header title="تحليل X (تويتر) — رصد الحسابات العامة" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Search card ── */}
        <div className="rounded-xl p-5" style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(29,155,240,0.25)',
          boxShadow: '0 0 20px rgba(29,155,240,0.06)',
        }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <XIcon size={18} />
            </div>
            <div>
              <h2 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>تحليل حساب X</h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                أدخل اسم الحساب لتحليله بالذكاء الاصطناعي بدون API رسمي
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-[11px] mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                اسم الحساب
              </label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm"
                      style={{ color: 'var(--text-muted)' }}>@</span>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && username.trim() && mutation.mutate()}
                  placeholder="SaudiMediaForum"
                  dir="ltr"
                  className="w-full rounded-lg px-4 py-2.5 text-sm pr-8 transition-all"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#1d9bf0')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            </div>

            <div className="w-36">
              <label className="block text-[11px] mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                عدد التغريدات
              </label>
              <select
                value={maxTweets}
                onChange={e => setMaxTweets(Number(e.target.value))}
                className="w-full rounded-lg px-3 py-2.5 text-sm"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              >
                <option value={20}>20 تغريدة</option>
                <option value={50}>50 تغريدة</option>
                <option value={100}>100 تغريدة</option>
              </select>
            </div>

            <button
              onClick={() => mutation.mutate()}
              disabled={!username.trim() || mutation.isPending}
              className="px-6 py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#1d9bf0', color: '#fff' }}
            >
              {mutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جاري التحليل...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>◎</span>
                  تحليل
                </span>
              )}
            </button>
          </div>

          {/* Note */}
          <div className="mt-3 px-3 py-2 rounded-lg text-[10px] flex items-start gap-2"
               style={{ background: 'rgba(29,155,240,0.06)', border: '1px solid rgba(29,155,240,0.12)', color: 'var(--text-muted)' }}>
            <span className="text-sky-400 flex-shrink-0 mt-0.5">ℹ</span>
            <span>يعمل النظام عبر منصة Nitter (مرآة مفتوحة لـ X) لجلب التغريدات العامة بدون API رسمي.
              الحسابات المحمية أو المخصصة غير متاحة.</span>
          </div>
        </div>

        {/* ── Loading ── */}
        <AnimatePresence>
          {mutation.isPending && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="rounded-xl p-10 text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="w-12 h-12 border-3 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                جاري جلب التغريدات وتحليلها...
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                قد يستغرق التحليل الكامل 30–60 ثانية
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results ── */}
        <AnimatePresence>
          {result && !mutation.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >

              {/* Profile banner */}
              <div className="rounded-xl p-4" style={{
                background: 'var(--bg-card)',
                border: '1px solid rgba(29,155,240,0.2)',
              }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Avatar placeholder */}
                    <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                         style={{ background: '#000', border: '2px solid rgba(29,155,240,0.4)' }}>
                      <XIcon size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                          {result.profile?.display_name ?? result.username}
                        </h3>
                        {result.profile?.verified && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                                style={{ background: 'rgba(29,155,240,0.2)', color: '#1d9bf0' }}>✓ موثَّق</span>
                        )}
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>@{result.username}</span>
                      </div>
                      {result.profile?.bio && (
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {result.profile.bio}
                        </p>
                      )}
                      {result.profile && (
                        <div className="flex gap-5 mt-2 text-xs">
                          {[
                            { label: 'متابِع',  val: result.profile.followers },
                            { label: 'يتابع',    val: result.profile.following },
                            { label: 'تغريدة',  val: result.profile.tweets_count },
                          ].map(s => (
                            <span key={s.label} className="flex gap-1 items-baseline">
                              <strong style={{ color: 'var(--text-primary)' }}>{s.val}</strong>
                              <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(29,155,240,0.1)', color: '#1d9bf0', border: '1px solid rgba(29,155,240,0.2)' }}>
                          {result.tweet_count} تغريدة مُحللة
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}>
                          {result.model_used === 'rule-based' ? 'تحليل آلي' : 'Claude AI'}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          عبر {result.nitter_instance.replace('https://', '')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Export PDF */}
                  <button
                    onClick={handleExportPDF}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 flex-shrink-0"
                    style={{ background: 'rgba(30,58,138,0.4)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}
                  >
                    {exporting ? (
                      <span className="w-3.5 h-3.5 border border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
                    ) : '↓'}
                    تصدير PDF
                  </button>
                </div>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { val: String(cb?.total ?? 0), label: 'إجمالي التغريدات', color: '#1d9bf0' },
                  { val: String(cb?.original ?? 0), label: `أصلية (${pct(cb?.original ?? 0)})`, color: '#16a34a' },
                  { val: String(cb?.retweets ?? 0), label: `إعادة تغريد (${pct(cb?.retweets ?? 0)})`, color: '#0ea5e9' },
                  { val: String(cb?.replies ?? 0), label: `ردود (${pct(cb?.replies ?? 0)})`, color: '#64748b' },
                ].map((k, i) => (
                  <div key={i} className="rounded-xl p-4 relative overflow-hidden"
                       style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div className="absolute bottom-0 right-0 left-0 h-0.5" style={{ background: k.color }} />
                    <div className="text-xl font-bold" style={{ color: k.color }}>{k.val}</div>
                    <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl w-fit"
                   style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                {([
                  { id: 'overview', label: 'نظرة عامة' },
                  { id: 'tweets',   label: 'التغريدات'  },
                  { id: 'analysis', label: 'التحليل الكامل' },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={activeTab === tab.id ? {
                      background: '#1d9bf0', color: '#fff',
                    } : { color: 'var(--text-muted)' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <AnimatePresence>

                {/* Overview */}
                {activeTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="grid grid-cols-2 gap-4"
                  >
                    {/* Hashtags */}
                    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      <h3 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: '#1d9bf0' }}>
                        <span>#</span> أبرز الهاشتاقات تكراراً
                      </h3>
                      {result.top_hashtags.length === 0 ? (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>لا توجد هاشتاقات</p>
                      ) : (
                        <div className="space-y-2">
                          {result.top_hashtags.slice(0, 10).map((h, i) => {
                            const maxCount = result.top_hashtags[0]?.count || 1
                            const pctW = Math.round((h.count / maxCount) * 100)
                            return (
                              <div key={h.tag} className="flex items-center gap-2">
                                <span className="w-5 text-center text-[10px] flex-shrink-0 font-mono"
                                      style={{ color: i < 3 ? '#1d9bf0' : 'var(--text-muted)' }}>
                                  {i + 1}
                                </span>
                                <span className="text-xs font-bold flex-shrink-0" style={{ color: '#1d9bf0', minWidth: '100px' }}>
                                  #{h.tag}
                                </span>
                                <div className="flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(29,155,240,0.1)', height: '8px' }}>
                                  <div className="h-full rounded-full transition-all" style={{ width: `${pctW}%`, background: '#1d9bf0' }} />
                                </div>
                                <span className="text-[10px] w-16 text-left flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                  {h.count} مرة
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Hour chart + donut */}
                    <div className="space-y-4">
                      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <h3 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                          <span>◷</span> نشاط النشر على مدار اليوم
                        </h3>
                        <HourChart dist={result.hour_distribution} />
                        <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                          أفضل وقت للنشر:{' '}
                          {(() => {
                            const peak = [...result.hour_distribution].sort((a, b) => b.count - a.count)[0]
                            return peak ? `${peak.hour.toString().padStart(2, '0')}:00` : '—'
                          })()}
                        </p>
                      </div>

                      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
                          توزيع المحتوى
                        </h3>
                        <div className="space-y-2">
                          {[
                            { label: 'تغريدات أصلية', val: cb?.original ?? 0, color: '#16a34a' },
                            { label: 'إعادة تغريد',   val: cb?.retweets ?? 0, color: '#1d9bf0' },
                            { label: 'ردود',           val: cb?.replies  ?? 0, color: '#64748b' },
                          ].map(item => (
                            <div key={item.label}>
                              <div className="flex justify-between text-[10px] mb-0.5">
                                <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                                <span style={{ color: item.color, fontWeight: 'bold' }}>
                                  {item.val} ({pct(item.val)})
                                </span>
                              </div>
                              <div className="rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', height: '7px' }}>
                                <div className="h-full rounded-full" style={{
                                  width: `${Math.round((item.val / total) * 100)}%`,
                                  background: item.color,
                                }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Tweets */}
                {activeTab === 'tweets' && (
                  <motion.div
                    key="tweets"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-2"
                  >
                    <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                      آخر {result.tweets.length} تغريدة (عينة من البيانات المحللة)
                    </p>
                    {result.tweets.map((tweet) => (
                      <div key={tweet.id}
                           className="rounded-xl p-3 transition-all hover:border-sky-500/30"
                           style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                               style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <XIcon size={12} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                                @{result.username}
                              </span>
                              {tweet.is_retweet && (
                                <span className="text-[9px] px-1.5 rounded" style={{ background: 'rgba(29,155,240,0.15)', color: '#1d9bf0' }}>RT</span>
                              )}
                              {tweet.is_reply && (
                                <span className="text-[9px] px-1.5 rounded" style={{ background: 'rgba(100,116,139,0.15)', color: '#64748b' }}>رد</span>
                              )}
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {new Date(tweet.date).toLocaleDateString('ar-SA')} — {tweet.hour.toString().padStart(2,'0')}:00
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)', direction: 'rtl' }}>
                              {tweet.text}
                            </p>
                            {tweet.hashtags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {tweet.hashtags.slice(0, 5).map(tag => (
                                  <span key={tag} className="text-[9px] font-bold" style={{ color: '#1d9bf0' }}>#{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* Full analysis */}
                {activeTab === 'analysis' && (
                  <motion.div
                    key="analysis"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="rounded-xl p-5"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        التحليل الذكي الشامل
                      </h3>
                      <span className="text-[10px] px-2 py-1 rounded-full"
                            style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}>
                        {result.model_used === 'rule-based' ? 'تحليل آلي' : 'Claude AI'}
                      </span>
                    </div>
                    <MarkdownRenderer content={result.analysis} />
                  </motion.div>
                )}

              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!result && !mutation.isPending && (
          <div className="rounded-xl p-12 text-center" style={{ background: 'var(--bg-card)', border: '1px dashed rgba(29,155,240,0.2)' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                 style={{ background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(29,155,240,0.2)' }}>
              <XIcon size={28} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              أدخل اسم حساب X لبدء التحليل
            </p>
            <p className="text-xs mt-2 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
              يدعم النظام الحسابات العامة العربية والإنجليزية. يُحلِّل المشاعر والهاشتاقات
              وأنماط النشر والجمهور المستهدف بالذكاء الاصطناعي.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
