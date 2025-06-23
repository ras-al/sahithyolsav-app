// Path: src/components/JudgeDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx'; // Correct path to AuthContext
import { MessageBox, LoadingSpinner } from './UtilityComponents.jsx'; // Import utility components
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc, getDocs } from 'firebase/firestore';

const JudgeDashboard = () => {
    const { currentUser, db, appId, loadingAuth } = useAuth();
    const navigate = useNavigate();
    const [assignedEvents, setAssignedEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [participantsForSelectedEvent, setParticipantsForSelectedEvent] = useState([]);
    const [scores, setScores] = useState({}); // {participantId: marks}
    const [message, setMessage] = useState('');
    const [currentEventDetails, setCurrentEventDetails] = useState(null);

    useEffect(() => {
        if (!loadingAuth) {
            if (!currentUser) {
                navigate('/login');
            } else if (!currentUser.email || !currentUser.email.includes('@judge.com')) {
                navigate('/login');
            }
        }
    }, [currentUser, loadingAuth, navigate]);

    useEffect(() => {
        if (!db || !currentUser || !currentUser.uid) {
            setAssignedEvents([]);
            return;
        }

        const eventsColRef = collection(db, `artifacts/${appId}/public/data/events`);
        const unsubscribe = onSnapshot(eventsColRef, (snapshot) => {
            const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const filteredEvents = allEvents.filter(event =>
                event.judges && event.judges.some(j => j.id === currentUser.uid)
            );
            setAssignedEvents(filteredEvents);

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

    useEffect(() => {
        if (!db || !selectedEventId || !currentUser || !currentUser.uid) {
            setParticipantsForSelectedEvent([]);
            setScores({});
            return;
        }

        const fetchParticipantsAndScores = async () => {
            try {
                const allParticipantsSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/participants`));
                const allParticipantsData = allParticipantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const filteredParticipants = allParticipantsData.filter(p =>
                    p.events && p.events.some(e => typeof e === 'object' && e.eventId === selectedEventId)
                ).map(p => {
                    const eventEntry = p.events.find(e => typeof e === 'object' && e.eventId === selectedEventId);
                    return {
                        id: p.id,
                        code: eventEntry.code || 'N/A',
                    };
                }).sort((a, b) => a.code.localeCompare(b.code));

                setParticipantsForSelectedEvent(filteredParticipants);

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
                setMessage('');
            } catch (error) {
                console.error("Error fetching participants or scores:", error);
                setMessage("Failed to load participants or existing scores.");
            }
        };

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
        }, (error) => {
            console.error("Error listening to score changes:", error);
        });

        fetchParticipantsAndScores();

        return () => scoresUnsubscribe();
    }, [db, selectedEventId, currentUser, appId]);

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
            const q = query(
                collection(db, `artifacts/${appId}/public/data/scores`),
                where('eventId', '==', selectedEventId),
                where('participantId', '==', participantId),
                where('judgeId', '==', currentUser.uid)
            );
            const existingScoresSnapshot = await getDocs(q);

            if (existingScoresSnapshot.empty) {
                await addDoc(collection(db, `artifacts/${appId}/public/data/scores`), {
                    eventId: selectedEventId,
                    participantId: participantId,
                    judgeId: currentUser.uid,
                    marks: marksToSubmit,
                    timestamp: new Date().toISOString()
                });
                setMessage(`Marks submitted for participant code: ${participantsForSelectedEvent.find(p => p.id === participantId)?.code || participantId}`);
            } else {
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
                    <p><strong>Location:</strong> {currentEventDetails.location || 'N/A'}</p>
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
                                <p>Participant Code: <strong>{participant.code}</strong></p>
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

export default JudgeDashboard;
