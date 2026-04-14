import './App.css'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Editor from './pages/Editor'
import AnalysePage from './pages/AnalysePage'
import MockSummaryPage from './pages/MockSummaryPage'
import SessionReportPage from './pages/SessionReportPage'
import AnalysisReportsPage from './pages/AnalysisReportsPage'
import SessionCardPage from './pages/SessionCardPage'
import NewRoomRedirect from './pages/NewRoomRedirect'
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
            <Route path="/analyse" element={<AnalysePage />} />
            <Route path="/analysis/:analysisId" element={<AnalysePage />} />
            <Route path="/summary/:summaryId" element={<MockSummaryPage />} />
            <Route path="/report/:shareId" element={<SessionReportPage />} />
            <Route path="/card/:shareId" element={<SessionCardPage />} />
            <Route path="/history/reports" element={<AnalysisReportsPage />} />
            <Route path="/new" element={<NewRoomRedirect />} />
            <Route path="/editor/:roomId" element={<Editor />} />
            <Route path="/room/:roomId" element={<Editor />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster position='top:right' />
      </ThemeProvider>
    </>

  )
}

export default App
