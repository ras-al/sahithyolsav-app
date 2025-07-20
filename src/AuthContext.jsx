// Path: src/AuthContext.jsx

import React, { useState, useEffect, useContext, createContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { LoadingSpinner } from './components/UtilityComponents.jsx'; // Import LoadingSpinner

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'sahithyolsav-3bc92';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : { 
  apiKey: "AIzaSyAxa4Fg_fyne2DrHdTVTJIwqZDex4FKBOE",
  authDomain: "sahithyolsav-3bc92.firebaseapp.com",
  projectId: "sahithyolsav-3bc92",
  storageBucket: "sahithyolsav-3bc92.firebasestorage.app",
  messagingSenderId: "662466879521",
  appId: "1:662466879521:web:a71a5060ed7076c6fd0360"
};/* Your actual Firebase config for local dev */
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Predefined event categories for the application
const EVENT_CATEGORIES = ["Kids", "LP", "UP", "HS", "HSS", "Junior", "Campus", "Senior", "General", "Campus Girls"];

// Authentication Context
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [userId, setUserId] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [stageDetails, setStageDetails] = useState(null); // New state for stage admin details

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                setUserId(user.uid);
                console.log("Auth state changed: User logged in", user.email, user.uid);

                let role = null;
                if (user.email === 'admin@sahithyolsav.com') {
                    role = 'admin';
                    setStageDetails(null); // Admin doesn't have stage details
                } else if (user.email && user.email.includes('@stage.com')) { // New stage admin role
                    role = 'stage_admin';
                    const stageDocRef = doc(db, `artifacts/${appId}/public/data/stage_admins`, user.uid);
                    const stageDocSnap = await getDoc(stageDocRef);
                    if (stageDocSnap.exists()) {
                        setStageDetails({ id: stageDocSnap.id, ...stageDocSnap.data() });
                    } else {
                        setStageDetails(null);
                        console.warn(`Stage admin details not found for UID: ${user.uid}`);
                    }
                }
                // Removed 'judge' role assignment
                setUserRole(role);
            } else {
                setCurrentUser(null);
                setUserId(null);
                setUserRole(null);
                setStageDetails(null);
                console.log("Auth state changed: No user logged in.");

                if (initialAuthToken) {
                    try {
                        await signInWithCustomToken(auth, initialAuthToken);
                        console.log("Attempted sign-in with custom token.");
                    } catch (error) {
                        console.error("Error signing in with custom token:", error);
                    }
                }
            }
            setLoadingAuth(false);
        });

        return unsubscribe;
    }, []);

    const login = async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log("Logged in successfully! User:", userCredential.user.email, userCredential.user.uid);
            return { success: true, email: userCredential.user.email };
        } catch (error) {
            console.error("Login error:", error);
            let errorMessage = "Invalid credentials. Please try again.";
            if (error.code === 'auth/user-not-found') {
                errorMessage = "User not found. Please check your email.";
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = "Incorrect password. Please try again.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Invalid email format.";
            }
            return { success: false, message: errorMessage };
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            console.log("Logged out successfully!");
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const value = {
        currentUser,
        userId,
        userRole,
        loadingAuth,
        login,
        logout,
        db,
        auth,
        appId,
        stageDetails, // Export stage details
        EVENT_CATEGORIES
    };

    return (
        <AuthContext.Provider value={value}>
            {!loadingAuth && children}
            {loadingAuth && <LoadingSpinner message="Authenticating..." />}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    return useContext(AuthContext);
};
