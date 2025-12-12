import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import i18n from './i18n'
import { I18nextProvider } from 'react-i18next'
import axios from 'axios'


const isDevelopment = process.env.NODE_ENV === 'development'
axios.defaults.baseURL = isDevelopment ? 'http://localhost:5000/api' : '/api'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </StrictMode>,
)