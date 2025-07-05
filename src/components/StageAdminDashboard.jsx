// Path: src/components/StageDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { MessageBox } from './UtilityComponents.jsx';
import { collection, onSnapshot, query, where, updateDoc, doc, getDoc } from 'firebase/firestore';

const StageDashboard = () => {
    const { currentUser, db, appId } = useAuth();
    const [message, setMessage] = useState('');
    const [assignedStage, setAssignedStage] = useState(null);
    const [events, setEvents] = useState([]);
    const [participants, setParticipants] = useState([]); // All participants for lookup
    // New state to manage participant codes in the input fields
    const [participantCodes, setParticipantCodes] = useState({});

    // Determine the assigned stage for the current stage admin
    useEffect(() => {
        if (!currentUser || !db) return;

        // Extract stage name from email (e.g., "stage1@stage.com" -> "Stage 1")
        const emailParts = currentUser.email.split('@');
        if (emailParts.length === 2 && emailParts[1] === 'stage.com') {
            // Convert "stage1" to "Stage 1", "offstage" to "Off Stage"
            let stageNameFromEmail = emailParts[0].replace(/([a-z])([0-9])/g, '$1 $2').split(/(?=[A-Z])/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            if (stageNameFromEmail.toLowerCase() === 'offstage') {
                stageNameFromEmail = 'Off Stage';
            }
            setAssignedStage(stageNameFromEmail);
        } else {
            setMessage("Error: You are not authorized as a Stage Admin.");
            setAssignedStage(null);
        }
    }, [currentUser, db]);

    // Fetch events for the assigned stage
    useEffect(() => {
        if (!db || !assignedStage) return;

        const q = query(
            collection(db, `artifacts/${appId}/public/data/events`),
            where('stage', '==', assignedStage)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Error fetching events for stage:", error);
            setMessage("Failed to load events for your stage: " + error.message);
        });

        return () => unsubscribe();
    }, [db, appId, assignedStage]);

    // Fetch all participants (needed for assigning codes)
    useEffect(() => {
        if (!db) return;

        const unsubscribe = onSnapshot(collection(db, `artifacts/${appId}/public/data/participants`), (snapshot) => {
            const fetchedParticipants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setParticipants(fetchedParticipants);

            // Initialize participantCodes state from fetched data
            const initialCodes = {};
            fetchedParticipants.forEach(p => {
                p.events?.forEach(eventEntry => {
                    if (eventEntry.code) {
                        initialCodes[`${p.id}-${eventEntry.eventId}`] = eventEntry.code;
                    }
                });
            });
            setParticipantCodes(initialCodes);

        }, (error) => console.error("Error fetching participants:", error));

        return () => unsubscribe();
    }, [db, appId]);

    const handleUpdateEventStatus = async (eventId, newStatus) => {
        setMessage('');
        try {
            const eventDocRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
            await updateDoc(eventDocRef, { status: newStatus });
            setMessage(`Event status updated to "${newStatus}"!`);
        } catch (error) {
            console.error("Error updating event status:", error);
            setMessage("Failed to update event status: " + error.message);
        }
    };

    const handleUpdateParticipantCode = async (participantId, eventId, newCode) => {
        setMessage('');
        if (!newCode.trim()) {
            setMessage("Participant code cannot be empty.");
            return;
        }
        try {
            const participantRef = doc(db, `artifacts/${appId}/public/data/participants`, participantId);
            const participantSnap = await getDoc(participantRef);

            if (!participantSnap.exists()) {
                setMessage("Participant not found.");
                return;
            }

            const currentEvents = participantSnap.data().events || [];
            const updatedEvents = currentEvents.map(eventEntry =>
                eventEntry.eventId === eventId ? { ...eventEntry, code: newCode.toUpperCase() } : eventEntry
            );

            await updateDoc(participantRef, { events: updatedEvents });
            setMessage(`Participant code for ${newCode.toUpperCase()} updated successfully!`);
        } catch (error) {
            console.error("Error updating participant code:", error);
            setMessage("Failed to update participant code: " + error.message);
        }
    };

    if (!assignedStage) {
        return (
            <div className="page-container stage-dashboard">
                <h1>Stage Dashboard</h1>
                <MessageBox message={message || "Loading stage information..."} type={message.includes("Error") ? 'error' : 'info'} />
            </div>
        );
    }

    return (
        <div className="page-container stage-dashboard">
            <h1>Stage Dashboard - {assignedStage}</h1>
            <p>Welcome, {currentUser?.email}!</p>
            <MessageBox message={message} type={message.includes("Failed") || message.includes("Error") ? 'error' : 'success'} onClose={() => setMessage('')} />

            <div className="admin-section"> {/* Reusing admin-section styles for consistency */}
                <h3>Events for {assignedStage}</h3>
                {events.length === 0 ? (
                    <p>No events assigned to this stage yet.</p>
                ) : (
                    <div className="event-list-cards"> {/* Reusing event-list-cards styles */}
                        {events.map(event => (
                            <div key={event.id} className="list-card event-list-card">
                                <p><strong>{event.name}</strong> ({event.category})</p>
                                <p>Date: {event.date}, Time: {event.time}</p>
                                <p>Status: <span className={`event-status ${event.status}`}>{event.status}</span></p>
                                <div className="card-actions">
                                    <button
                                        className={`btn ${event.status === 'live' ? 'btn-success' : 'btn-outline-success'}`}
                                        onClick={() => handleUpdateEventStatus(event.id, 'live')}
                                        disabled={event.status === 'live'}
                                    >
                                        Set Live
                                    </button>
                                    <button
                                        className={`btn ${event.status === 'over' ? 'btn-warn' : 'btn-outline-warn'}`}
                                        onClick={() => handleUpdateEventStatus(event.id, 'over')}
                                        disabled={event.status === 'over'}
                                    >
                                        Set Over
                                    </button>
                                </div>

                                <div className="event-participants-group">
                                    <h6>Participants for {event.name}</h6>
                                    <table className="participant-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Class</th>
                                                <th>Age</th>
                                                <th>Sector</th>
                                                <th>Unit</th>
                                                <th>Code</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {participants.filter(p => p.events && p.events.some(e => e.eventId === event.id))
                                                .map(participant => {
                                                    const eventEntry = participant.events.find(e => e.eventId === event.id);
                                                    const currentCode = eventEntry ? eventEntry.code : '';
                                                    const inputKey = `${participant.id}-${event.id}`;

                                                    return (
                                                        <tr key={participant.id}>
                                                            <td>{participant.name}</td>
                                                            <td>{participant.class}</td>
                                                            <td>{participant.age}</td>
                                                            <td>{participant.sector}</td>
                                                            <td>{participant.unit}</td>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    value={participantCodes[inputKey] !== undefined ? participantCodes[inputKey] : currentCode}
                                                                    onChange={(e) => setParticipantCodes(prev => ({
                                                                        ...prev,
                                                                        [inputKey]: e.target.value
                                                                    }))}
                                                                    placeholder="Code"
                                                                    style={{ width: '60px', textTransform: 'uppercase', textAlign: 'center' }}
                                                                />
                                                            </td>
                                                            <td>
                                                                <button
                                                                    className="btn btn-primary btn-small"
                                                                    onClick={() => handleUpdateParticipantCode(participant.id, event.id, participantCodes[inputKey] || currentCode)}
                                                                >
                                                                    Update Code
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StageDashboard;
