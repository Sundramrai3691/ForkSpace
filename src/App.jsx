import './App.css'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Editor from './pages/Editor'
import SolutionAnalyzer from './pages/SolutionAnalyzer'
import MockSummaryPage from './pages/MockSummaryPage'
import SessionReportPage from './pages/SessionReportPage'
import AnalysisReportsPage from './pages/AnalysisReportsPage'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from '../Context/ThemeContext'



function App() {

  return (
    <>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/analyse" element={<SolutionAnalyzer />} />
            <Route path="/analysis/:analysisId" element={<SolutionAnalyzer />} />
            <Route path="/summary/:summaryId" element={<MockSummaryPage />} />
            <Route path="/report/:shareId" element={<SessionReportPage />} />
            <Route path="/history/reports" element={<AnalysisReportsPage />} />
            <Route path="/editor/:roomId" element={<Editor />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster position='top:right' />
      </ThemeProvider>
    </>

  )
}

export default App
