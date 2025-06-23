import React, { useState, useEffect, useContext, createContext } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';

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

// Predefined event categories
const EVENT_CATEGORIES = ["Kids", "LP", "UP", "HS", "HSS", "Junior", "Campus"];

// Define point schemes for leaderboard based on rank
const RANK_POINT_SCHEMES = {
    group: {
        name: "Group Competition (10/8/5)",
        points: { 1: 10, 2: 8, 3: 5 }
    },
    single: {
        name: "Single Competition (5/3/1)",
        points: { 1: 5, 2: 3, 3: 1 }
    }
};


// Authentication Context
const AuthContext = createContext(null);

// Auth Provider Component
function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true); // To check if auth state is ready
    const [userId, setUserId] = useState(null); // The actual user ID (Firebase UID or null)
    const [userRole, setUserRole] = useState(null); // Stores the role of the logged-in user
    const [sectorDetails, setSectorDetails] = useState(null); // Stores sector name for logged-in sector official


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                setUserId(user.uid);
                console.log("Auth state changed: User logged in", user.email, user.uid);

                let role = null;
                if (user.email === 'admin@sahithyolsav.com') {
                    role = 'admin';
                    setSectorDetails(null); // Clear sector details if admin
                } else if (user.email && user.email.includes('@judge.com')) {
                    role = 'judge';
                    setSectorDetails(null); // Clear sector details if judge
                } else if (user.email && user.email.includes('@sector.com')) {
                    role = 'sector';
                    // Fetch sector details if it's a sector official
                    const sectorDocRef = doc(db, `artifacts/${appId}/public/data/sectors`, user.uid);
                    const sectorDocSnap = await getDoc(sectorDocRef);
                    if (sectorDocSnap.exists()) {
                        setSectorDetails({ id: sectorDocSnap.id, ...sectorDocSnap.data() });
                    } else {
                        setSectorDetails(null); // Sector data not found for UID
                    }
                }
                setUserRole(role);

            } else {
                setCurrentUser(null);
                setUserId(null); // Ensure userId is null if no user
                setUserRole(null); // Clear user role
                setSectorDetails(null); // Clear sector details on logout
                console.log("Auth state changed: No user logged in.");
                // If initialAuthToken was provided (from Canvas env), try to sign in with it
                if (initialAuthToken) {
                    try {
                        await signInWithCustomToken(auth, initialAuthToken);
                        console.log("Attempted sign-in with custom token.");
                        // onAuthStateChanged will be triggered again with the custom token user
                    } catch (error) {
                        console.error("Error signing in with custom token:", error);
                    }
                }
            }
            setLoadingAuth(false); // Set loading to false once initial auth state is determined
        });

        return unsubscribe;
    }, []); // Only run once on mount

    // Manual login function for Admin/Judges/Sectors
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

    // Logout function
    const logout = async () => {
        try {
            await signOut(auth);
            console.log("Logged out successfully!");
            setCurrentUser(null); // Explicitly clear user after logout
            setUserId(null); // Explicitly clear userId after logout
            setUserRole(null); // Explicitly clear user role
            setSectorDetails(null); // Explicitly clear sector details
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const value = {
        currentUser,
        userId,
        userRole, // Expose userRole
        loadingAuth,
        login,
        logout,
        db,
        auth,
        appId,
        sectorDetails
    };

    return (
        <AuthContext.Provider value={value}>
            {!loadingAuth && children}
            {loadingAuth && <LoadingSpinner message="Authenticating..." />}
        </AuthContext.Provider>
    );
}

// Custom Hook for Auth Context
const useAuth = () => {
    return useContext(AuthContext);
};

// --- Utility Components ---

const LoadingSpinner = ({ message = "Loading..." }) => (
    <div className="loading-spinner">
        <div className="spinner"></div>
        <p>{message}</p>
    </div>
);

const MessageBox = ({ message, type = 'info', onClose }) => {
    if (!message) return null;
    return (
        <div className={`message-box message-box-${type}`}>
            <p>{message}</p>
            {onClose && <button onClick={onClose} className="message-box-close">X</button>}
        </div>
    );
};

// Modal Component for showing judge scores
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button onClick={onClose} className="modal-close-button">&times;</button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

// --- Navbar Component ---
const Navbar = () => {
    const { currentUser, userRole, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/'); // Redirect to home after logout
    };

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/">Sahithyolsav 2025</Link>
            </div>
            <ul className="navbar-nav">
                <li><Link to="/">Home</Link></li>
                <li><Link to="/results">Results</Link></li>
                <li><Link to="/leaderboard">Leaderboard</Link></li>
                <li><Link to="/info">Info</Link></li> {/* New link for Info page */}
                {currentUser ? (
                    <>
                        {userRole === 'admin' && <li><Link to="/admin">Admin</Link></li>}
                        {userRole === 'judge' && <li><Link to="/judge">Judge Dashboard</Link></li>}
                        {userRole === 'sector' && <li><Link to="/sector">Sector Dashboard</Link></li>}
                        <li><button onClick={handleLogout} className="btn btn-logout">Logout</button></li>
                    </>
                ) : (
                    <li><Link to="/login">Login</Link></li>
                )}
            </ul>
        </nav>
    );
};

