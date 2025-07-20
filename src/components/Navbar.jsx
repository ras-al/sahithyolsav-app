// Path: src/components/Navbar.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import logo from '/logo.png'; // Import the logo image

const Navbar = () => {
    const { currentUser, userRole, logout } = useAuth();

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <img src={logo} alt="Sahithyolsav Logo" className="navbar-logo" />
                <Link to="/">Sahithyolsav</Link>
            </div>
            <ul className="navbar-nav">
                <li><Link to="/">Home</Link></li>
                <li><Link to="/live-events">Live Events</Link></li>
                <li><Link to="/results">Results</Link></li>
                <li><Link to="/leaderboard">Leaderboard</Link></li>
                <li><Link to="/info">Info</Link></li>
                {userRole === 'admin' && <li><Link to="/admin">Admin</Link></li>}
                {userRole === 'sector_official' && <li><Link to="/sector-official">Sector Official</Link></li>}
                {userRole === 'stage_admin' && <li><Link to="/stage-admin">Stage Admin</Link></li>} {/* New link for Stage Admin */}
                {/* Removed Judge Dashboard Link as per previous instructions */}
                {/* {userRole === 'judge' && <li><Link to="/judge">Judge</Link></li>} */}
                {/* Removed Sector Official Link as per previous instructions */}
                {/* {userRole === 'sector_official' && <li><Link to="/sector-official">Sector Official</Link></li>} */}

                {currentUser ? (
                    <li><button onClick={logout} className="btn btn-logout">Logout</button></li>
                ) : (
                    <li><Link to="/login" className="btn btn-primary">Login</Link></li>
                )}
            </ul>
        </nav>
    );
};

export default Navbar;
