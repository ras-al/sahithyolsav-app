// Path: src/components/LiveEvents.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const LiveEvents = () => {
    const { db, appId } = useAuth();
    const [liveEventsByStage, setLiveEventsByStage] = useState({});
    const [allParticipants, setAllParticipants] = useState([]); // To fetch all participants for lookup
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!db) {
            setError("Database not initialized.");
            setLoading(false);
            return;
        }

        // Fetch all participants to easily look up names and playing status
        // This listener needs to be comprehensive to capture all participant data, including their events array
        const unsubscribeParticipants = onSnapshot(collection(db, `artifacts/${appId}/public/data/participants`), (snapshot) => {
            setAllParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => {
            console.error("Error fetching all participants:", err);
            setError("Failed to load participant data.");
        });

        const eventsRef = collection(db, `artifacts/${appId}/public/data/events`);
        // Query for events that are 'live' and 'isPublic'
        const q = query(
            eventsRef,
            where('status', '==', 'live'),
            where('isPublic', '==', true)
        );

        const unsubscribeEvents = onSnapshot(q, (snapshot) => {
            const fetchedEvents = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Group events by stage
            const groupedEvents = fetchedEvents.reduce((acc, event) => {
                const stage = event.stage || 'Off-Stage Events'; // Use 'Off-Stage Events' for events not explicitly on a stage
                if (!acc[stage]) {
                    acc[stage] = [];
                }
                acc[stage].push(event);
                return acc;
            }, {});

            // Sort stages alphabetically
            const sortedStages = Object.keys(groupedEvents).sort((a, b) => {
                if (a === 'Off-Stage Events') return 1; // Put off-stage at the end
                if (b === 'Off-Stage Events') return -1;
                return a.localeCompare(b);
            });

            const sortedGroupedEvents = {};
            sortedStages.forEach(stage => {
                // Sort events within each stage by time
                sortedGroupedEvents[stage] = groupedEvents[stage].sort((a, b) => {
                    const timeA = a.time || '23:59'; // Default to end of day if time missing
                    const timeB = b.time || '23:59';
                    return timeA.localeCompare(timeB);
                });
            });


            setLiveEventsByStage(sortedGroupedEvents);
            setLoading(false);
            setError(null);
        }, (err) => {
            console.error("Error fetching live events:", err);
            setError("Failed to load live events. Please try again later.");
            setLoading(false);
        });

        return () => {
            unsubscribeParticipants(); // Cleanup participant listener
            unsubscribeEvents(); // Cleanup event listener
        };
    }, [db, appId]);

    // Helper to convert 24-hour time to 12-hour AM/PM format
    const formatTime = (time24) => {
        if (!time24) return 'N/A';
        const [hours, minutes] = time24.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes));
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    if (loading) {
        return <div className="page-container">Loading live events...</div>;
    }

    if (error) {
        return <div className="page-container error-message">{error}</div>;
    }

    const hasLiveEvents = Object.keys(liveEventsByStage).length > 0;

    return (
        <div className="page-container live-events-page">
            <h2>Live Events Happening Now!</h2>
            {!hasLiveEvents && (
                <p className="no-live-events">No events are currently live. Please check back later!</p>
            )}

            {Object.entries(liveEventsByStage).map(([stage, events]) => (
                <div key={stage} className="live-stage-section">
                    <h3>{stage}</h3>
                    <div className="event-cards-container">
                        {events.map(event => {
                            // Filter participants who are playing in this specific event
                            const playingParticipants = allParticipants.filter(p =>
                                p.events && p.events.some(e => e.eventId === event.id && e.isPlaying)
                            );

                            return (
                                <div key={event.id} className="event-card live-event-card">
                                    <h4>{event.name}</h4>
                                    <p>Category: {event.category}</p>
                                    <p>Time: {formatTime(event.time)} {event.endTime ? `- ${formatTime(event.endTime)}` : ''}</p>
                                    <p>Stage: {event.stage}</p>
                                    {playingParticipants.length > 0 && (
                                        <div className="playing-participants">
                                            <strong>Playing:</strong>
                                            <ul>
                                                {playingParticipants.map(p => {
                                                    const eventEntry = p.events.find(e => e.eventId === event.id);
                                                    const participantCode = eventEntry ? eventEntry.code : 'N/A';
                                                    return (
                                                        <li key={p.id} className="playing-participant-code">
                                                            {participantCode}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    )}
                                    {event.posterBase64 && (
                                        <img src={event.posterBase64} alt={`${event.name} poster`} className="event-poster-thumbnail" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default LiveEvents;
