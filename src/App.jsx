// Path: src/App.jsx

import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext.jsx';
import PrivateRoute from './PrivateRoutes.jsx'; // Import PrivateRoute

// Import all components from the src/components directory
import Navbar from './components/Navbar.jsx';
import HomePage from './components/HomePage.jsx';
import ResultsPage from './components/ResultsPage.jsx';
import LeaderboardPage from './components/LeaderboardPage.jsx';
import InfoPage from './components/InfoPage.jsx';
import UnifiedLogin from './components/UnifiedLogin.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import JudgeDashboard from './components/JudgeDashboard.jsx';
import StageAdminDashboard from './components/StageAdminDashboard.jsx';
import LiveEvents from './components/LiveEvents.jsx'; // Import LiveEvents
import logo from '/logo.png'; // Import the logo image for the splash screen

// This is where you would import your global CSS file
import './index.css';

function App() {
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 3000); // Hold for 3 seconds

        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            {showSplash && (
                <div className="splash-screen">
                    <img src={logo} alt="Sahithyolsav Logo" className="splash-logo-large" />
                </div>
            )}
            <Router>
                <AuthProvider>
                    <Navbar />
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/results" element={<ResultsPage />} />
                        <Route path="/leaderboard" element={<LeaderboardPage />} />
                        <Route path="/info" element={<InfoPage />} />
                        <Route path="/login" element={<UnifiedLogin />} />
                        <Route path="/live-events" element={<LiveEvents />} /> {/* New route for Live Events */}

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
                        <Route path="/stage-admin" element={
                            <PrivateRoute allowedRoles={['stage_admin']}>
                                <StageAdminDashboard />
                            </PrivateRoute>
                        } />
                        {/* Fallback for unknown routes */}
                        <Route path="*" element={<div className="page-container"><h2>404: Page Not Found</h2><p>The page you are looking for does not exist.</p></div>} />
                    </Routes>
                </AuthProvider>
            </Router>
        </>
    );
}

export default App;
