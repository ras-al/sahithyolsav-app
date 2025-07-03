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

    // Determine the assigned stage for the current stage admin
    useEffect(() => {
        if (!currentUser || !db) return;

        // Extract stage name from email (e.g., "stage1@stage.com" -> "Stage 1")
        const emailParts = currentUser.email.split('@');
        if (emailParts.length === 2 && emailParts[1] === 'stage.com') {
            const stageNameFromEmail = emailParts[0].replace(/([a-z])([0-9])/g, '$1 $2').split(/(?=[A-Z])/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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
            setParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
                                    {/* Add button to view participants and assign codes */}
                                </div>

                                <div className="event-participants-group">
                                    <h5>Participants for {event.name}</h5>
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
                                                                    value={currentCode}
                                                                    onChange={(e) => {
                                                                        // This is a controlled component, but we need to update state
                                                                        // for the specific participant's event code.
                                                                        // For simplicity, we'll update on button click.
                                                                        // For real-time typing feedback, you'd need a more complex state management
                                                                        // for participant codes within this component.
                                                                    }}
                                                                    id={`code-${participant.id}-${event.id}`}
                                                                    placeholder="Enter Code"
                                                                    style={{ width: '60px', textTransform: 'uppercase', textAlign: 'center' }}
                                                                />
                                                            </td>
                                                            <td>
                                                                <button
                                                                    className="btn btn-primary btn-small"
                                                                    onClick={() => {
                                                                        const inputElement = document.getElementById(`code-${participant.id}-${event.id}`);
                                                                        if (inputElement) {
                                                                            handleUpdateParticipantCode(participant.id, event.id, inputElement.value);
                                                                        }
                                                                    }}
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
