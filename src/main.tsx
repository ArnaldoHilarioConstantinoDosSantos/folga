import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { MonthProvider } from './contexts/MonthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { queryClient } from './lib/queryClient'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <MonthProvider>
              <BrowserRouter basename={import.meta.env.BASE_URL}>
                <App />
              </BrowserRouter>
            </MonthProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
