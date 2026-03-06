/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        saudi: { green: '#006C35', gold: '#C9A84C' },
        crisis: { low: '#f59e0b', medium: '#f97316', high: '#ef4444', critical: '#7f1d1d' },
        // SOC colors
        soc: {
          bg:       '#050a14',
          surface:  '#0a1628',
          card:     '#0d1b2e',
          border:   '#1a2f4a',
          cyan:     '#00d4ff',
          green:    '#00ff94',
          red:      '#ff4d6d',
          orange:   '#ff8c00',
          purple:   '#a855f7',
          yellow:   '#fbbf24',
        },
      },
      fontFamily: {
        arabic: ['Tajawal', 'Cairo', 'Noto Sans Arabic', 'sans-serif'],
        mono:   ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-in':     'slideIn 0.3s ease-out',
        'fade-in':      'fadeIn 0.4s ease-out',
        'spin-slow':    'spin 3s linear infinite',
        'glow-pulse':   'glowPulse 2s ease-in-out infinite',
        'scan':         'scan 4s linear infinite',
        'border-glow':  'borderGlow 3s ease-in-out infinite',
        'float':        'float 6s ease-in-out infinite',
        'number-up':    'numberUp 0.6s ease-out forwards',
      },
      keyframes: {
        slideIn:     { '0%': { transform: 'translateX(100%)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        fadeIn:      { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        glowPulse:   { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
        scan:        { '0%': { top: '-5%' }, '100%': { top: '105%' } },
        borderGlow:  { '0%,100%': { 'box-shadow': '0 0 8px rgba(0,212,255,0.3)' }, '50%': { 'box-shadow': '0 0 20px rgba(0,212,255,0.7), 0 0 40px rgba(0,212,255,0.2)' } },
        float:       { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        numberUp:    { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      boxShadow: {
        'glow-cyan':   '0 0 20px rgba(0,212,255,0.4), 0 0 40px rgba(0,212,255,0.1)',
        'glow-green':  '0 0 20px rgba(0,255,148,0.4), 0 0 40px rgba(0,255,148,0.1)',
        'glow-red':    '0 0 20px rgba(255,77,109,0.5), 0 0 40px rgba(255,77,109,0.15)',
        'glow-orange': '0 0 20px rgba(255,140,0,0.4)',
        'glow-purple': '0 0 20px rgba(168,85,247,0.4)',
        'card-soc':    '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        'inner-glow':  'inset 0 1px 0 rgba(0,212,255,0.1)',
      },
      backgroundImage: {
        'grid-pattern':  "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.025'%3E%3Cpath d='M0 0h1v40H0V0zm40 0v1H0V0h40zM0 20h40v1H0v-1z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        'dot-pattern':   "url(\"data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%2300d4ff' fill-opacity='0.07'/%3E%3C/svg%3E\")",
        'noise':         "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
