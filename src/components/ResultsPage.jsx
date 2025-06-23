// Path: src/components/ResultsPage.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext.jsx'; // Correct path to AuthContext
import { MessageBox } from './UtilityComponents.jsx'; // Import MessageBox
import { collection, onSnapshot } from 'firebase/firestore'; // Import Firestore functions

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

export default ResultsPage;
