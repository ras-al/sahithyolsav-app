// Path: src/PrivateRoutes.jsx

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx'; // Correct path to AuthContext
import { LoadingSpinner } from './components/UtilityComponents.jsx'; // Import LoadingSpinner

const PrivateRoute = ({ children, allowedRoles }) => {
    const { currentUser, userRole, loadingAuth } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loadingAuth) {
            if (!currentUser) {
                // Not authenticated, redirect to login
                console.log("PrivateRoute: Not authenticated, redirecting to login.");
                navigate('/login');
            } else if (allowedRoles && !allowedRoles.includes(userRole)) {
                // Authenticated but not authorized, redirect to home
                console.log(`PrivateRoute: User '${currentUser.email}' with role '${userRole}' is not allowed. Redirecting to home.`);
                navigate('/'); // Or a dedicated unauthorized page
            }
        }
    }, [currentUser, userRole, loadingAuth, allowedRoles, navigate]);

    // Show loading spinner while authenticating or checking authorization
    if (loadingAuth || !currentUser || (allowedRoles && !allowedRoles.includes(userRole))) {
        return <LoadingSpinner message="Checking access..." />;
    }

    // If authenticated and authorized, render the children components
    return children;
};

export default PrivateRoute;
