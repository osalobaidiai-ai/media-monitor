import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchArticles, fetchSources } from '../utils/api'
import { ArticleCard } from '../components/ArticleCard'
import { Header } from '../components/Header'
import { useAppStore } from '../store'
import { motion, AnimatePresence } from 'framer-motion'

const SENTIMENT_OPTIONS = [
  { value: '', label: 'جميع المشاعر' },
  { value: 'positive', label: '✓ إيجابي' },
  { value: 'negative', label: '✗ سلبي' },
  { value: 'neutral', label: '◌ محايد' },
]

export const Articles = () => {
  const { selectedHours, articlesRefreshTrigger, searchQuery } = useAppStore()
  const [page, setPage] = useState(1)
  const [sentiment, setSentiment] = useState('')
  const [crisisOnly, setCrisisOnly] = useState(false)
  const [sourceName, setSourceName] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const PAGE_SIZE = 20

  const { data: sources } = useQuery({
    queryKey: ['sources'],
    queryFn: fetchSources,
    staleTime: 300000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['articles-list', page, sentiment, crisisOnly, selectedHours, searchQuery,
               articlesRefreshTrigger, sourceName, dateFrom, dateTo],
    queryFn: () => fetchArticles({
      page,
      page_size: PAGE_SIZE,
      sentiment: sentiment || undefined,
      crisis_only: crisisOnly || undefined,
      search: searchQuery || undefined,
      hours: selectedHours,
      source_name: sourceName || undefined,
    }),
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
  })

  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE)
  const activeFilterCount = [sentiment, crisisOnly, sourceName, dateFrom, dateTo].filter(Boolean).length

  const resetFilters = () => {
    setSentiment('')
    setCrisisOnly(false)
    setSourceName('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const inputStyle = {
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    borderColor: 'var(--border)',
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Header title="الأخبار والمقالات" />

      {/* Filter Bar */}
      <div className="px-5 py-3 border-b" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex gap-2 flex-wrap items-center">
          {SENTIMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setSentiment(opt.value); setPage(1) }}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={sentiment === opt.value
                ? { background: '#0ea5e9', color: '#fff' }
                : { background: 'var(--border)', color: 'var(--text-muted)' }}
            >
              {opt.label}
            </button>
          ))}

          <button
            onClick={() => { setCrisisOnly(!crisisOnly); setPage(1) }}
            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={crisisOnly
              ? { background: '#ef4444', color: '#fff' }
              : { background: 'var(--border)', color: 'var(--text-muted)' }}
          >
            🚨 أزمات فقط
          </button>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
            style={{
              background: 'var(--border)',
              color: showAdvanced || activeFilterCount > 0 ? '#0ea5e9' : 'var(--text-muted)',
            }}
          >
            ⚙ فلاتر متقدمة
            {activeFilterCount > 0 && (
              <span className="bg-sky-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="px-3 py-1.5 rounded-xl text-xs transition-all"
              style={{ color: '#ef4444', background: 'var(--border)' }}
            >
              × مسح الكل
            </button>
          )}

          {data && (
            <span className="mr-auto self-center text-xs" style={{ color: 'var(--text-muted)' }}>
              {data.total.toLocaleString('ar')} مقالة
            </span>
          )}
        </div>

        {/* Advanced Filters Panel */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t"
                style={{ borderColor: 'var(--border)' }}
              >
                {/* Source Filter */}
                <div>
                  <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                    المصدر الإخباري
                  </label>
                  <select
                    value={sourceName}
                    onChange={(e) => { setSourceName(e.target.value); setPage(1) }}
                    className="w-full text-xs rounded-lg px-3 py-2 border outline-none focus:border-sky-500 transition-colors"
                    style={inputStyle}
                  >
                    <option value="">جميع المصادر</option>
                    {sources?.map((src) => (
                      <option key={src.id} value={src.name}>
                        {src.name_ar || src.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                    من تاريخ
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                    className="w-full text-xs rounded-lg px-3 py-2 border outline-none focus:border-sky-500 transition-colors"
                    style={inputStyle}
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                    إلى تاريخ
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                    className="w-full text-xs rounded-lg px-3 py-2 border outline-none focus:border-sky-500 transition-colors"
                    style={inputStyle}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Articles List */}
      <main className="flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse h-32" />
            ))}
          </div>
        ) : data?.articles.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <div className="text-5xl mb-4">📭</div>
            <p className="text-sm">لا توجد مقالات تطابق الفلتر المحدد</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {data?.articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => window.open(article.url, '_blank')}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-40"
                  style={{ background: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  السابق
                </button>
                <span className="px-4 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-40"
                  style={{ background: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  التالي
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
