import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Articles } from './pages/Articles'
import { Alerts } from './pages/Alerts'
import { Sources } from './pages/Sources'
import { Analytics } from './pages/Analytics'
import { AIReports } from './pages/AIReports'
import { XAnalysis } from './pages/XAnalysis'
import { useWebSocket } from './hooks/useWebSocket'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
    },
  },
})

function AppLayout() {
  useWebSocket()
  // Always SOC dark — set once on mount, not on every render
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])
  return (
    <div className="flex h-screen font-arabic" dir="rtl" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/articles" element={<Articles />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<AIReports />} />
          <Route path="/x-analysis" element={<XAnalysis />} />
        </Routes>
      </div>
      <Toaster
        position="top-left"
        toastOptions={{
          style: {
            background: 'rgba(13,27,46,0.98)',
            border: '1px solid rgba(0,212,255,0.25)',
            color: '#e2e8f0',
            direction: 'rtl',
            fontFamily: 'Cairo, sans-serif',
            boxShadow: '0 0 20px rgba(0,212,255,0.1)',
          },
          success: { iconTheme: { primary: '#00ff94', secondary: '#0d1b2e' } },
          error:   { iconTheme: { primary: '#ff4d6d', secondary: '#0d1b2e' } },
        }}
      />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
