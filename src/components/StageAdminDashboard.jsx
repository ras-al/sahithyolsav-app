// Path: src/components/StageAdminDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx'; // Correct path to AuthContext
import { MessageBox, LoadingSpinner } from './UtilityComponents.jsx'; // Import utility components
import { collection, onSnapshot, query, where, updateDoc, doc,addDoc,deleteDoc,getDocs, setDoc, getDoc, writeBatch } from 'firebase/firestore'; // Import writeBatch // Import writeBatch

const StageAdminDashboard = () => {
    const { currentUser, db, appId, loadingAuth, stageDetails } = useAuth();
    const navigate = useNavigate();
    const [assignedEvents, setAssignedEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [participantsForSelectedEvent, setParticipantsForSelectedEvent] = useState([]);
    const [message, setMessage] = useState('');
    const [currentEventDetails, setCurrentEventDetails] = useState(null);

    // Redirect if not stage admin or auth not ready
    useEffect(() => {
        if (!loadingAuth) {
            if (!currentUser) {
                navigate('/login');
            } else if (!currentUser.email || !currentUser.email.includes('@stage.com')) {
                // If not a stage.com email, redirect to home or login
                navigate('/'); // Or '/login'
            }
        }
    }, [currentUser, loadingAuth, navigate]);

    // Fetch events assigned to this stage admin's stage
    useEffect(() => {
        if (!db || !stageDetails?.assignedStage) {
            setAssignedEvents([]);
            return;
        }

        const eventsColRef = collection(db, `artifacts/${appId}/public/data/events`);
        // Query events where the 'stage' field matches the assignedStage of this stage admin
        const q = query(eventsColRef, where('stage', '==', stageDetails.assignedStage));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAssignedEvents(eventsData);

            // If an event is currently selected, update its details in case status changed
            if (selectedEventId) {
                const updatedEvent = eventsData.find(e => e.id === selectedEventId);
                setCurrentEventDetails(updatedEvent);
            }
        }, (error) => {
            console.error("Error fetching assigned events for stage admin:", error);
            setMessage("Failed to load assigned events. Please try again.");
        });

        return () => unsubscribe();
    }, [db, appId, stageDetails, selectedEventId]);

    // Fetch participants for the selected event
    useEffect(() => {
        if (!db || !selectedEventId) {
            setParticipantsForSelectedEvent([]);
            return;
        }

        const fetchParticipants = async () => {
            try {
                const participantsColRef = collection(db, `artifacts/${appId}/public/data/participants`);
                // Fetch all participants and filter in memory for simplicity and to handle complex array-contains-any queries
                const allParticipantsSnap = await getDocs(participantsColRef);
                const allParticipantsData = allParticipantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const filteredParticipants = allParticipantsData.filter(p =>
                    p.events && p.events.some(e => typeof e === 'object' && e.eventId === selectedEventId)
                ).map(p => {
                    const eventEntry = p.events.find(e => typeof e === 'object' && e.eventId === selectedEventId);
                    return {
                        id: p.id,
                        name: p.name, // Include name for display
                        code: eventEntry.code || '', // Current code, if any
                        originalEvents: p.events // Keep original events array to update
                    };
                }).sort((a, b) => a.name.localeCompare(b.name)); // Sort by name for consistent display

                setParticipantsForSelectedEvent(filteredParticipants);
                setMessage(''); // Clear any previous messages
            } catch (error) {
                console.error("Error fetching participants for selected event:", error);
                setMessage("Failed to load participants for this event.");
            }
        };

        fetchParticipants();
        // Add a snapshot listener for participants to update in real-time if codes are assigned
        const participantsUnsubscribe = onSnapshot(collection(db, `artifacts/${appId}/public/data/participants`), (snapshot) => {
            const updatedParticipants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const filtered = updatedParticipants.filter(p =>
                p.events && p.events.some(e => typeof e === 'object' && e.eventId === selectedEventId)
            ).map(p => {
                const eventEntry = p.events.find(e => typeof e === 'object' && e.eventId === selectedEventId);
                return {
                    id: p.id,
                    name: p.name,
                    code: eventEntry.code || '',
                    originalEvents: p.events
                };
            }).sort((a, b) => a.name.localeCompare(b.name));
            setParticipantsForSelectedEvent(filtered);
        }, (error) => {
            console.error("Error listening to participant changes:", error);
        });

        return () => participantsUnsubscribe();
    }, [db, appId, selectedEventId]);


    // Helper function to generate alphabetical codes (A, B, ..., Z, AA, AB, ...)
    const generateAlphabeticalCode = (index) => {
        let code = '';
        while (index >= 0) {
            code = String.fromCharCode(65 + (index % 26)) + code;
            index = Math.floor(index / 26) - 1;
        }
        return code;
    };

    // Handle generating random codes for participants
    const handleGenerateParticipantCodes = async () => {
        setMessage('');
        if (!selectedEventId) {
            setMessage("Please select an event first.");
            return;
        }

        const participantsWithoutCode = participantsForSelectedEvent.filter(p => !p.code);

        if (participantsWithoutCode.length === 0) {
            setMessage("All participants for this event already have codes assigned.");
            return;
        }

        // Shuffle participants to ensure random allocation
        const shuffledParticipants = [...participantsWithoutCode].sort(() => Math.random() - 0.5);

        const batch = writeBatch(db);
        let assignedCount = 0;

        for (let i = 0; i < shuffledParticipants.length; i++) {
            const participant = shuffledParticipants[i];
            const newCode = generateAlphabeticalCode(i); // Generate code based on shuffled index

            // Find the specific event entry within the participant's events array
            const participantDocRef = doc(db, `artifacts/${appId}/public/data/participants`, participant.id);
            
            // Update the events array for this participant
            const updatedEvents = participant.originalEvents.map(eventEntry => {
                if (eventEntry.eventId === selectedEventId) {
                    return { ...eventEntry, code: newCode }; // Assign the new code
                }
                return eventEntry;
            });
            batch.update(participantDocRef, { events: updatedEvents });
            assignedCount++;
        }

        try {
            await batch.commit();
            setMessage(`Successfully generated and assigned codes for ${assignedCount} participants.`);
        } catch (error) {
            console.error("Error generating participant codes:", error);
            setMessage("Failed to generate participant codes: " + error.message);
        }
    };

    // Handle clearing participant codes for a selected event
    const handleClearParticipantCodes = async () => {
        setMessage('');
        if (!selectedEventId) {
            setMessage("Please select an event first.");
            return;
        }

        if (!window.confirm("Are you sure you want to clear all assigned codes for this event? This action cannot be undone.")) {
            return;
        }

        const batch = writeBatch(db);
        let clearedCount = 0;

        for (const participant of participantsForSelectedEvent) {
            if (participant.code) { // Only clear if a code exists
                const participantDocRef = doc(db, `artifacts/${appId}/public/data/participants`, participant.id);
                
                const updatedEvents = participant.originalEvents.map(eventEntry => {
                    if (eventEntry.eventId === selectedEventId) {
                        return { ...eventEntry, code: '' }; // Clear the code
                    }
                    return eventEntry;
                });
                batch.update(participantDocRef, { events: updatedEvents });
                clearedCount++;
            }
        }

        try {
            await batch.commit();
            setMessage(`Successfully cleared codes for ${clearedCount} participants.`);
        } catch (error) {
            console.error("Error clearing participant codes:", error);
            setMessage("Failed to clear participant codes: " + error.message);
        }
    };

    // Handle updating event status (Live/Over)
    const handleSetEventStatus = async (status) => {
        setMessage('');
        if (!selectedEventId) {
            setMessage("Please select an event first.");
            return;
        }
        try {
            const eventDocRef = doc(db, `artifacts/${appId}/public/data/events`, selectedEventId);
            await updateDoc(eventDocRef, { status: status });
            setMessage(`Event status set to '${status}' successfully!`);
        } catch (error) {
            console.error(`Error setting event status to ${status}:`, error);
            setMessage(`Failed to set event status to ${status}: ` + error.message);
        }
    };


    if (loadingAuth) {
        return <LoadingSpinner message="Authenticating stage admin permissions..." />;
    }

    if (!currentUser || !currentUser.email || !currentUser.email.includes('@stage.com') || !stageDetails) {
        return (
            <div className="page-container stage-admin-dashboard">
                <h1>Stage Admin Dashboard</h1>
                <MessageBox
                    message="You are not authorized to access the Stage Admin Dashboard. Please log in with a stage admin account."
                    type="error"
                />
            </div>
        );
    }

    return (
        <div className="page-container stage-admin-dashboard flex flex-col items-center">
            <h1>Stage Admin Dashboard</h1>
            <p>Welcome, Stage Admin: {stageDetails.name} ({currentUser?.email})</p>
            <p>Managing Stage: <strong>{stageDetails.assignedStage}</strong></p>
            <MessageBox message={message} type={message.includes("Failed") || message.includes("Error") ? 'error' : 'success'} onClose={() => setMessage('')} />

            <div className="form-group w-full max-w-md"> {/* Added w-full max-w-md for better centering */}
                <label htmlFor="select-event">Select Event to Manage:</label>
                <select id="select-event" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                    <option value="">-- Choose an Event --</option>
                    {assignedEvents.length === 0 ? (
                        <option disabled>No events assigned to your stage.</option>
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
                <div className="selected-event-info card w-full max-w-md"> {/* Added w-full max-w-md */}
                    <h3>Event: {currentEventDetails.name}</h3>
                    <p><strong>Status:</strong> <span className={`event-status ${currentEventDetails.status}`}>{currentEventDetails.status}</span></p>
                    <p><strong>Time:</strong> {currentEventDetails.time}</p>
                    <p><strong>Judges:</strong> {currentEventDetails.judges?.map(j => j.name).join(', ') || 'N/A'}</p>
                    <div className="card-actions" style={{ justifyContent: 'center' }}>
                        <button
                            className="btn btn-success"
                            onClick={() => handleSetEventStatus('live')}
                            disabled={currentEventDetails.status === 'live'}
                        >
                            Set Live
                        </button>
                        <button
                            className="btn btn-danger"
                            onClick={() => handleSetEventStatus('over')}
                            disabled={currentEventDetails.status === 'over'}
                        >
                            Set Over
                        </button>
                    </div>
                </div>
            )}

            {selectedEventId && currentEventDetails && (
                <div className="participants-for-event admin-section w-full max-w-md"> {/* Added w-full max-w-md */}
                    <h4>Participants for {currentEventDetails.name}</h4>
                    <div className="form-card" style={{ textAlign: 'center' }}>
                        <h5>Manage Participant Codes</h5>
                        <p>Generate random alphabetical codes or clear existing ones for participants in this event.</p>
                        <div className="card-actions" style={{ justifyContent: 'center', gap: '15px' }}>
                            <button
                                className="btn btn-primary"
                                onClick={handleGenerateParticipantCodes}
                                disabled={!currentEventDetails || (currentEventDetails.status !== 'scheduled' && currentEventDetails.status !== 'live')}
                            >
                                Generate Codes
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={handleClearParticipantCodes}
                                disabled={!currentEventDetails || participantsForSelectedEvent.filter(p => p.code).length === 0}
                            >
                                Clear Codes
                            </button>
                        </div>
                        <small className="warn-message" style={{ display: 'block', marginTop: '10px' }}>
                            Codes can only be generated for 'Scheduled' or 'Live' events. Clearing is always possible.
                        </small>
                    </div>

                    {participantsForSelectedEvent.length > 0 ? (
                        <table className="participant-table">
                            <thead>
                                <tr>
                                    <th>Participant Name</th>
                                    <th>Current Code</th>
                                </tr>
                            </thead>
                            <tbody>
                                {participantsForSelectedEvent.map(participant => (
                                    <tr key={participant.id}>
                                        <td>{participant.name}</td>
                                        <td>
                                            <input
                                                type="text"
                                                value={participant.code || 'N/A'}
                                                disabled
                                                className="disabled-input"
                                                style={{ width: '120px', textTransform: 'uppercase', textAlign: 'center' }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="no-data-message">No participants registered for this event yet.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default StageAdminDashboard;
