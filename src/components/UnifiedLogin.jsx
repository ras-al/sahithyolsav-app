// Path: src/components/UnifiedLogin.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx'; // Correct path to AuthContext
import { MessageBox } from './UtilityComponents.jsx'; // Import MessageBox

const UnifiedLogin = () => {
    const { login, userRole, loadingAuth } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!loadingAuth && userRole) { // If auth is loaded and user has a role, redirect
            if (userRole === 'admin') {
                navigate('/admin');
            } else if (userRole === 'judge') {
                navigate('/judge');
            } else if (userRole === 'stage_admin') { // New redirection for stage admin
                navigate('/stage-admin');
            }
        }
    }, [userRole, loadingAuth, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        const result = await login(email, password);
        if (result.success) {
            // Redirection is handled by the useEffect once userRole is set by AuthProvider
        } else {
            setMessage(result.message);
        }
    };

    return (
        <div className="form-container">
            <h2>Login</h2>
            <MessageBox message={message} type="error" onClose={() => setMessage('')} />
            <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" className="btn btn-primary">Login</button>
            </form>
        </div>
    );
};

export default UnifiedLogin;
