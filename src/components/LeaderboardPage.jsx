// Path: src/components/LeaderboardPage.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext.jsx'; // Correct path to AuthContext
import { MessageBox } from './UtilityComponents.jsx'; // Import MessageBox
import { doc, onSnapshot } from 'firebase/firestore'; // Import Firestore functions

const LeaderboardPage = () => {
    const { db, appId, EVENT_CATEGORIES } = useAuth(); // Destructure EVENT_CATEGORIES from useAuth
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

export default LeaderboardPage;
