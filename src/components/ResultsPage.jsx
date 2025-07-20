// Path: src/components/ResultsPage.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext.jsx'; // Correct path to AuthContext
import { MessageBox, Modal } from './UtilityComponents.jsx'; // Import MessageBox and Modal
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'; // Import orderBy for sorting

const ResultsPage = () => {
    const { db, appId } = useAuth();
    const [allEvents, setAllEvents] = useState([]); // State to hold all events
    const [publishedResults, setPublishedResults] = useState([]); // State to hold only published results
    const [participants, setParticipants] = useState([]); // State to hold all participants
    const [message, setMessage] = useState('');
    const [isPosterModalOpen, setIsPosterModalOpen] = useState(false);
    const [currentPosterBase64, setCurrentPosterBase64] = useState('');
    const [currentPosterEventName, setCurrentPosterEventName] = useState('');
    const [selectedEventId, setSelectedEventId] = useState(''); // State for selected event in form
    const [processedRankedParticipants, setProcessedRankedParticipants] = useState([]); // For displaying ranks before publishing

    useEffect(() => {
        if (!db) return;

        // 1. Fetch all events
        const eventsColRef = collection(db, `artifacts/${appId}/public/data/events`);
        // Order events by date and time to maintain a consistent display order
        const unsubscribeEvents = onSnapshot(query(eventsColRef, orderBy('date', 'asc'), orderBy('time', 'asc')), (snapshot) => {
            const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllEvents(eventsData);
        }, (error) => {
            console.error("Error fetching all events:", error);
            setMessage("Failed to load events. Please try again.");
        });

        // 2. Fetch published results
        const resultsColRef = collection(db, `artifacts/${appId}/public/data/results`);
        // Order results by timestamp in descending order (most recent first) for internal use
        const unsubscribeResults = onSnapshot(query(resultsColRef, orderBy('timestamp', 'desc')), (snapshot) => {
            const resultsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPublishedResults(resultsData);
            setMessage(''); // Clear message if results load successfully
        }, (error) => {
            console.error("Error fetching published results:", error);
            setMessage("Failed to load published results. Please try again.");
        });

        // 3. Fetch all participants (needed for sector lookup)
        const participantsColRef = collection(db, `artifacts/${appId}/public/data/participants`);
        const unsubscribeParticipants = onSnapshot(participantsColRef, (snapshot) => {
            setParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Error fetching participants:", error);
            setMessage("Failed to load participant data. Please try again.");
        });


        return () => {
            unsubscribeEvents();
            unsubscribeResults();
            unsubscribeParticipants(); // Cleanup participants listener
        };
    }, [db, appId]);

    // Combine events with their results and group by category
    const combinedResultsByCategory = allEvents.reduce((acc, event) => {
        const category = event.category || 'Uncategorized';
        if (!acc[category]) {
            acc[category] = [];
        }
        // Find the corresponding published result for this event
        const resultForEvent = publishedResults.find(res => res.eventId === event.id);

        acc[category].push({
            eventDetails: event,
            publishedResult: resultForEvent || null // Attach null if no result found
        });
        return acc;
    }, {});

    const handleViewPoster = (base64Data, eventName) => {
        setCurrentPosterBase64(base64Data);
        setCurrentPosterEventName(eventName);
        setIsPosterModalOpen(true);
    };

    const handleDownloadPoster = (base64Data, eventName) => {
        setMessage('');
        if (!base64Data) {
            setMessage("No poster available for download.");
            return;
        }
        try {
            const mimeTypeMatch = base64Data.match(/^data:(.*?);base64,/);
            const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
            const fileExtension = mimeType.split('/')[1] || 'png';

            const link = document.createElement('a');
            link.href = base64Data;
            link.download = `${eventName.replace(/[^a-zA-Z0-9]/g, '_')}_Result_Poster.${fileExtension}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setMessage(`Poster for "${eventName}" downloaded successfully!`);
        } catch (error) {
            console.error("Error downloading poster:", error);
            setMessage("Failed to download poster: " + error.message);
        }
    };


    return (
        <div className="page-container">
            <h1>Event Results</h1>
            <MessageBox message={message} type={message.includes("Failed") ? 'error' : 'info'} onClose={() => setMessage('')} />
            {Object.keys(combinedResultsByCategory).length === 0 ? (
                <p className="no-data-message">No events scheduled yet. Check back soon for results!</p>
            ) : (
                Object.entries(combinedResultsByCategory).map(([category, eventsWithResults]) => (
                    <section key={category} className="results-category-section">
                        <h2>Category: {category}</h2>
                        <div className="results-events-container">
                            {/* Display results in a table format */}
                            <table className="results-table">
                                <thead>
                                    <tr>
                                        <th>Event</th>
                                        <th>Competition Type</th>
                                        <th>1st Place (Name & Sector)</th>
                                        <th>2nd Place (Name & Sector)</th>
                                        <th>3rd Place (Name & Sector)</th>
                                        <th>Poster</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {combinedResultsByCategory[category].map(({ eventDetails, publishedResult }) => (
                                        <tr key={eventDetails.id}>
                                            <td>{eventDetails.name || 'N/A'}</td>
                                            <td>{eventDetails.competitionType || 'N/A'}</td>
                                            {[1, 2, 3].map(rank => {
                                                // Use filter to get all placements for the current rank
                                                const placementsForRank = publishedResult?.placements?.filter(p => p.rank === rank) || [];

                                                return (
                                                    <td key={rank}>
                                                        {placementsForRank.length > 0 ? (
                                                            placementsForRank.map((placement, index) => {
                                                                const participantDetails = participants.find(p => p.id === placement.participantId);
                                                                const participantSector = participantDetails ? participantDetails.sector : 'N/A';
                                                                const displayString = placement.pointsAwarded === 0 ?
                                                                    'Absent' :
                                                                    `${placement.participantName} (${participantSector}) (${placement.pointsAwarded} pts)`;
                                                                return (
                                                                    <React.Fragment key={index}>
                                                                        {displayString}
                                                                        {index < placementsForRank.length - 1 && ', '} {/* Add comma for multiple participants */}
                                                                    </React.Fragment>
                                                                );
                                                            })
                                                        ) : (
                                                            <span className="no-published-text">No Published</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td>
                                                {publishedResult?.posterBase64 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                                        <img src={publishedResult.posterBase64} alt="" className="results-table-poster" />
                                                        <div className="card-actions" style={{ justifyContent: 'center', marginTop: '5px' }}>
                                                            <button
                                                                className="btn btn-info btn-small"
                                                                onClick={() => handleViewPoster(publishedResult.posterBase64, eventDetails.name)}
                                                            >
                                                                View
                                                            </button>
                                                            <button
                                                                className="btn btn-secondary btn-small"
                                                                onClick={() => handleDownloadPoster(publishedResult.posterBase64, eventDetails.name)}
                                                            >
                                                                Download
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="no-published-text">No Published</span>
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

            <Modal
                isOpen={isPosterModalOpen}
                onClose={() => setIsPosterModalOpen(false)}
                title={`Poster for ${currentPosterEventName}`}
            >
                {currentPosterBase64 ? (
                    <img src={currentPosterBase64} alt={`Poster for ${currentPosterEventName}`} style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }} />
                ) : (
                    <p>No poster available to display.</p>
                )}
            </Modal>
        </div>
    );
};

export default ResultsPage;
