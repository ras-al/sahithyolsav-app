

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx'; // Correct path to AuthContext

const Navbar = () => {
    const { currentUser, userRole, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/">Sahithyolsav 2025</Link>
            </div>
            <ul className="navbar-nav">
                <li><Link to="/">Home</Link></li>
                <li><Link to="/live-events" className="nav-link">Live Events</Link></li>
                <li><Link to="/results">Results</Link></li>
                <li><Link to="/leaderboard">Leaderboard</Link></li>
                <li><Link to="/info">Info</Link></li>
                {currentUser ? (
                    <>
                        {userRole === 'admin' && <li><Link to="/admin">Admin</Link></li>}
                        {userRole === 'judge' && <li><Link to="/judge">Judge Dashboard</Link></li>}
                        {userRole === 'stage_admin' && <li><Link to="/stage-admin">Stage Admin</Link></li>} {/* New Stage Admin Link */}
                        <li><button onClick={handleLogout} className="btn btn-logout">Logout</button></li>
                    </>
                ) : (
                    <li><Link to="/login">Login</Link></li>
                )}
            </ul>
        </nav>
    );
};

export default Navbar;