// --- Home Page Component ---
const HomePage = () => {
    const { db, appId } = useAuth();
    const [events, setEvents] = useState([]);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!db) return;

        const eventsColRef = collection(db, `artifacts/${appId}/public/data/events`);
        const unsubscribe = onSnapshot(eventsColRef, (snapshot) => {
            const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEvents(eventsData);
            setMessage('');
        }, (error) => {
            console.error("Error fetching events:", error);
            setMessage("Failed to load events. Please try again.");
        });

        return () => unsubscribe();
    }, [db, appId]);

    const getEventStatus = (event) => {
        const eventDate = new Date(event.date);
        const eventTimeParts = event.time.split(':');
        eventDate.setHours(parseInt(eventTimeParts[0]), parseInt(eventTimeParts[1]));
        const now = new Date();

        if (event.status === 'over') return 'Over';
        if (event.status === 'live') return 'Live Now';
        if (eventDate < now) return 'Over (Not marked as complete)'; // If time passed but not marked 'over'
        if (eventDate > now) return 'Scheduled';
        return 'Unknown';
    };

    const getJudgesForEvent = (event) => {
        if (!event.judges || event.judges.length === 0) return 'No judges assigned yet.';
        return event.judges.map(j => j.name).join(', ');
    };

    return (
        <div className="home-page-container"> {/* New class for overall home page styling */}
            <header className="hero-section">
                <div className="hero-content">
                    <h1>Welcome to Sahithyolsav 2025!</h1>
                    <p className="tagline">Celebrating _th Iritty Division Sahityolsav</p>
                    <p className="event-dates-location">
                        Join us on July 15th & 16th, 2025, in Iritty Division!
                    </p>
                    <div className="hero-buttons">
                        <Link to="/events" className="btn btn-primary btn-large">View Schedule</Link>
                        <Link to="/leaderboard" className="btn btn-secondary btn-large">See Leaderboard</Link>
                    </div>
                </div>
            </header>

            <MessageBox message={message} type={message.includes("Failed") ? 'error' : 'info'} onClose={() => setMessage('')} />

            <section className="events-section home-section"> {/* Added home-section class */}
                <h2>Event Schedule</h2>
                {events.length === 0 ? (
                    <p className="no-data-message">No events scheduled yet. Check back soon!</p>
                ) : (
                    <div className="event-cards-container">
                        {events.map(event => (
                            <div key={event.id} className="event-card">
                                <h3>{event.name}</h3>
                                <p><strong>Date:</strong> {event.date}</p>
                                <p><strong>Time:</strong> {event.time}</p>
                                <p><strong>Location:</strong> {event.location || 'N/A'}</p>
                                <p><strong>Stage:</strong> {event.stage}</p>
                                <p><strong>Category:</strong> {event.category}</p>
                                <p><strong>Status:</strong> <span className={`event-status ${getEventStatus(event).toLowerCase().replace(' (not marked as complete)', '').replace(' ', '-')}`}>{getEventStatus(event)}</span></p>
                                <p><strong>Judges:</strong> {getJudgesForEvent(event)}</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="about-section home-section"> {/* Added home-section class */}
                <h2>About Sahithyolsav</h2>
                <p>
                    Sahithyolsav is an annual cultural extravaganza bringing together artists, writers, and performers
                    from all age groups and sectors within the Iritty Division. Our aim is to foster creativity, promote
                    cultural exchange, and provide a platform for budding talents. This year's event promises to be
                    bigger and better, with a wide array of competitions and showcases designed to inspire and entertain.
                </p>
                <p>
                    From captivating on-stage performances like dance and music to intricate off-stage competitions
                    such as essay writing and painting, Sahithyolsav celebrates every facet of artistic expression.
                    We encourage everyone to participate, cheer for their favorite sectors, and make this event a grand success!
                </p>
            </section>

            <section className="contact-info-section home-section">
                <h2>Get in Touch</h2>
                <p>Have questions or need assistance? Reach out to us!</p>
                <ul>
                    <li><strong>Email:</strong> info@sahithyolsav.com</li>
                    <li><strong>Phone:</strong> +91 98765 43210</li>
                    <li><strong>Address:</strong> Cultural Event Grounds, Iritty Division, Kerala</li>
                </ul>
                <p>For more details, visit our <Link to="/info" className="text-link">Information Page</Link>.</p>
            </section>
        </div>
    );
};

// --- Info Page Component ---
const InfoPage = () => {
    return (
        <div className="page-container info-page">
            <h1>General Information</h1>

            <section className="info-section">
                <h2>Event Overview</h2>
                <p>
                    Sahithyolsav is an annual inter-sector cultural competition hosted by the Iritty Division.
                    It aims to identify and nurture talents in various artistic and literary fields across different age groups.
                    This event promotes healthy competition, cultural exchange, and community bonding.
                </p>
            </section>

            <section className="info-section">
                <h2>Participation Guidelines</h2>
                <ul>
                    <li>Participants must be registered through their respective sectors.</li>
                    <li>Each participant can register for multiple events within their eligible category.</li>
                    <li>Event codes for participants will be assigned by the Admin.</li>
                    <li>Please refer to the detailed rulebook for specific event guidelines.</li>
                </ul>
            </section>

            <section className="info-section">
                <h2>Judging Criteria</h2>
                <p>
                    Our events are judged by experienced and impartial judges. Marks are awarded based on predefined
                    criteria specific to each competition, including creativity, presentation, adherence to rules,
                    and technical skill. The judging process is transparent and aims to ensure fairness.
                </p>
            </section>

            <section className="info-section">
                <h2>Results and Leaderboard</h2>
                <p>
                    Results for individual events will be published on the "Results" page shortly after the completion
                    of judging for that event. The overall sector leaderboard, showcasing cumulative points, will be
                    updated periodically and finalized at the end of the event.
                </p>
            </section>

            <section className="info-section">
                <h2>Contact & Support</h2>
                <p>
                    For any queries regarding registration, events, or general information, please reach out to:
                </p>
                <ul>
                    <li><strong>Event Coordinators:</strong> coordinator@sahithyolsav.com</li>
                    <li><strong>Technical Support:</strong> support@sahithyolsav.com</li>
                    <li><strong>Emergency Contact:</strong> +91 99999 88888</li>
                </ul>
            </section>
        </div>
    );
};


// --- Results Page Component ---
const ResultsPage = () => {
    const { db, appId } = useAuth();
    const [results, setResults] = useState([]);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!db) return;

        const resultsColRef = collection(db, `artifacts/${appId}/public/data/results`);
        const unsubscribe = onSnapshot(resultsColRef, (snapshot) => {
            const resultsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setResults(resultsData);
            setMessage('');
        }, (error) => {
            console.error("Error fetching results:", error);
            setMessage("Failed to load results. Please try again.");
        });

        return () => unsubscribe();
    }, [db, appId]);

    // Group results by category
    const resultsByCategory = results.reduce((acc, result) => {
        const category = result.categoryName || 'Uncategorized';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(result);
        return acc;
    }, {});

    return (
        <div className="page-container">
            <h1>Event Results</h1>
            <MessageBox message={message} type={message.includes("Failed") ? 'error' : 'info'} onClose={() => setMessage('')} />
            {Object.keys(resultsByCategory).length === 0 ? (
                <p className="no-data-message">No results posted yet. Check back after the events!</p>
            ) : (
                Object.entries(resultsByCategory).map(([category, eventsInCat]) => (
                    <section key={category} className="results-category-section">
                        <h2>Category: {category}</h2>
                        <div className="results-events-container">
                            {/* Display results in a table format */}
                            <table className="results-table">
                                <thead>
                                    <tr>
                                        <th>Event</th>
                                        <th>Competition Type</th>
                                        <th>1st Place</th>
                                        <th>2nd Place</th>
                                        <th>3rd Place</th>
                                        <th>Poster</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {eventsInCat.map(eventResult => (
                                        <tr key={eventResult.id}>
                                            <td>{eventResult.eventName || 'N/A'}</td>
                                            <td>{eventResult.competitionType || 'N/A'}</td>
                                            {[1, 2, 3].map(rank => {
                                                const placement = eventResult.placements?.find(p => p.rank === rank);
                                                return (
                                                    <td key={rank}>
                                                        {placement ? (
                                                            `${placement.participantName} (${placement.pointsAwarded} pts)`
                                                        ) : (
                                                            'Not Participated'
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td>
                                                {eventResult.posterBase64 && (
                                                    <img src={eventResult.posterBase64} alt={`Poster for ${eventResult.eventName}`} className="results-table-poster" />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ))
            )}
        </div>
    );
};

// --- Leaderboard Page Component ---
const LeaderboardPage = () => {
    const { db, appId } = useAuth();
    const [leaderboardSummary, setLeaderboardSummary] = useState(null); // Stores the full summary
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!db) return;

        const leaderboardSummaryDocRef = doc(db, `artifacts/${appId}/public/data/leaderboard_summary`, 'current_leaderboard');
        const unsubscribe = onSnapshot(leaderboardSummaryDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setLeaderboardSummary(data);
                setMessage('');
            } else {
                setLeaderboardSummary(null);
                setMessage("No leaderboard data available. Admin needs to recalculate.");
            }
        }, (error) => {
            console.error("Error fetching leaderboard:", error);
            setMessage("Failed to load leaderboard. Please try again.");
        });

        return () => unsubscribe();
    }, [db, appId]);

    if (!leaderboardSummary) {
        return (
            <div className="page-container">
                <h1>Live Leaderboard</h1>
                <MessageBox message={message} type={message.includes("Failed") ? 'error' : 'info'} onClose={() => setMessage('')} />
                <p className="no-data-message">Loading leaderboard data or no data available. Please check back later or contact the admin.</p>
            </div>
        );
    }

    const { sortedLeaderboard, sectorCategoryScores } = leaderboardSummary;

    return (
        <div className="page-container">
            <h1>Live Leaderboard</h1>
            <MessageBox message={message} type={message.includes("Failed") ? 'error' : 'info'} onClose={() => setMessage('')} />
            {sortedLeaderboard.length === 0 && Object.keys(sectorCategoryScores || {}).length === 0 ? (
                <p className="no-data-message">No scores recorded yet. The leaderboard will update as events conclude or when the Admin recalculates it!</p>
            ) : (
                <div className="leaderboard-table-container">
                    <table className="leaderboard-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Sector</th>
                                <th>Total Score</th>
                                {EVENT_CATEGORIES.map(category => (
                                    <th key={category}>{category}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedLeaderboard.map((item, index) => (
                                <tr key={item.sector} className={index === 0 ? 'top-sector-row' : ''}>
                                    <td>#{index + 1}</td>
                                    <td className="sector-name-cell">{item.sector}</td>
                                    <td className="total-score-cell">{item.totalScore}</td>
                                    {EVENT_CATEGORIES.map(category => (
                                        <td key={category}>
                                            {sectorCategoryScores && sectorCategoryScores[item.sector]
                                                ? (sectorCategoryScores[item.sector][category] || 0)
                                                : 0}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// --- Unified Login Component ---
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
            } else if (userRole === 'sector') {
                navigate('/sector');
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


// --- PrivateRoute Component for role-based access ---
const PrivateRoute = ({ children, allowedRoles }) => {
    const { currentUser, userRole, loadingAuth } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loadingAuth) {
            if (!currentUser) {
                // Not authenticated, redirect to login
                navigate('/login');
            } else if (allowedRoles && !allowedRoles.includes(userRole)) {
                // Authenticated but not authorized, redirect to home or unauthorized page
                navigate('/'); // Or a dedicated unauthorized page
            }
        }
    }, [currentUser, userRole, loadingAuth, allowedRoles, navigate]);

    if (loadingAuth || !currentUser || (allowedRoles && !allowedRoles.includes(userRole))) {
        return <LoadingSpinner message="Checking access..." />;
    }

    return children;
};


// --- Admin Dashboard Component ---
const AdminDashboard = () => {
    const { currentUser, db, auth, appId } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('events'); // 'events', 'judges', 'participants', 'results', 'leaderboard', 'sectors'
    const [message, setMessage] = useState('');
    const [judges, setJudges] = useState([]);
    const [events, setEvents] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [sectors, setSectors] = useState([]); // New state for sectors

    // Redirect if not admin (handled by PrivateRoute, but a fallback is good)
    useEffect(() => {
        if (!currentUser || currentUser.email !== 'admin@sahithyolsav.com') {
            console.log("AdminDashboard: Not authorized or not admin, redirecting to login.");
            // navigate('/login'); // PrivateRoute already handles this
        }
    }, [currentUser, navigate]);

    // Fetch judges, events, participants, and sectors
    useEffect(() => {
        if (!db) return;

        const unsubscribeJudges = onSnapshot(collection(db, `artifacts/${appId}/public/data/judges`), (snapshot) => {
            setJudges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching judges:", error));

        const unsubscribeEvents = onSnapshot(collection(db, `artifacts/${appId}/public/data/events`), (snapshot) => {
            setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching events:", error));

        const unsubscribeParticipants = onSnapshot(collection(db, `artifacts/${appId}/public/data/participants`), (snapshot) => {
            setParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching participants:", error));

        // New subscription for sectors
        const unsubscribeSectors = onSnapshot(collection(db, `artifacts/${appId}/public/data/sectors`), (snapshot) => {
            setSectors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching sectors:", error));


        return () => {
            unsubscribeJudges();
            unsubscribeEvents();
            unsubscribeParticipants();
            unsubscribeSectors(); // Cleanup new subscription
        };
    }, [db, appId]);

    // Admin-specific sub-components

    const ManageEvents = () => {
        const [eventName, setEventName] = useState('');
        const [eventDate, setEventDate] = useState('');
        const [eventTime, setEventTime] = useState('');
        const [eventLocation, setEventLocation] = useState(''); // New state for location
        const [eventStage, setEventStage] = useState('on-stage');
        const [eventCategory, setEventCategory] = useState(EVENT_CATEGORIES[0]); // Default to first category
        const [competitionType, setCompetitionType] = useState('single'); // 'single' or 'group'
        const [totalMarks, setTotalMarks] = useState(100);
        const [selectedJudgeIds, setSelectedJudgeIds] = useState([]); // Store IDs
        const [judgeMarkDistribution, setJudgeMarkDistribution] = useState({}); // {judgeId: marks}
        const [isViewScoresModalOpen, setIsViewScoresModalOpen] = useState(false);
        const [scoresForEvent, setScoresForEvent] = useState([]);
        const [selectedEventForScores, setSelectedEventForScores] = useState(null);
        const [editingEventId, setEditingEventId] = useState(null); // New state for editing


        const handleAddEvent = async (e) => {
            e.preventDefault();
            setMessage('');

            if (selectedJudgeIds.length > 3) {
                setMessage("An event can have a maximum of 3 judges.");
                return;
            }

            const currentJudges = judges.filter(j => selectedJudgeIds.includes(j.id));
            const judgesWithNames = currentJudges.map(j => ({ id: j.id, name: j.name }));

            // Calculate sum of distributed marks
            const distributedSum = Object.values(judgeMarkDistribution).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
            if (distributedSum !== parseInt(totalMarks)) {
                setMessage("Sum of judge marks must equal total marks for the event.");
                return;
            }

            try {
                const eventData = {
                    name: eventName,
                    date: eventDate,
                    time: eventTime,
                    location: eventLocation,
                    stage: eventStage,
                    category: eventCategory,
                    competitionType: competitionType,
                    totalMarks: parseInt(totalMarks),
                    judges: judgesWithNames,
                    markDistribution: judgeMarkDistribution,
                    status: 'scheduled'
                };

                if (editingEventId) {
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/events`, editingEventId), eventData);
                    setMessage("Event updated successfully!");
                    setEditingEventId(null);
                } else {
                    await addDoc(collection(db, `artifacts/${appId}/public/data/events`), eventData);
                    setMessage("Event added successfully!");
                }
                setEventName('');
                setEventDate('');
                setEventTime('');
                setEventLocation('');
                setEventCategory(EVENT_CATEGORIES[0]);
                setCompetitionType('single');
                setTotalMarks(100);
                setSelectedJudgeIds([]);
                setJudgeMarkDistribution({});
            }
            catch (error) {
                console.error("Error adding/updating event:", error);
                setMessage("Failed to add/update event: " + error.message);
            }
        };

        const handleEditEvent = (event) => {
            setEditingEventId(event.id);
            setEventName(event.name);
            setEventDate(event.date);
            setEventTime(event.time);
            setEventLocation(event.location || '');
            setEventStage(event.stage);
            setEventCategory(event.category);
            setCompetitionType(event.competitionType || 'single'); // Default if not set
            setTotalMarks(event.totalMarks);
            setSelectedJudgeIds(event.judges?.map(j => j.id) || []);
            setJudgeMarkDistribution(event.markDistribution || {});
        };


        const handleJudgeSelection = (e) => {
            const options = Array.from(e.target.selectedOptions).map(option => option.value);
            setSelectedJudgeIds(options);

            // Initialize mark distribution for newly selected judges
            const newDistribution = {};
            options.forEach(id => {
                newDistribution[id] = judgeMarkDistribution[id] || 0; // Keep existing or set to 0
            });
            setJudgeMarkDistribution(newDistribution);
        };

        const handleMarkDistributionChange = (judgeId, value) => {
            setJudgeMarkDistribution(prev => ({
                ...prev,
                [judgeId]: parseInt(value) || 0
            }));
        };

        const handleSetLiveStatus = async (eventId, currentStatus) => {
            setMessage('');
            try {
                const eventDocRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
                const newStatus = currentStatus === 'live' ? 'scheduled' : 'live'; // Toggle
                await updateDoc(eventDocRef, { status: newStatus });
                setMessage(`Event status updated to "${newStatus}"!`);
            } catch (error) {
                console.error("Error updating event status:", error);
                setMessage("Failed to update event status: " + error.message);
            }
        };

        const handleMarkOver = async (eventId) => {
            setMessage('');
            try {
                const eventDocRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
                await updateDoc(eventDocRef, { status: 'over' });
                setMessage("Event marked as 'over'!");
            } catch (error) {
                console.error("Error marking event over:", error);
                setMessage("Failed to mark event over: " + error.message);
            }
        };

        const handleDeleteEvent = async (eventId) => {
            if (!window.confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
                return;
            }
            setMessage('');
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/events`, eventId));
                setMessage("Event deleted successfully!");
            } catch (error) {
                console.error("Error deleting event:", error);
                setMessage("Failed to delete event: " + error.message);
            }
        };

        const handleViewJudgeScores = async (event) => {
            setMessage('');
            try {
                const scoresQuery = query(
                    collection(db, `artifacts/${appId}/public/data/scores`),
                    where('eventId', '==', event.id)
                );
                const scoresSnapshot = await getDocs(scoresQuery);
                const fetchedScores = scoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Enrich scores with participant and judge names
                const enrichedScores = fetchedScores.map(score => {
                    const participant = participants.find(p => p.id === score.participantId);
                    const judge = judges.find(j => j.id === score.judgeId);
                    return {
                        ...score,
                        participantName: participant ? participant.name : 'Unknown Participant',
                        judgeName: judge ? judge.name : 'Unknown Judge'
                    };
                });

                setScoresForEvent(enrichedScores);
                setSelectedEventForScores(event);
                setIsViewScoresModalOpen(true);
            } catch (error) {
                console.error("Error fetching judge scores for event:", error);
                setMessage("Failed to fetch judge scores: " + error.message);
            }
        };

        const handleProcessEventRanks = async (event) => {
            setMessage('');
            try {
                // Determine the point scheme based on event's competitionType
                const competitionTypeKey = event.competitionType || 'single'; // Default to single
                const currentRankPoints = RANK_POINT_SCHEMES[competitionTypeKey]?.points;

                if (!currentRankPoints) {
                    setMessage(`Error: No point scheme defined for competition type '${competitionTypeKey}'.`);
                    return;
                }
                console.log(`Using rank points scheme for '${competitionTypeKey}' competition:`, currentRankPoints);


                const eventScoresQuery = query(
                    collection(db, `artifacts/${appId}/public/data/scores`),
                    where('eventId', '==', event.id)
                );
                const scoresSnapshot = await getDocs(scoresQuery);
                const scoresData = scoresSnapshot.docs.map(doc => doc.data());

                const participantTotalScores = {}; // { participantId: totalMarks }

                scoresData.forEach(score => {
                    if (participantTotalScores[score.participantId]) {
                        participantTotalScores[score.participantId] += score.marks;
                    } else {
                        participantTotalScores[score.participantId] = score.marks;
                    }
                });

                // Convert to array of { participantId, totalScore } for sorting
                const rankedParticipants = Object.entries(participantTotalScores)
                    .map(([participantId, totalScore]) => ({ participantId, totalScore }))
                    .sort((a, b) => b.totalScore - a.totalScore); // Sort by total score (highest first)

                // Clear existing rank points for this event to prevent duplicates on re-processing
                const existingRankPointsQuery = query(
                    collection(db, `artifacts/${appId}/public/data/event_rank_points`),
                    where('eventId', '==', event.id)
                );
                const existingRankPointsSnapshot = await getDocs(existingRankPointsQuery);
                const deletePromises = existingRankPointsSnapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);


                for (let i = 0; i < rankedParticipants.length; i++) {
                    const participant = rankedParticipants[i];
                    const participantDetails = participants.find(p => p.id === participant.participantId);

                    let currentRank = 0;
                    // Handle ties by giving same rank if scores are identical
                    if (i > 0 && participant.totalScore === rankedParticipants[i - 1].totalScore) {
                        currentRank = rankedParticipants[i - 1].rank; // Inherit rank from previous tied participant
                    } else {
                        currentRank = i + 1;
                    }

                    const pointsToAward = currentRankPoints[currentRank] || 0; // Get points from the selected scheme

                    // Only save if points are awarded (i.e., for 1st, 2nd, 3rd)
                    if (pointsToAward > 0) {
                        // Store rank points in a new collection
                        await addDoc(collection(db, `artifacts/${appId}/public/data/event_rank_points`), {
                            eventId: event.id,
                            eventName: event.name,
                            participantId: participant.participantId,
                            participantName: participantDetails ? participantDetails.name : 'Unknown Participant',
                            participantSector: participantDetails ? participantDetails.sector : 'Unknown Sector',
                            participantCategory: event.category, // Use event category for consistency
                            rank: currentRank,
                            pointsAwarded: pointsToAward,
                            participantEventTotalScore: participant.totalScore, // Save the actual total score from judges
                            competitionType: competitionTypeKey, // Store competition type with rank points
                            timestamp: new Date().toISOString()
                        });
                        setMessage(`Processed ranks for event ${event.name}. ${participantDetails?.name} got ${pointsToAward} points.`);
                    }
                }
                setMessage(`Ranks processed for event: ${event.name}. Remember to recalculate leaderboard.`);
            } catch (error) {
                console.error("Error processing event ranks:", error);
                setMessage("Failed to process event ranks: " + error.message);
            }
        };

        // Function to download participant list as Excel (CSV for simplicity)
        const handleDownloadParticipantsExcel = async (eventId, eventName, participantsInEvent) => {
            setMessage('');
            try {
                // Headers for the CSV
                const headers = ["Participant Code", "Name", "Class", "Age", "Sector", "Unit", "Category"];

                // Map participant data for CSV rows
                const csvRows = participantsInEvent.map(p => {
                    const eventEntry = p.events.find(e => e.eventId === eventId);
                    const code = eventEntry ? eventEntry.code : 'N/A';
                    return [
                        code,
                        p.name,
                        p.class,
                        p.age,
                        p.sector,
                        p.unit,
                        p.category
                    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','); // Double quotes for CSV fields
                });

                const csvContent = [headers.join(','), ...csvRows].join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', `${eventName.replace(/[^a-zA-Z0-9]/g, '_')}_Participants.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                setMessage(`Participant list for "${eventName}" downloaded successfully!`);
            } catch (error) {
                console.error("Error downloading participant list:", error);
                setMessage("Failed to download participant list: " + error.message);
            }
        };


        // Function to download event poster (if base64 is stored directly)
        const handleDownloadPoster = (base64Data, eventName) => {
            setMessage('');
            if (!base64Data) {
                setMessage("No poster available for this event.");
                return;
            }
            try {
                // Extract MIME type from base64 string (e.g., data:image/png;base64,...)
                const mimeTypeMatch = base64Data.match(/^data:(.*?);base64,/);
                const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
                const fileExtension = mimeType.split('/')[1] || 'png';

                const link = document.createElement('a');
                link.href = base64Data;
                link.download = `${eventName.replace(/[^a-zA-Z0-9]/g, '_')}_Poster.${fileExtension}`; // Sanitize filename
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setMessage(`Poster for "${eventName}" downloaded successfully!`);
            } catch (error) {
                console.error("Error downloading poster:", error);
                setMessage("Failed to download poster: " + error.message);
            }
        };


        // Group events by category for display
        const eventsByCategory = events.reduce((acc, event) => {
            const category = event.category || 'Uncategorized';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(event);
            return acc;
        }, {});


        return (
            <div className="admin-section">
                <h3>Manage Events</h3>
                <form onSubmit={handleAddEvent} className="form-card">
                    <h4>{editingEventId ? 'Edit Event' : 'Add New Event'}</h4>
                    <div className="form-group">
                        <label>Event Name:</label>
                        <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Date (YYYY-MM-DD):</label>
                        <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Time:</label>
                        <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} required />
                    </div>
                     <div className="form-group">
                        <label>Location (e.g., Room 3, Main Hall):</label>
                        <input type="text" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Stage:</label>
                        <select value={eventStage} onChange={(e) => setEventStage(e.target.value)}>
                            <option value="on-stage">On Stage</option>
                            <option value="off-stage">Off Stage</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Category:</label>
                        <select value={eventCategory} onChange={(e) => setEventCategory(e.target.value)} required>
                            {EVENT_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Competition Type:</label>
                        <select value={competitionType} onChange={(e) => setCompetitionType(e.target.value)} required>
                            <option value="single">Single Competition</option>
                            <option value="group">Group Competition</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Total Marks:</label>
                        <input type="number" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} min="1" required />
                    </div>
                    <div className="form-group">
                        <label>Assign Judges (Max 3):</label>
                        <select multiple value={selectedJudgeIds} onChange={handleJudgeSelection} className="multi-select">
                            {judges.map(judge => (
                                <option key={judge.id} value={judge.id}>{judge.name} ({judge.email})</option>
                            ))}
                        </select>
                        <small>Hold Ctrl/Cmd to select multiple.</small>
                    </div>
                    {selectedJudgeIds.length > 0 && (
                        <div className="form-group judge-mark-distribution">
                            <label>Mark Distribution per Judge:</label>
                            {selectedJudgeIds.map(judgeId => {
                                const judge = judges.find(j => j.id === judgeId);
                                return (
                                    <div key={judgeId} className="judge-mark-input">
                                        <span>{judge?.name || 'Unknown Judge'}:</span>
                                        <input
                                            type="number"
                                            value={judgeMarkDistribution[judgeId] || 0}
                                            onChange={(e) => handleMarkDistributionChange(judgeId, e.target.value)}
                                            min="0"
                                            max={totalMarks}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <button type="submit" className="btn btn-primary">{editingEventId ? 'Update Event' : 'Add Event'}</button>
                    {editingEventId && <button type="button" className="btn btn-secondary" onClick={() => {
                        setEditingEventId(null);
                        setEventName('');
                        setEventDate('');
                        setEventTime('');
                        setEventLocation('');
                        setEventCategory(EVENT_CATEGORIES[0]);
                        setCompetitionType('single');
                        setTotalMarks(100);
                        setSelectedJudgeIds([]);
                        setJudgeMarkDistribution({});
                    }}>Cancel Edit</button>}
                </form>

                <div className="list-section">
                    <h4>Current Events</h4>
                    {Object.keys(eventsByCategory).length === 0 ? (
                        <p>No events added yet.</p>
                    ) : (
                        Object.entries(eventsByCategory).map(([category, eventsInCat]) => (
                            <div key={category} className="event-category-group">
                                <h5>Category: {category}</h5>
                                <div className="event-list-cards">
                                    {eventsInCat.map(event => (
                                        <div key={event.id} className="list-card event-list-card">
                                            <p><strong>{event.name}</strong> ({event.category})</p>
                                            <p>Date: {event.date}, Time: {event.time}</p>
                                            <p>Location: {event.location || 'N/A'}</p> {/* Display Location */}
                                            <p>Stage: {event.stage}, Type: {event.competitionType || 'N/A'}, Total Marks: {event.totalMarks}</p>
                                            <p>Judges: {event.judges.map(j => j.name).join(', ')}</p>
                                            <p>Mark Dist: {Object.entries(event.markDistribution || {}).map(([jId, marks]) => `${judges.find(j => j.id === jId)?.name || jId}: ${marks}`).join(', ')}</p>
                                            <p>Status: <span className={`event-status ${event.status}`}>{event.status}</span></p>
                                            <div className="card-actions">
                                                <button
                                                    className={`btn ${event.status === 'live' ? 'btn-warn' : 'btn-success'}`}
                                                    onClick={() => handleSetLiveStatus(event.id, event.status)}
                                                >
                                                    {event.status === 'live' ? 'Mark Scheduled' : 'Go Live'}
                                                </button>
                                                <button
                                                    className="btn btn-info"
                                                    onClick={() => handleMarkOver(event.id)}
                                                    disabled={event.status === 'over'}
                                                >
                                                    Mark Over
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => handleEditEvent(event)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="btn btn-danger"
                                                    onClick={() => handleDeleteEvent(event.id)}
                                                >
                                                    Delete
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => handleViewJudgeScores(event)}
                                                >
                                                    View Judge Scores
                                                </button>
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={() => handleProcessEventRanks(event)}
                                                    disabled={event.status !== 'live' && event.status !== 'over'} // Only process for live/over events
                                                >
                                                    Process Event Ranks
                                                </button>
                                                <button
                                                    className="btn btn-info btn-small"
                                                    onClick={() => handleDownloadPoster(event.posterBase64, event.name)}
                                                    disabled={!event.posterBase64} // Disable if no poster
                                                >
                                                    Download Poster
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <Modal
                    isOpen={isViewScoresModalOpen}
                    onClose={() => setIsViewScoresModalOpen(false)}
                    title={`Judge Scores for ${selectedEventForScores?.name || ''}`}
                >
                    {scoresForEvent.length === 0 ? (
                        <p>No judge scores submitted for this event yet.</p>
                    ) : (
                        <table className="modal-table">
                            <thead>
                                <tr>
                                    <th>Participant</th>
                                    <th>Judge</th>
                                    <th>Marks</th>
                                    <th>Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scoresForEvent.map(score => (
                                    <tr key={score.id}>
                                        <td>{score.participantName}</td>
                                        <td>{score.judgeName}</td>
                                        <td>{score.marks}</td>
                                        <td>{new Date(score.timestamp).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Modal>
            </div>
        );
    };

    const ManageJudges = () => {
        const [judgeName, setJudgeName] = useState('');
        const [judgeEmail, setJudgeEmail] = useState(''); // This will be the UID
        const [judgePassword, setJudgePassword] = useState('');
        const [editingJudgeId, setEditingJudgeId] = useState(null); // State for editing

        const handleAddJudge = async (e) => {
            e.preventDefault();
            setMessage('');
            try {
                if (editingJudgeId) {
                    // Update existing judge
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/judges`, editingJudgeId), {
                        name: judgeName,
                        email: judgeEmail,
                    });
                    setMessage(`Judge ${judgeName} updated successfully.`);
                    setEditingJudgeId(null);
                } else {
                    // Create new user in Firebase Authentication
                    const userCredential = await createUserWithEmailAndPassword(auth, judgeEmail, judgePassword);
                    const judgeId = userCredential.user.uid;

                    // Add judge details to Firestore
                    await setDoc(doc(db, `artifacts/${appId}/public/data/judges`, judgeId), {
                        name: judgeName,
                        email: judgeEmail,
                    });
                    setMessage(`Judge ${judgeName} added successfully with email: ${judgeEmail}. Password is NOT stored.`);
                }
                setJudgeName('');
                setJudgeEmail('');
                setJudgePassword(''); // Always clear password field
            } catch (error) {
                console.error("Error adding/updating judge:", error);
                setMessage("Failed to add/update judge: " + error.message);
            }
        };

        const handleEditJudge = (judge) => {
            setEditingJudgeId(judge.id);
            setJudgeName(judge.name);
            setJudgeEmail(judge.email);
            setJudgePassword(''); // Do not pre-fill password for security
        };


        const handleDeleteJudge = async (judgeId, judgeEmailToDelete) => {
            if (!window.confirm(`Are you sure you want to delete judge ${judgeEmailToDelete}? This will remove them from the system.`)) {
                return;
            }
            setMessage('');
            try {
                // Delete from Firestore
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/judges`, judgeId));

                // Note: Deleting user from Firebase Auth programmatically requires Admin SDK (backend).
                // For a client-side app like this, a true user deletion would need a Cloud Function or manual deletion from Firebase console.
                // We'll just remove them from our 'judges' collection, effectively disabling their access to judge features.
                setMessage(`Judge ${judgeEmailToDelete} deleted from database. Remember to manually delete their user from Firebase Authentication if needed.`);

            } catch (error) {
                console.error("Error deleting judge:", error);
                setMessage("Failed to delete judge: " + error.message);
            }
        };

        return (
            <div className="admin-section">
                <h3>Manage Judges</h3>
                <form onSubmit={handleAddJudge} className="form-card">
                    <h4>{editingJudgeId ? 'Edit Judge' : 'Add New Judge'}</h4>
                    <div className="form-group">
                        <label>Judge Name:</label>
                        <input type="text" value={judgeName} onChange={(e) => setJudgeName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Judge Email (Unique ID, e.g., judge1@sahithyolsav.com):</label>
                        <input type="email" value={judgeEmail} onChange={(e) => setJudgeEmail(e.target.value)} required />
                    </div>
                    {!editingJudgeId && ( // Only show password field for new judge creation
                        <div className="form-group">
                            <label>Temporary Password:</label>
                            <input type="password" value={judgePassword} onChange={(e) => setJudgePassword(e.target.value)} required minLength="6" />
                            <small>Password must be at least 6 characters.</small>
                        </div>
                    )}
                    <button type="submit" className="btn btn-primary">{editingJudgeId ? 'Update Judge' : 'Add Judge'}</button>
                    {editingJudgeId && <button type="button" className="btn btn-secondary" onClick={() => {
                        setEditingJudgeId(null);
                        setJudgeName('');
                        setJudgeEmail('');
                        setJudgePassword('');
                    }}>Cancel Edit</button>}
                </form>

                <div className="list-section">
                    <h4>Current Judges</h4>
                    {judges.length === 0 ? <p>No judges added yet.</p> : (
                        <div className="list-cards">
                            {judges.map(judge => (
                                <div key={judge.id} className="list-card">
                                    <p><strong>{judge.name}</strong></p>
                                    <p>Email: {judge.email}</p>
                                    <div className="card-actions">
                                        <button
                                            className="btn btn-secondary btn-small"
                                            onClick={() => handleEditJudge(judge)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn btn-danger btn-small"
                                            onClick={() => handleDeleteJudge(judge.id, judge.email)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const ManageParticipants = () => {
        const [participantName, setParticipantName] = useState('');
        const [participantClass, setParticipantClass] = useState('');
        const [participantAge, setParticipantAge] = useState('');
        const [participantSector, setParticipantSector] = useState('');
        const [participantUnit, setParticipantUnit] = useState('');
        const [participantCategory, setParticipantCategory] = useState(EVENT_CATEGORIES[0]);
        const [selectedEvents, setSelectedEvents] = useState([]); // Event IDs only
        const [participantEventCodes, setParticipantEventCodes] = useState({}); // {eventId: 'A'}
        const [editingParticipantId, setEditingParticipantId] = useState(null); // State for editing

        // Filtered events based on selected participant category
        const filteredEventsForParticipant = events.filter(event => event.category === participantCategory);

        // Populate participantEventCodes when editing a participant
        useEffect(() => {
            if (editingParticipantId) {
                const participantToEdit = participants.find(p => p.id === editingParticipantId);
                if (participantToEdit && participantToEdit.events) {
                    const codesMap = {};
                    participantToEdit.events.forEach(e => {
                        if (typeof e === 'object' && e !== null && e.eventId && e.code) { // Check for new structure
                            codesMap[e.eventId] = e.code;
                        } else if (typeof e === 'string') { // Handle old structure if needed, assign empty code
                             codesMap[e] = '';
                        }
                    });
                    setSelectedEvents(participantToEdit.events.map(e => (typeof e === 'object' ? e.eventId : e)));
                    setParticipantEventCodes(codesMap);
                }
            } else {
                setParticipantEventCodes({}); // Clear when not editing
            }
        }, [editingParticipantId, participants]);


        const handleAddParticipant = async (e) => {
            e.preventDefault();
            setMessage('');
            try {
                // Map selected events with their assigned codes
                const eventsWithCodes = selectedEvents.map(eventId => ({
                    eventId: eventId,
                    code: participantEventCodes[eventId] || '' // Ensure code is included
                }));

                const participantData = {
                    name: participantName,
                    class: participantClass,
                    age: parseInt(participantAge),
                    sector: participantSector,
                    unit: participantUnit,
                    category: participantCategory,
                    events: eventsWithCodes, // Store events with codes
                };

                if (editingParticipantId) {
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/participants`, editingParticipantId), participantData);
                    setMessage("Participant updated successfully!");
                    setEditingParticipantId(null);
                } else {
                    await addDoc(collection(db, `artifacts/${appId}/public/data/participants`), participantData);
                    setMessage("Participant added successfully!");
                }

                setParticipantName('');
                setParticipantClass('');
                setParticipantAge('');
                setParticipantSector('');
                setParticipantUnit('');
                setParticipantCategory(EVENT_CATEGORIES[0]);
                setSelectedEvents([]);
                setParticipantEventCodes({});
            } catch (error) {
                console.error("Error adding/updating participant:", error);
                setMessage("Failed to add/update participant: " + error.message);
            }
        };

        const handleEditParticipant = (participant) => {
            setEditingParticipantId(participant.id);
            setParticipantName(participant.name);
            setParticipantClass(participant.class);
            setParticipantAge(participant.age);
            setParticipantSector(participant.sector);
            setParticipantUnit(participant.unit);
            setParticipantCategory(participant.category);
            // Re-populate selectedEvents and participantEventCodes from participant.events
            if (participant.events) {
                const eventIds = [];
                const codesMap = {};
                // Ensure participant.events is treated as an array of objects for consistency
                participant.events.forEach(eventEntry => {
                    if (typeof eventEntry === 'object' && eventEntry !== null && eventEntry.eventId) {
                        eventIds.push(eventEntry.eventId);
                        codesMap[eventEntry.eventId] = eventEntry.code || '';
                    } else if (typeof eventEntry === 'string') { // Handle older structure without codes
                        eventIds.push(eventEntry);
                        codesMap[eventEntry] = ''; // No code for old format
                    }
                });
                setSelectedEvents(eventIds);
                setParticipantEventCodes(codesMap);
            } else {
                setSelectedEvents([]);
                setParticipantEventCodes({});
            }
        };

        // This function updates the local 'participants' state for immediate UI feedback.
        // The actual Firestore update is triggered by 'handleUpdateParticipantCode'.
        const handleEventCodeChangeLocal = (participantId, eventId, code) => {
            const formattedCode = code.toUpperCase().replace(/[^A-Z]/g, ''); // Keep only A-Z
            setParticipants(prevParticipants => prevParticipants.map(p => {
                if (p.id === participantId) {
                    const updatedEvents = p.events.map(e => {
                        if (typeof e === 'object' && e.eventId === eventId) {
                            return { ...e, code: formattedCode.slice(0, 1) }; // Take only first char
                        }
                        return e;
                    });
                    return { ...p, events: updatedEvents };
                }
                return p;
            }));
        };

        const handleUpdateParticipantCode = async (participantId, eventId, newCode) => {
            setMessage('');
            try {
                const participantRef = doc(db, `artifacts/${appId}/public/data/participants`, participantId);
                const participantSnap = await getDoc(participantRef);

                if (participantSnap.exists()) {
                    const participantData = participantSnap.data();
                    const updatedEvents = participantData.events.map(eventEntry => {
                        if (typeof eventEntry === 'object' && eventEntry.eventId === eventId) {
                            return { ...eventEntry, code: newCode };
                        } else if (typeof eventEntry === 'string' && eventEntry === eventId) { // Fallback for old structure
                            return { eventId: eventEntry, code: newCode };
                        }
                        return eventEntry;
                    });

                    await updateDoc(participantRef, { events: updatedEvents });
                    setMessage(`Participant code for ${participants.find(p => p.id === participantId)?.name} in event ${events.find(e => e.id === eventId)?.name} updated to ${newCode}.`);
                } else {
                    setMessage("Participant not found.");
                }
            } catch (error) {
                console.error("Error updating participant code:", error);
                setMessage("Failed to update participant code: " + error.message);
            }
        };


        const handleDeleteParticipant = async (participantId) => {
            if (!window.confirm("Are you sure you want to delete this participant?")) {
                return;
            }
            setMessage('');
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/participants`, participantId));
                setMessage("Participant deleted successfully!");
            } catch (error) {
                console.error("Error deleting participant:", error);
                setMessage("Failed to delete participant: " + error.message);
            }
        };

        // Group participants by event, then by category for easier display
        const participantsByEventAndCategory = EVENT_CATEGORIES.reduce((catAcc, category) => {
            catAcc[category] = {};
            const eventsInThisCategory = events.filter(e => e.category === category);

            eventsInThisCategory.forEach(event => {
                const participantsForThisEvent = participants.filter(p =>
                    p.category === category && // Ensure participant's main category matches event's category
                    p.events && p.events.some(e => e.eventId === event.id)
                );

                if (participantsForThisEvent.length > 0) {
                    catAcc[category][event.id] = participantsForThisEvent.map(p => {
                        const eventEntry = p.events.find(e => e.eventId === event.id);
                        return {
                            ...p,
                            assignedCode: eventEntry ? eventEntry.code : '' // Get the code assigned for this specific event
                        };
                    }).sort((a, b) => a.assignedCode.localeCompare(b.assignedCode)); // Sort participants by their assigned code
                }
            });
            return catAcc;
        }, {});


        return (
            <div className="admin-section">
                <h3>Manage Participants</h3>
                <form onSubmit={handleAddParticipant} className="form-card">
                    <h4>{editingParticipantId ? 'Edit Participant' : 'Add New Participant'}</h4>
                    <div className="form-group">
                        <label>Name:</label>
                        <input type="text" value={participantName} onChange={(e) => setParticipantName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Class:</label>
                        <input type="text" value={participantClass} onChange={(e) => setParticipantClass(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Age:</label>
                        <input type="number" value={participantAge} onChange={(e) => setParticipantAge(e.target.value)} min="1" required />
                    </div>
                    <div className="form-group">
                        <label>Sector:</label>
                        <select value={participantSector} onChange={(e) => setParticipantSector(e.target.value)} required>
                            <option value="">-- Select Sector --</option>
                            {sectors.map(sector => (
                                <option key={sector.id} value={sector.name}>{sector.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Unit:</label>
                        <input type="text" value={participantUnit} onChange={(e) => setParticipantUnit(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Category:</label>
                        <select value={participantCategory} onChange={(e) => {
                            setParticipantCategory(e.target.value);
                            setSelectedEvents([]); // Reset selected events when category changes
                            setParticipantEventCodes({}); // Reset codes
                        }} required>
                            {EVENT_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Assign Events (for {participantCategory} category):</label>
                        <select multiple value={selectedEvents} onChange={(e) => {
                            const selectedOpts = Array.from(e.target.selectedOptions).map(option => option.value);
                            setSelectedEvents(selectedOpts);
                            // Initialize codes for newly selected events if they don't exist
                            const newCodes = { ...participantEventCodes };
                            selectedOpts.forEach(id => {
                                if (!newCodes[id]) newCodes[id] = '';
                            });
                            // Remove codes for unselected events
                            Object.keys(newCodes).forEach(id => {
                                if (!selectedOpts.includes(id)) {
                                    delete newCodes[id];
                                }
                            });
                            setParticipantEventCodes(newCodes);
                        }} className="multi-select">
                            {filteredEventsForParticipant.length === 0 ? (
                                <option disabled>No events available for this category.</option>
                            ) : (
                                filteredEventsForParticipant.map(event => (
                                    <option key={event.id} value={event.id}>{event.name}</option>
                                ))
                            )}
                        </select>
                        <small>Hold Ctrl/Cmd to select multiple.</small>
                    </div>
                    {/* Event Code assignment moved to "View Registered Participants by Event" */}
                    <button type="submit" className="btn btn-primary">{editingParticipantId ? 'Update Participant' : 'Add Participant'}</button>
                    {editingParticipantId && <button type="button" className="btn btn-secondary" onClick={() => {
                        setEditingParticipantId(null);
                        setParticipantName('');
                        setParticipantClass('');
                        setParticipantAge('');
                        setParticipantSector('');
                        setParticipantUnit('');
                        setParticipantCategory(EVENT_CATEGORIES[0]);
                        setSelectedEvents([]);
                        setParticipantEventCodes({});
                    }}>Cancel Edit</button>}
                </form>

                <div className="list-section">
                    <h4>All Registered Participants (by Category and Event)</h4>
                    {Object.keys(participantsByEventAndCategory).length === 0 ? (
                        <p>No participants registered yet.</p>
                    ) : (
                        Object.entries(participantsByEventAndCategory).map(([category, eventsData]) => {
                            const eventsWithParticipants = Object.keys(eventsData).filter(eventId => eventsData[eventId].length > 0);

                            if (eventsWithParticipants.length === 0) return null; // Skip category if no participants

                            return (
                                <div key={category} className="participant-category-group">
                                    <h5>Category: {category}</h5>
                                    {eventsWithParticipants.map(eventId => {
                                        const eventName = events.find(e => e.id === eventId)?.name || 'Unknown Event';
                                        const participantsInEvent = eventsData[eventId];
                                        return (
                                            <div key={eventId} className="event-participants-group">
                                                <h6>Event: {eventName}</h6>
                                                <div className="list-cards">
                                                    {participantsInEvent.map(participant => (
                                                        <div key={participant.id} className="list-card participant-list-card">
                                                            <p><strong>Name: {participant.name}</strong></p>
                                                            <p>Class: {participant.class}, Age: {participant.age}</p>
                                                            <p>Sector: {participant.sector}, Unit: {participant.unit}</p>
                                                            <div className="form-group participant-code-input">
                                                                <label htmlFor={`code-${participant.id}-${eventId}`}>Event Code:</label>
                                                                <input
                                                                    type="text"
                                                                    id={`code-${participant.id}-${eventId}`}
                                                                    maxLength="1"
                                                                    value={
                                                                        // Find the specific event entry and its code
                                                                        participant.events.find(e => e.eventId === eventId)?.code || ''
                                                                    }
                                                                    onChange={(e) => handleEventCodeChangeLocal(participant.id, eventId, e.target.value)}
                                                                    onBlur={(e) => handleUpdateParticipantCode(participant.id, eventId, e.target.value)} // Save on blur
                                                                    style={{ width: '50px', textTransform: 'uppercase', textAlign: 'center' }}
                                                                />
                                                                <button
                                                                    className="btn btn-primary btn-small"
                                                                    onClick={() => handleUpdateParticipantCode(
                                                                        participant.id,
                                                                        eventId,
                                                                        participant.events.find(e => e.eventId === eventId)?.code || '' // Get current value from local state
                                                                    )}
                                                                    style={{ marginLeft: '10px' }}
                                                                >
                                                                    Save Code
                                                                </button>
                                                            </div>

                                                            <div className="card-actions">
                                                                <button
                                                                    className="btn btn-secondary btn-small"
                                                                    onClick={() => handleEditParticipant(participant)}
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    className="btn btn-danger btn-small"
                                                                    onClick={() => handleDeleteParticipant(participant.id)}
                                                                >
                                                                    Delete
                                                                </button>
                                                                <button
                                                                    className="btn btn-info btn-small"
                                                                    onClick={() => handleDownloadParticipantsExcel(eventId, eventName, participantsInEvent)}
                                                                >
                                                                    Download Excel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };


    const ManageResults = () => {
        const [selectedEventId, setSelectedEventId] = useState('');
        const [processedRankedParticipants, setProcessedRankedParticipants] = useState([]); // All ranked participants for the selected event
        const [posterBase64, setPosterBase64] = useState('');
        const [results, setResults] = useState([]);

        // State to hold the chosen placements for the current event result
        const [currentPlacements, setCurrentPlacements] = useState({
            1: null, // { participantId, participantName, pointsAwarded, totalJudgeScore }
            2: null,
            3: null
        });

        // Fetch results for display
        useEffect(() => {
            if (!db) return;
            const unsubscribe = onSnapshot(collection(db, `artifacts/${appId}/public/data/results`), (snapshot) => {
                setResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }, (error) => console.error("Error fetching results:", error));
            return () => unsubscribe();
        }, [db, appId]);

        // Fetch processed ranked participants for selected event and populate currentPlacements
        useEffect(() => {
            const fetchRankedParticipants = async () => {
                if (!db || !selectedEventId) {
                    setProcessedRankedParticipants([]);
                    setCurrentPlacements({ 1: null, 2: null, 3: null });
                    setPosterBase64(''); // Clear poster when event changes
                    return;
                }
                try {
                    const q = query(
                        collection(db, `artifacts/${appId}/public/data/event_rank_points`),
                        where('eventId', '==', selectedEventId)
                    );
                    const snapshot = await getDocs(q);
                    const fetchedParticipants = snapshot.docs.map(doc => doc.data());
                    setProcessedRankedParticipants(fetchedParticipants);

                    // Auto-populate currentPlacements based on fetched ranks
                    const newPlacements = { 1: null, 2: null, 3: null };
                    fetchedParticipants.forEach(p => {
                        if (p.rank >= 1 && p.rank <= 3) {
                            newPlacements[p.rank] = {
                                rank: p.rank, // Ensure rank is included in placement object
                                participantId: p.participantId,
                                participantName: p.participantName,
                                pointsAwarded: p.pointsAwarded,
                                totalJudgeScore: p.participantEventTotalScore
                            };
                        }
                    });
                    setCurrentPlacements(newPlacements);

                    // If editing an existing result, load its poster
                    const existingResult = results.find(r => r.eventId === selectedEventId);
                    if (existingResult && existingResult.posterBase64) {
                        setPosterBase64(existingResult.posterBase64);
                    } else {
                        setPosterBase64(''); // Clear if no existing poster
                    }


                } catch (error) {
                    console.error("Error fetching ranked participants for results:", error);
                    setMessage("Failed to load ranked participants for this event.");
                }
            };
            fetchRankedParticipants();
        }, [db, appId, selectedEventId, results]); // Added 'results' to dependency array


        const handlePosterUpload = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPosterBase64(reader.result);
                };
                reader.readAsDataURL(file);
            }
        };

        const handleAddResult = async (e) => {
            e.preventDefault();
            setMessage('');
            try {
                const event = events.find(e => e.id === selectedEventId);

                if (!event) {
                    setMessage("Please select a valid event.");
                    return;
                }
                if (processedRankedParticipants.length === 0) {
                    setMessage("No processed ranks available for this event. Please process ranks first.");
                    return;
                }

                // Prepare the placements array for Firestore
                const placementsToSave = [];
                for (let i = 1; i <= 3; i++) {
                    if (currentPlacements[i]) {
                        placementsToSave.push({
                            rank: i, // Ensure rank is explicitly stored for each placement
                            participantId: currentPlacements[i].participantId,
                            participantName: currentPlacements[i].participantName,
                            pointsAwarded: currentPlacements[i].pointsAwarded,
                            totalJudgeScore: currentPlacements[i].totalJudgeScore
                        });
                    }
                }

                // Default competitionType if it's undefined
                const finalCompetitionType = event.competitionType || 'single';


                // Check if a result already exists for this event
                const existingResultQuery = query(
                    collection(db, `artifacts/${appId}/public/data/results`),
                    where('eventId', '==', selectedEventId)
                );
                const existingResultSnapshot = await getDocs(existingResultQuery);

                const resultData = {
                    eventId: selectedEventId,
                    eventName: event.name,
                    categoryName: event.category,
                    competitionType: finalCompetitionType, // Use the fallback
                    placements: placementsToSave,
                    posterBase64: posterBase64, // Store base64 string
                    timestamp: new Date().toISOString()
                };

                if (existingResultSnapshot.empty) {
                    // Add new result document
                    await addDoc(collection(db, `artifacts/${appId}/public/data/results`), resultData);
                    setMessage("Result added successfully!");
                } else {
                    // Update existing result document
                    const resultDocToUpdate = existingResultSnapshot.docs[0];
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/results`, resultDocToUpdate.id), resultData);
                    setMessage("Result updated successfully!");
                }


                setSelectedEventId('');
                setProcessedRankedParticipants([]);
                setCurrentPlacements({ 1: null, 2: null, 3: null });
                setPosterBase64('');
            } catch (error) {
                console.error("Error adding/updating result:", error);
                setMessage("Failed to add/update result: " + error.message);
            }
        };

        const handleDeleteResult = async (resultId) => {
            if (!window.confirm("Are you sure you want to delete this result?")) {
                return;
            }
            setMessage('');
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/results`, resultId));
                setMessage("Result deleted successfully!");
            } catch (error) {
                console.error("Error deleting result:", error);
                setMessage("Failed to delete result: " + error.message);
            }
        };

        return (
            <div className="admin-section">
                <h3>Manage Results</h3>
                <form onSubmit={handleAddResult} className="form-card">
                    <h4>Finalize Event Result</h4>
                    <div className="form-group">
                        <label>Select Event:</label>
                        <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} required>
                            <option value="">-- Select an Event --</option>
                            {events.map(event => (
                                <option key={event.id} value={event.id}>{event.name} ({event.category})</option>
                            ))}
                        </select>
                    </div>

                    {selectedEventId && (
                        <div className="form-group">
                            <label>Processed Ranks for this Event:</label>
                            {processedRankedParticipants.length > 0 ? (
                                <div className="processed-ranks-display">
                                    {[1, 2, 3].map(rank => (
                                        <div key={rank} className="rank-display-item">
                                            <strong>{rank} Place:</strong> {' '}
                                            {currentPlacements[rank] ? (
                                                `${currentPlacements[rank].participantName} (${currentPlacements[rank].pointsAwarded} points, Total Score: ${currentPlacements[rank].totalJudgeScore})`
                                            ) : (
                                                <span style={{ color: '#888' }}>Not Awarded</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="warn-message">No processed ranks found for this event. Please go to "Manage Events" and click "Process Event Ranks" for the selected event.</p>
                            )}
                            <small>These ranks are based on "Process Event Ranks".</small>
                        </div>
                    )}


                    <div className="form-group">
                        <label>Poster (Optional, for the event result):</label>
                        <input type="file" accept="image/*" onChange={handlePosterUpload} />
                        {posterBase64 && <img src={posterBase64} alt="Poster preview" style={{ maxWidth: '100px', maxHeight: '100px', marginTop: '10px' }} />}
                        <small>Upload a small image for the event result poster. Large images will slow down the app.</small>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={!selectedEventId || processedRankedParticipants.length === 0}>
                        {results.some(r => r.eventId === selectedEventId) ? 'Update Result' : 'Add Result'}
                    </button>
                </form>

                <div className="list-section">
                    <h4>Finalized Results</h4>
                    {results.length === 0 ? <p>No results added yet.</p> : (
                        <div className="list-cards">
                            {results.map(result => (
                                <div key={result.id} className="list-card result-list-card">
                                    <p><strong>{result.eventName} ({result.categoryName})</strong></p>
                                    <p>Type: {result.competitionType || 'N/A'}</p>
                                    {result.placements && result.placements.map(p => (
                                        <p key={p.rank}>
                                            <strong>{p.rank} Place:</strong> {p.participantName} ({p.pointsAwarded} pts)
                                        </p>
                                    ))}
                                    {result.posterBase64 && (
                                        <img src={result.posterBase64} alt="Result Poster" style={{ maxWidth: '80px', maxHeight: '80px', marginTop: '10px' }} />
                                    )}
                                    <button
                                        className="btn btn-danger btn-small"
                                        onClick={() => handleDeleteResult(result.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const ManageLeaderboard = () => {
        const [activePointSchemeId, setActivePointSchemeId] = useState('group'); // Default to group scheme
        const [settingMessage, setSettingMessage] = useState('');

        // Fetch current active point scheme on component mount
        useEffect(() => {
            if (!db) return;
            const pointsSchemeDocRef = doc(db, `artifacts/${appId}/public/data/settings`, 'leaderboard_point_scheme');
            const unsubscribe = onSnapshot(pointsSchemeDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    setActivePointSchemeId(docSnap.data().activeSchemeId);
                } else {
                    // Initialize if not exists
                    setDoc(pointsSchemeDocRef, { activeSchemeId: 'group' }, { merge: true });
                    setActivePointSchemeId('group');
                }
            }, (error) => {
                console.error("Error fetching point scheme:", error);
                setSettingMessage("Failed to load point scheme. Defaulting to High Points.");
            });
            return () => unsubscribe();
        }, [db, appId]);

        const handlePointSchemeChange = async (schemeId) => {
            setSettingMessage('');
            try {
                const pointsSchemeDocRef = doc(db, `artifacts/${appId}/public/data/settings`, 'leaderboard_point_scheme');
                await setDoc(pointsSchemeDocRef, { activeSchemeId: schemeId }, { merge: true });
                setActivePointSchemeId(schemeId);
                setSettingMessage(`Leaderboard point scheme set to: ${RANK_POINT_SCHEMES[schemeId].name}`);
            } catch (error) {
                console.error("Error setting point scheme:", error);
                setSettingMessage("Failed to set point scheme: " + error.message);
            }
        };

        const handleRecalculateLeaderboard = async () => {
            setMessage('Recalculating leaderboard...');
            try {
                // Fetch points awarded from processed event ranks, not raw scores
                const eventRankPointsRef = collection(db, `artifacts/${appId}/public/data/event_rank_points`);
                const sectorsRef = collection(db, `artifacts/${appId}/public/data/sectors`);

                const [rankPointsSnapshot, sectorsSnapshot] = await Promise.all([
                    getDocs(eventRankPointsRef),
                    getDocs(sectorsRef)
                ]);

                const rankPointsData = rankPointsSnapshot.docs.map(doc => doc.data());
                const sectorsData = sectorsSnapshot.docs.map(doc => doc.data().name); // Get just sector names

                console.log("Raw Rank Points data:", rankPointsData);
                console.log("Registered sectors:", sectorsData);

                const sectorCategoryScores = {}; // { sectorName: { categoryName: score, total: score } }

                // Initialize all known sectors and categories to zero
                sectorsData.forEach(sector => {
                    sectorCategoryScores[sector] = { total: 0 };
                    EVENT_CATEGORIES.forEach(category => {
                        sectorCategoryScores[sector][category] = 0;
                    });
                });
                console.log("Initialized sectorCategoryScores:", JSON.parse(JSON.stringify(sectorCategoryScores)));


                rankPointsData.forEach(rankPoint => {
                    const sector = rankPoint.participantSector;
                    const category = rankPoint.participantCategory;

                    if (sector && category && sectorCategoryScores[sector]) {
                        // Add to category specific score
                        sectorCategoryScores[sector][category] = (sectorCategoryScores[sector][category] || 0) + rankPoint.pointsAwarded;
                        // Add to total sector score
                        sectorCategoryScores[sector].total += rankPoint.pointsAwarded;
                    } else {
                        console.warn(`Skipping rank points for participant ${rankPoint.participantName} (ID: ${rankPoint.participantId}) due to missing sector/category or uninitialized sector. Sector: ${sector}, Category: ${category}`);
                    }
                });
                console.log("Aggregated sectorCategoryScores (from rank points):", JSON.parse(JSON.stringify(sectorCategoryScores)));


                const sortedLeaderboard = Object.entries(sectorCategoryScores)
                    .map(([sector, data]) => ({ sector, totalScore: data.total }))
                    .sort((a, b) => b.totalScore - a.totalScore); // Sort by total score descending
                console.log("Sorted Leaderboard:", sortedLeaderboard);

                // Update a single document in Firestore for the leaderboard summary
                const leaderboardDocRef = doc(db, `artifacts/${appId}/public/data/leaderboard_summary`, 'current_leaderboard');
                await setDoc(leaderboardDocRef, {
                    sortedLeaderboard, // For overall sector ranking
                    sectorCategoryScores, // For detailed category breakdown per sector
                    lastUpdated: new Date().toISOString()
                });

                setMessage("Leaderboard successfully recalculated!");
            } catch (error) {
                console.error("Error recalculating leaderboard:", error);
                setMessage("Failed to recalculate leaderboard: " + error.message);
            }
        };

        return (
            <div className="admin-section">
                <h3>Manage Leaderboard</h3>
                <div className="form-card" style={{ textAlign: 'center' }}>
                    <h4>Leaderboard Point System</h4>
                    <p>Select the point scheme to apply for 1st, 2nd, and 3rd place in events.</p>
                    <div className="form-group" style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
                        {Object.entries(RANK_POINT_SCHEMES).map(([key, scheme]) => (
                            <label key={key}>
                                <input
                                    type="radio"
                                    name="pointScheme"
                                    value={key}
                                    checked={activePointSchemeId === key}
                                    onChange={() => handlePointSchemeChange(key)}
                                />
                                {scheme.name}
                            </label>
                        ))}
                    </div>
                    <MessageBox message={settingMessage} type={settingMessage.includes("Failed") || settingMessage.includes("Error") ? 'error' : 'success'} onClose={() => setSettingMessage('')} />
                </div>
                <div className="form-card" style={{ textAlign: 'center', marginTop: '20px' }}>
                    <h4>Recalculate Sector Leaderboard</h4>
                    <p>Click the button below to recalculate the overall sector leaderboard based on current event rank points.</p>
                    <button onClick={handleRecalculateLeaderboard} className="btn btn-primary">Recalculate Leaderboard</button>
                </div>
            </div>
        );
    };

    const ManageSectors = () => { // New component for managing sectors
        const [sectorName, setSectorName] = useState('');
        const [sectorPassword, setSectorPassword] = useState(''); // Password for new sector official

        const handleAddSector = async (e) => {
            e.preventDefault();
            setMessage('');
            if (!sectorName.trim() || !sectorPassword.trim()) {
                setMessage("Sector name and password cannot be empty.");
                return;
            }
            if (sectorPassword.length < 6) {
                setMessage("Sector password must be at least 6 characters.");
                return;
            }

            try {
                const sectorEmail = `${sectorName.toLowerCase().replace(/\s/g, '')}@sector.com`; // Standardized email
                // 1. Create Firebase Auth user for the new sector
                const userCredential = await createUserWithEmailAndPassword(auth, sectorEmail, sectorPassword);
                const sectorUid = userCredential.user.uid;

                // 2. Add sector details to Firestore using the UID as document ID
                await setDoc(doc(db, `artifacts/${appId}/public/data/sectors`, sectorUid), {
                    name: sectorName,
                    email: sectorEmail, // Store email for reference
                    createdAt: new Date().toISOString()
                });
                setMessage(`Sector "${sectorName}" and official account created successfully! Email: ${sectorEmail}`);
                setSectorName('');
                setSectorPassword('');
            } catch (error) {
                console.error("Error adding sector:", error);
                let errorMessage = "Failed to add sector: An account with this email already exists.";
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = "Failed to add sector: An account with this email already exists.";
                }
                setMessage(errorMessage);
            }
        };

        const handleDeleteSector = async (sectorId, sectorNameToDelete, sectorEmailToDelete) => {
            if (!window.confirm(`Are you sure you want to delete sector "${sectorNameToDelete}"? This will remove all associated participants and official accounts.`)) {
                return;
            }
            setMessage('');
            try {
                // Delete from Firestore
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/sectors`, sectorId));

                // Note: Deleting user from Firebase Auth programmatically on client-side is not possible.
                // This would typically be handled via Firebase Admin SDK on a backend (Cloud Function).
                // For this demo, we'll remove it from the 'sectors' collection and inform the admin.
                setMessage(`Sector "${sectorNameToDelete}" deleted from database. Remember to manually delete Firebase Auth user "${sectorEmailToDelete}" if needed.`);

            } catch (error) {
                console.error("Error deleting sector:", error);
                setMessage("Failed to delete sector: " + error.message);
            }
        };

        return (
            <div className="admin-section">
                <h3>Manage Sectors</h3>
                <form onSubmit={handleAddSector} className="form-card">
                    <h4>Add New Sector</h4>
                    <div className="form-group">
                        <label>Sector Name:</label>
                        <input type="text" value={sectorName} onChange={(e) => setSectorName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Temporary Password for Official:</label>
                        <input type="password" value={sectorPassword} onChange={(e) => setSectorPassword(e.target.value)} required minLength="6" />
                        <small>This password will be used for the sector official's login. Min 6 characters.</small>
                    </div>
                    <button type="submit" className="btn btn-primary">Add Sector</button>
                </form>

                <div className="list-section">
                    <h4>Current Sectors</h4>
                    {sectors.length === 0 ? <p>No sectors added yet.</p> : (
                        <div className="list-cards">
                            {sectors.map(sector => (
                                <div key={sector.id} className="list-card">
                                    <p><strong>{sector.name}</strong></p>
                                    <p>Login Email: {sector.email}</p> {/* Display the login email */}
                                    <button
                                        className="btn btn-danger btn-small"
                                        onClick={() => handleDeleteSector(sector.id, sector.name, sector.email)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };


    return (
        <div className="page-container admin-dashboard">
            <h1>Admin Dashboard</h1>
            <p>Welcome, {currentUser?.email}!</p>
            <MessageBox message={message} type={message.includes("Failed") || message.includes("Error") ? 'error' : 'success'} onClose={() => setMessage('')} />

            <div className="admin-tabs">
                <button className={`tab-button ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>Manage Events</button>
                <button className={`tab-button ${activeTab === 'judges' ? 'active' : ''}`} onClick={() => setActiveTab('judges')}>Manage Judges</button>
                <button className={`tab-button ${activeTab === 'participants' ? 'active' : ''}`} onClick={() => setActiveTab('participants')}>Manage Participants</button>
                <button className={`tab-button ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>Manage Results</button>
                <button className={`tab-button ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>Manage Leaderboard</button>
                <button className={`tab-button ${activeTab === 'sectors' ? 'active' : ''}`} onClick={() => setActiveTab('sectors')}>Manage Sectors</button> {/* New tab */}
            </div>

            <div className="admin-content">
                {activeTab === 'events' && <ManageEvents />}
                {activeTab === 'judges' && <ManageJudges />}
                {activeTab === 'participants' && <ManageParticipants />}
                {activeTab === 'results' && <ManageResults />}
                {activeTab === 'leaderboard' && <ManageLeaderboard />}
                {activeTab === 'sectors' && <ManageSectors />} {/* Render new component */}
            </div>
        </div>
    );
};

// --- Sector Dashboard Component ---
const SectorDashboard = () => {
    const { currentUser, db, appId, loadingAuth, sectorDetails } = useAuth();
    const navigate = useNavigate();
    const [message, setMessage] = useState('');
    const [participants, setParticipants] = useState([]);
    const [events, setEvents] = useState([]); // All events

    // Participant form states
    const [participantName, setParticipantName] = useState('');
    const [participantClass, setParticipantClass] = useState('');
    const [participantAge, setParticipantAge] = useState('');
    const [participantUnit, setParticipantUnit] = useState('');
    const [participantCategory, setParticipantCategory] = useState(EVENT_CATEGORIES[0]);
    const [selectedEvents, setSelectedEvents] = useState([]); // Event IDs only
    const [editingParticipantId, setEditingParticipantId] = useState(null);

    // Redirect if not sector official or auth not ready
    useEffect(() => {
        if (!loadingAuth) {
            if (!currentUser || !currentUser.email || !currentUser.email.includes('@sector.com')) {
                console.log("SectorDashboard: Not authorized, redirecting to login.");
                navigate('/login'); // Redirect to unified login
            }
        }
    }, [currentUser, loadingAuth, navigate]);

    // Fetch all events for dropdowns
    useEffect(() => {
        if (!db) return;
        const unsubscribe = onSnapshot(collection(db, `artifacts/${appId}/public/data/events`), (snapshot) => {
            setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching events for sector:", error));
        return () => unsubscribe();
    }, [db, appId]);

    // Fetch participants specific to this sector
    useEffect(() => {
        if (!db || !sectorDetails) {
            setParticipants([]);
            return;
        }

        const participantsColRef = collection(db, `artifacts/${appId}/public/data/participants`);
        const q = query(participantsColRef, where('sector', '==', sectorDetails.name)); // Filter by sector name
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Error fetching sector participants:", error);
            setMessage("Failed to load participants for your sector.");
        });

        return () => unsubscribe();
    }, [db, appId, sectorDetails]); // Depend on sectorDetails to refetch when it's set

    const handleAddParticipant = async (e) => {
        e.preventDefault();
        setMessage('');

        if (!sectorDetails) {
            setMessage("Sector details not loaded. Please try again after logging in as a sector official.");
            return;
        }

        try {
            // Events array now stores objects { eventId: 'id', code: '' }
            const eventsForParticipant = selectedEvents.map(eventId => ({
                eventId: eventId,
                code: '' // Code is assigned by Admin
            }));

            const participantData = {
                name: participantName,
                class: participantClass,
                age: parseInt(participantAge),
                sector: sectorDetails.name, // Auto-filled from logged-in sector
                unit: participantUnit,
                category: participantCategory,
                events: eventsForParticipant,
                registeredBySectorId: currentUser.uid, // Track which sector official registered
                registeredBySectorName: sectorDetails.name,
                registrationDate: new Date().toISOString()
            };

            if (editingParticipantId) {
                await updateDoc(doc(db, `artifacts/${appId}/public/data/participants`, editingParticipantId), participantData);
                setMessage("Participant updated successfully!");
                setEditingParticipantId(null);
            } else {
                await addDoc(collection(db, `artifacts/${appId}/public/data/participants`), participantData);
                setMessage("Participant added successfully!");
            }

            // Clear form
            setParticipantName('');
            setParticipantClass('');
            setParticipantAge('');
            setParticipantUnit('');
            setParticipantCategory(EVENT_CATEGORIES[0]);
            setSelectedEvents([]);
        } catch (error) {
            console.error("Error adding/updating participant:", error);
            setMessage("Failed to add/update participant: " + error.message);
        }
    };

    const handleEditParticipant = (participant) => {
        setEditingParticipantId(participant.id);
        setParticipantName(participant.name);
        setParticipantClass(participant.class);
        setParticipantAge(participant.age);
        setParticipantUnit(participant.unit);
        setParticipantCategory(participant.category);
        // Ensure selectedEvents are populated correctly from the object array
        setSelectedEvents(participant.events.map(e => (typeof e === 'object' ? e.eventId : e)));
    };

    const handleDeleteParticipant = async (participantId) => {
        if (!window.confirm("Are you sure you want to delete this participant?")) {
            return;
        }
        setMessage('');
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/participants`, participantId));
            setMessage("Participant deleted successfully!");
        } catch (error) {
            console.error("Error deleting participant:", error);
            setMessage("Failed to delete participant: " + error.message);
        }
    };

    // Filter events based on selected participant category for the form
    const availableEventsForCategory = events.filter(event => event.category === participantCategory);

    if (loadingAuth || !sectorDetails) {
        return <LoadingSpinner message="Loading sector data..." />;
    }

    return (
        <div className="page-container sector-dashboard">
            <h1>Sector Dashboard</h1>
            <p>Welcome, Sector Official: {sectorDetails.name} ({currentUser?.email})</p>
            <MessageBox message={message} type={message.includes("Failed") || message.includes("Error") ? 'error' : 'success'} onClose={() => setMessage('')} />

            <div className="admin-section"> {/* Reusing admin-section styling */}
                <h3>{editingParticipantId ? 'Edit Participant' : 'Add New Participant'}</h3>
                <form onSubmit={handleAddParticipant} className="form-card">
                    <div className="form-group">
                        <label>Name:</label>
                        <input type="text" value={participantName} onChange={(e) => setParticipantName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Class:</label>
                        <input type="text" value={participantClass} onChange={(e) => setParticipantClass(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Age:</label>
                        <input type="number" value={participantAge} onChange={(e) => setParticipantAge(e.target.value)} min="1" required />
                    </div>
                    <div className="form-group">
                        <label>Sector:</label>
                        <input type="text" value={sectorDetails.name} disabled className="disabled-input" />
                    </div>
                    <div className="form-group">
                        <label>Unit:</label>
                        <input type="text" value={participantUnit} onChange={(e) => setParticipantUnit(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Category:</label>
                        <select value={participantCategory} onChange={(e) => {
                            setParticipantCategory(e.target.value);
                            setSelectedEvents([]); // Reset selected events when category changes
                        }} required>
                            {EVENT_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Assign Events (for {participantCategory} category):</label>
                        <select multiple value={selectedEvents} onChange={(e) => setSelectedEvents(Array.from(e.target.selectedOptions).map(option => option.value))} className="multi-select">
                            {availableEventsForCategory.length === 0 ? (
                                <option disabled>No events available for this category.</option>
                            ) : (
                                availableEventsForCategory.map(event => (
                                    <option key={event.id} value={event.id}>{event.name}</option>
                                ))
                            )}
                        </select>
                        <small>Hold Ctrl/Cmd to select multiple. Admin will assign event codes.</small>
                    </div>
                    <button type="submit" className="btn btn-primary">{editingParticipantId ? 'Update Participant' : 'Add Participant'}</button>
                    {editingParticipantId && <button type="button" className="btn btn-secondary" onClick={() => {
                        setEditingParticipantId(null);
                        setParticipantName('');
                        setParticipantClass('');
                        setParticipantAge('');
                        setParticipantUnit('');
                        setParticipantCategory(EVENT_CATEGORIES[0]);
                        setSelectedEvents([]);
                    }}>Cancel Edit</button>}
                </form>

                <div className="list-section">
                    <h4>Participants from Your Sector ({sectorDetails.name})</h4>
                    {participants.length === 0 ? (
                        <p>No participants registered by your sector yet.</p>
                    ) : (
                        <div className="list-cards">
                            {participants.map(participant => (
                                <div key={participant.id} className="list-card participant-list-card">
                                    <p><strong>Name: {participant.name}</strong></p>
                                    <p>Class: {participant.class}, Age: {participant.age}</p>
                                    <p>Unit: {participant.unit}</p>
                                    <p>Category: {participant.category}</p>
                                    <p>Events: {participant.events.map(e => {
                                        const eventName = events.find(event => event.id === e.eventId)?.name || e.eventId;
                                        return `${eventName} (Code: ${e.code || 'N/A'})`; // Display code here
                                    }).join(', ')}</p>
                                    <div className="card-actions">
                                        <button
                                            className="btn btn-secondary btn-small"
                                            onClick={() => handleEditParticipant(participant)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn btn-danger btn-small"
                                            onClick={() => handleDeleteParticipant(participant.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Judge Dashboard Component ---
const JudgeDashboard = () => {
    const { currentUser, db, appId, loadingAuth } = useAuth(); // Destructure loadingAuth
    const navigate = useNavigate();
    const [assignedEvents, setAssignedEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [participantsForSelectedEvent, setParticipantsForSelectedEvent] = useState([]);
    const [scores, setScores] = useState({}); // {participantId: marks}
    const [message, setMessage] = useState('');
    const [currentEventDetails, setCurrentEventDetails] = useState(null);

    // Redirect if not a judge or auth not ready
    useEffect(() => {
        console.log("JudgeDashboard useEffect [loadingAuth, currentUser] triggered. loadingAuth:", loadingAuth, "currentUser:", currentUser);
        if (!loadingAuth) {
            if (!currentUser) {
                console.log("JudgeDashboard: No current user after auth loading, redirecting to login.");
                navigate('/login'); // Redirect to unified login
            } else if (!currentUser.email || !currentUser.email.includes('@judge.com')) {
                console.log("JudgeDashboard: User is logged in but not a judge, redirecting to login. User email:", currentUser.email);
                navigate('/login'); // Redirect to unified login
            } else {
                console.log("JudgeDashboard: User is a judge, proceeding. User ID:", currentUser.uid);
            }
        }
    }, [currentUser, loadingAuth, navigate]);


    // Fetch events assigned to this judge
    useEffect(() => {
        console.log("JudgeDashboard useEffect [db, currentUser, appId, selectedEventId]: currentUser", currentUser);
        if (!db || !currentUser || !currentUser.uid) {
            console.log("JudgeDashboard: DB or currentUser (UID) not available for event fetch. Current user:", currentUser);
            setAssignedEvents([]);
            return;
        }

        console.log("Fetching events for judge UID:", currentUser.uid);
        const eventsColRef = collection(db, `artifacts/${appId}/public/data/events`);
        const unsubscribe = onSnapshot(eventsColRef, (snapshot) => {
            const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Filter events where this judge is assigned
            const filteredEvents = allEvents.filter(event =>
                event.judges && event.judges.some(j => j.id === currentUser.uid)
            );
            setAssignedEvents(filteredEvents);
            console.log("Assigned events fetched:", filteredEvents);

            // If a selected event exists, update its details
            if (selectedEventId) {
                const updatedEvent = filteredEvents.find(e => e.id === selectedEventId);
                setCurrentEventDetails(updatedEvent);
            }

        }, (error) => {
            console.error("Error fetching assigned events:", error);
            setMessage("Failed to load assigned events. Please try again.");
        });

        return () => unsubscribe();
    }, [db, currentUser, appId, selectedEventId]);

    // Fetch participants for the selected event and existing scores, display codes
    useEffect(() => {
        console.log("JudgeDashboard useEffect [db, selectedEventId, currentUser, appId]: selectedEventId", selectedEventId, "currentUser", currentUser);
        if (!db || !selectedEventId || !currentUser || !currentUser.uid) {
            setParticipantsForSelectedEvent([]);
            setScores({});
            return;
        }

        const fetchParticipantsAndScores = async () => {
            try {
                // Get all participants
                const allParticipantsSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/participants`));
                const allParticipantsData = allParticipantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Filter participants for the selected event and map to include only their assigned event code
                const filteredParticipants = allParticipantsData.filter(p =>
                    p.events && p.events.some(e => typeof e === 'object' && e.eventId === selectedEventId)
                ).map(p => {
                    const eventEntry = p.events.find(e => typeof e === 'object' && e.eventId === selectedEventId);
                    return {
                        id: p.id,
                        code: eventEntry.code || 'N/A', // The code for the judge
                        // Removed category, sector, unit to ensure anonymity
                    };
                }).sort((a, b) => a.code.localeCompare(b.code)); // Sort by code for consistent display

                setParticipantsForSelectedEvent(filteredParticipants);
                console.log("Participants for selected event (with codes for judge):", filteredParticipants);


                // Get existing scores for this judge and event
                const scoresQuery = query(
                    collection(db, `artifacts/${appId}/public/data/scores`),
                    where('eventId', '==', selectedEventId),
                    where('judgeId', '==', currentUser.uid)
                );
                const scoresSnapshot = await getDocs(scoresQuery);
                const existingScores = {};
                scoresSnapshot.docs.forEach(doc => {
                    const scoreData = doc.data();
                    existingScores[scoreData.participantId] = scoreData.marks;
                });
                setScores(existingScores);
                console.log("Existing scores for judge:", existingScores);
                setMessage('');
            } catch (error) {
                console.error("Error fetching participants or scores:", error);
                setMessage("Failed to load participants or existing scores.");
            }
        };

        // Also listen to live changes for scores specific to this judge/event
        const scoresColRef = collection(db, `artifacts/${appId}/public/data/scores`);
        const scoresUnsubscribe = onSnapshot(query(
            scoresColRef,
            where('eventId', '==', selectedEventId),
            where('judgeId', '==', currentUser.uid)
        ), (snapshot) => {
            const updatedScores = {};
            snapshot.docs.forEach(doc => {
                const scoreData = doc.data();
                updatedScores[scoreData.participantId] = scoreData.marks;
            });
            setScores(updatedScores);
            console.log("Live score update:", updatedScores);
        }, (error) => {
            console.error("Error listening to score changes:", error);
        });

        fetchParticipantsAndScores(); // Initial fetch

        return () => scoresUnsubscribe(); // Cleanup listener
    }, [db, selectedEventId, currentUser, appId]);

    // Update current event details when selected event changes
    useEffect(() => {
        if (selectedEventId) {
            const event = assignedEvents.find(e => e.id === selectedEventId);
            setCurrentEventDetails(event);
        } else {
            setCurrentEventDetails(null);
        }
    }, [selectedEventId, assignedEvents]);

    const handleMarkChange = (participantId, value) => {
        setScores(prev => ({
            ...prev,
            [participantId]: parseInt(value) || 0
        }));
    };

    const handleSubmitMarks = async (participantId) => {
        setMessage('');
        if (!currentEventDetails || currentEventDetails.status !== 'live') {
            setMessage("Cannot submit marks. Event is not live or details are missing.");
            return;
        }

        const marksToSubmit = scores[participantId] || 0;
        const maxMarksForJudge = currentEventDetails.markDistribution?.[currentUser.uid] || 0;

        if (marksToSubmit > maxMarksForJudge) {
            setMessage(`Marks for this participant (${marksToSubmit}) exceed your maximum allocated marks for this event (${maxMarksForJudge}).`);
            return;
        }
        if (marksToSubmit < 0) {
            setMessage("Marks cannot be negative.");
            return;
        }

        try {
            // Check if score already exists for this participant, event, and judge
            const q = query(
                collection(db, `artifacts/${appId}/public/data/scores`),
                where('eventId', '==', selectedEventId),
                where('participantId', '==', participantId),
                where('judgeId', '==', currentUser.uid)
            );
            const existingScoresSnapshot = await getDocs(q);

            if (existingScoresSnapshot.empty) {
                // Add new score
                await addDoc(collection(db, `artifacts/${appId}/public/data/scores`), {
                    eventId: selectedEventId,
                    participantId: participantId,
                    judgeId: currentUser.uid,
                    marks: marksToSubmit,
                    timestamp: new Date().toISOString()
                });
                setMessage(`Marks submitted for participant code: ${participantsForSelectedEvent.find(p => p.id === participantId)?.code || participantId}`);
            } else {
                // Update existing score
                const docToUpdate = existingScoresSnapshot.docs[0];
                await updateDoc(doc(db, `artifacts/${appId}/public/data/scores`, docToUpdate.id), {
                    marks: marksToSubmit,
                    timestamp: new Date().toISOString()
                });
                setMessage(`Marks updated for participant code: ${participantsForSelectedEvent.find(p => p.id === participantId)?.code || participantId}`);
            }
        } catch (error) {
            console.error("Error submitting marks:", error);
            setMessage("Failed to submit marks: " + error.message);
        }
    };

    if (loadingAuth) {
        return <LoadingSpinner message="Authenticating judge permissions..." />;
    }

    if (!currentUser || !currentUser.email || !currentUser.email.includes('@judge.com')) {
        // If auth is done but user is not a judge, display an error
        return (
            <div className="page-container judge-dashboard">
                <h1>Judge Dashboard</h1>
                <MessageBox
                    message="You are not authorized to access the Judge Dashboard. Please log in with a judge account."
                    type="error"
                />
            </div>
        );
    }

    return (
        <div className="page-container judge-dashboard">
            <h1>Judge Dashboard</h1>
            <p>Welcome, {currentUser?.email}!</p>
            <MessageBox message={message} type={message.includes("Failed") || message.includes("Error") ? 'error' : 'success'} onClose={() => setMessage('')} />

            <div className="form-group">
                <label htmlFor="select-event">Select Event to Judge:</label>
                <select id="select-event" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                    <option value="">-- Choose an Event --</option>
                    {assignedEvents.length === 0 ? (
                        <option disabled>No events assigned to you.</option>
                    ) : (
                        assignedEvents.map(event => (
                            <option key={event.id} value={event.id}>
                                {event.name} ({event.category}) - Status: {event.status}
                            </option>
                        ))
                    )}
                </select>
            </div>

            {selectedEventId && currentEventDetails && (
                <div className="selected-event-info card">
                    <h3>Event: {currentEventDetails.name}</h3>
                    <p><strong>Status:</strong> <span className={`event-status ${currentEventDetails.status}`}>{currentEventDetails.status}</span></p>
                    <p><strong>Location:</strong> {currentEventDetails.location || 'N/A'}</p> {/* Display Location */}
                    <p><strong>Your Allocated Marks:</strong> {currentEventDetails.markDistribution?.[currentUser.uid] || 0}</p>
                    {currentEventDetails.status !== 'live' && (
                        <p className="warn-message">This event is not live. You cannot submit marks yet.</p>
                    )}
                </div>
            )}

            {selectedEventId && currentEventDetails && participantsForSelectedEvent.length > 0 ? (
                <div className="participants-for-event">
                    <h4>Participants in this Event:</h4>
                    <div className="list-cards">
                        {participantsForSelectedEvent.map(participant => (
                            <div key={participant.id} className="list-card participant-score-card">
                                <p>Participant Code: <strong>{participant.code}</strong></p> {/* Display Code, not Name */}
                                {/* Removed Category, Sector, Unit as per request */}
                                <div className="form-group">
                                    <label>Marks:</label>
                                    <input
                                        type="number"
                                        value={scores[participant.id] || 0}
                                        onChange={(e) => handleMarkChange(participant.id, e.target.value)}
                                        min="0"
                                        max={currentEventDetails?.markDistribution?.[currentUser.uid] || 0}
                                        disabled={currentEventDetails?.status !== 'live'}
                                    />
                                </div>
                                <button
                                    className="btn btn-primary btn-small"
                                    onClick={() => handleSubmitMarks(participant.id)}
                                    disabled={currentEventDetails?.status !== 'live'}
                                >
                                    Submit Marks
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : selectedEventId && !currentEventDetails ? (
                <p className="no-data-message">Loading event details...</p>
            ) : selectedEventId && participantsForSelectedEvent.length === 0 && currentEventDetails ? (
                <p className="no-data-message">No participants assigned to this event yet.</p>
            ) : (
                <p className="no-data-message">Please select an event from the dropdown above.</p>
            )}
        </div>
    );
};


// --- Main App Component ---
function App() {
    return (
        <Router>
            <AuthProvider>
                <Navbar />
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/results" element={<ResultsPage />} />
                    <Route path="/leaderboard" element={<LeaderboardPage />} />
                    <Route path="/info" element={<InfoPage />} /> {/* New route for Info page */}
                    {/* Single Login Page */}
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
                    <Route path="*" element={<div className="page-container"><h2>404: Page Not Found</h2><p>The page you are looking for does not exist.</p></div>} />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;
