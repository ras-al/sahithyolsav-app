// Path: src/App.jsx

import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import HomePage from './components/HomePage.jsx';
import ResultsPage from './components/ResultsPage.jsx';
import LeaderboardPage from './components/LeaderboardPage.jsx';
import InfoPage from './components/InfoPage.jsx';
import UnifiedLogin from './components/UnifiedLogin.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import JudgeDashboard from './components/JudgeDashboard.jsx';
import SectorDashboard from './components/SectorDashboard.jsx';
import PrivateRoute from './PrivateRoutes.jsx'; // Import PrivateRoute

// This is where you would import your global CSS file
import './index.css'; 

function App() {
    return (
        <Router>
            <AuthProvider>
                <Navbar />
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/results" element={<ResultsPage />} />
                    <Route path="/leaderboard" element={<LeaderboardPage />} />
                    <Route path="/info" element={<InfoPage />} />
                    <Route path="/login" element={<UnifiedLogin />} />

                    {/* Protected Routes */}
                    <Route path="/admin" element={
                        <PrivateRoute allowedRoles={['admin']}>
                            <AdminDashboard />
                        </PrivateRoute>
                    } />
                    <Route path="/judge" element={
                        <PrivateRoute allowedRoles={['judge']}>
                            <JudgeDashboard />
                        </PrivateRoute>
                    } />
                    <Route path="/sector" element={
                        <PrivateRoute allowedRoles={['sector']}>
                            <SectorDashboard />
                        </PrivateRoute>
                    } />
                    {/* Fallback for unknown routes */}
                    <Route path="*" element={<div className="page-container"><h2>404: Page Not Found</h2><p>The page you are looking for does not exist.</p></div>} />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;
