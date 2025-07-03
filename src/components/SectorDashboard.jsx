// Path: src/components/SectorDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx'; // Correct path to AuthContext
import { MessageBox, LoadingSpinner } from './UtilityComponents.jsx'; // Import utility components
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';

const SectorDashboard = () => {
    const { currentUser, db, appId, loadingAuth, sectorDetails, EVENT_CATEGORIES } = useAuth(); // Destructure EVENT_CATEGORIES from useAuth
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
    const [selectedEvents, setSelectedEvents] = useState([]);
    const [editingParticipantId, setEditingParticipantId] = useState(null);

    // Redirect if not sector official or auth not ready
    useEffect(() => {
        if (!loadingAuth) {
            if (!currentUser || !currentUser.email || !currentUser.email.includes('@sector.com')) {
                navigate('/login');
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
    }, [db, appId, sectorDetails]);

    const handleAddParticipant = async (e) => {
        e.preventDefault();
        setMessage('');

        if (!sectorDetails) {
            setMessage("Sector details not loaded. Please try again after logging in as a sector official.");
            return;
        }

        try {
            const eventsForParticipant = selectedEvents.map(eventId => ({
                eventId: eventId,
                code: ''
            }));

            const participantData = {
                name: participantName,
                class: participantClass,
                age: parseInt(participantAge),
                sector: sectorDetails.name,
                unit: participantUnit,
                category: participantCategory,
                events: eventsForParticipant,
                registeredBySectorId: currentUser.uid,
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

    const availableEventsForCategory = events.filter(event => event.category === participantCategory);

    if (loadingAuth || !sectorDetails) {
        return <LoadingSpinner message="Loading sector data..." />;
    }

    return (
        <div className="page-container sector-dashboard">
            <h1>Sector Dashboard</h1>
            <p>Welcome, Sector Official: {sectorDetails.name} ({currentUser?.email})</p>
            <MessageBox message={message} type={message.includes("Failed") || message.includes("Error") ? 'error' : 'success'} onClose={() => setMessage('')} />

            <div className="admin-section">
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
                            setSelectedEvents([]);
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
                                        return `${eventName} (Code: ${e.code || 'N/A'})`;
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

export default SectorDashboard;
