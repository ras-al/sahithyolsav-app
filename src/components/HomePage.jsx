// Path: src/components/HomePage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx'; // Correct path to AuthContext
import { MessageBox } from './UtilityComponents.jsx'; // Import MessageBox
import { collection, onSnapshot, query, where, orderBy, doc, getDoc } from 'firebase/firestore'; // Import Firestore functions and getDoc for leaderboard

import themeImage from '/banner.png'; // Import the theme image for the banner

const HomePage = () => {
    const { db, appId } = useAuth();
    const [message, setMessage] = useState('');
    const [leaderboardSummary, setLeaderboardSummary] = useState(null); // State for leaderboard data


    // --- Removed Countdown State and Logic ---
    // const showCountdown = true;
    // const eventDate = new Date('2025-07-19T09:00:00+05:30');
    // const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, });
    // const [countdownEnded, setCountdownEnded] = useState(false);
    // useEffect(() => { ... }, [showCountdown]);
    // --- End Removed Countdown State and Logic ---


    useEffect(() => {
        if (!db) return;

        // Fetch leaderboard summary
        const leaderboardSummaryDocRef = doc(db, `artifacts/${appId}/public/data/leaderboard_summary`, 'current_leaderboard');
        const unsubscribeLeaderboard = onSnapshot(leaderboardSummaryDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setLeaderboardSummary(docSnap.data());
            } else {
                setLeaderboardSummary(null);
                setMessage("No final leaderboard data available yet.");
            }
        }, (error) => {
            console.error("Error fetching leaderboard:", error);
            setMessage("Failed to load final results. Please try again.");
        });

        return () => {
            unsubscribeLeaderboard();
        };
    }, [db, appId]);


    return (
        <div className="home-page-container">
            <header className="hero-section-image">
                <img src={themeImage} alt="Sahithyolsav Banner" className="banner-image" />
            </header>

            <MessageBox message={message} type={message.includes("Failed") ? 'error' : 'info'} onClose={() => setMessage('')} />

            <section className="results-section home-section">
                <h2>Event Concluded! Final Leaderboard Results:</h2>
                {leaderboardSummary && leaderboardSummary.sortedLeaderboard && leaderboardSummary.sortedLeaderboard.length > 0 ? (
                    <div className="leaderboard-table-container">
                        <table className="leaderboard-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Sector</th>
                                    <th>Total Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboardSummary.sortedLeaderboard.map((item, index) => (
                                    <tr key={item.sector} className={
                                        index === 0 ? 'top-sector-row' : // 1st place
                                        index === 1 ? 'second-place-row' : // 2nd place
                                        index === 2 ? 'third-place-row' : // 3rd place
                                        ''
                                    }>
                                        <td>#{index + 1}</td>
                                        <td className="sector-name-cell">{item.sector}</td>
                                        <td className="total-score-cell">{item.totalScore}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="no-data-message">Final results are being compiled. Please check back later!</p>
                )}
            </section>

            <section className="about-section home-section">
                <h2>About Sahithyolsav</h2>
                <p>
                    Sahithyolsav—Kerala’s beloved festival of 
                    literature—returns in all its glory with the 32nd 
                    edition under the Iritty Division, set against the 
                    serene backdrop of Vallithode on July 19–20, 2025.
                </p>
                <p>
                    This year’s theme, “അനുഭവങ്ങളുടെ കല – Feel the Experience,” 
                    invites us to explore literature not just as written word, but as living emotion, shared memory, and creative reflection. Every poem, every story, every dialogue becomes a brushstroke in the grand canvas of human experience.
                </p>
                <p>
                    This 32nd edition is more than an event—it is an invitation to feel, to reflect, and to express. Whether you are a budding writer, a curious student, a passionate reader, or a cultural enthusiast, 
                    Sahithyolsav promises two days of literary immersion, creative awakening, and unforgettable moments.
                </p>
            </section>

            <section className="contact-info-section home-section">
                <h2>Get in Touch</h2>
                <p>Have questions or need assistance? Reach out to us!</p>
                <ul>
                    <li><strong>Email:</strong> info@sahithyolsav.com</li>
                    <li><strong>Phone:</strong> +91 70253 03402</li>
                    <li><strong>Address:</strong> Sunni Center, Iritty Division,Vallithod, Kerala</li>
                </ul>
                <p>For more details, visit our <Link to="/info" className="text-link">Information Page</Link>.</p>
            </section>
        </div>
    );
};

export default HomePage;
