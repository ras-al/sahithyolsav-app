// Path: src/components/AdminDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx'; // Correct path to AuthContext
import { MessageBox, Modal } from './UtilityComponents.jsx'; // Import utility components
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, setDoc, writeBatch, getDoc } from 'firebase/firestore'; // Import writeBatch and getDoc
import { createUserWithEmailAndPassword } from 'firebase/auth'; // Explicitly import createUserWithEmailAndPassword
import * as XLSX from 'xlsx'; // Import xlsx library

// Define point schemes for leaderboard based on rank
const RANK_POINT_SCHEMES = {
    group: {
        name: "Group Competition (8/5/3)",
        points: { 1: 8, 2: 5, 3: 3 } // Updated points for group competition
    },
    single: {
        name: "Single Competition (5/3/1)",
        points: { 1: 5, 2: 3, 3: 1 } // Updated points for single competition
    }
};

const AdminDashboard = () => {
    const { currentUser, db, auth, appId, EVENT_CATEGORIES } = useAuth(); // Destructure 'auth' and EVENT_CATEGORIES from useAuth
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('events'); // Default active tab
    const [message, setMessage] = useState('');
    const [judges, setJudges] = useState([]);
    const [events, setEvents] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [stageAdmins, setStageAdmins] = useState([]); // New state for stage admins

    // Redirect if not admin (handled by PrivateRoute, but a fallback is good)
    useEffect(() => {
        if (!currentUser || currentUser.email !== 'admin@sahithyolsav.com') {
            console.log("AdminDashboard: Not authorized or not admin, redirecting (handled by PrivateRoute).");
        }
    }, [currentUser, navigate]);

    // Fetch data for all admin sections
    useEffect(() => {
        if (!db) return;

        const unsubscribeJudges = onSnapshot(collection(db, `artifacts/${appId}/public/data/judges`), (snapshot) => {
            setJudges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching judges:", error));

        const unsubscribeEvents = onSnapshot(collection(db, `artifacts/${appId}/public/data/events`), (snapshot) => {
            setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching events:", error));

        const unsubscribeParticipants = onSnapshot(collection(db, `artifacts/${appId}/public/data/participants`), (snapshot) => {
            setParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching participants:", error));

        const unsubscribeSectors = onSnapshot(collection(db, `artifacts/${appId}/public/data/sectors`), (snapshot) => {
            setSectors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching sectors:", error));

        // New: Fetch Stage Admins
        const unsubscribeStageAdmins = onSnapshot(collection(db, `artifacts/${appId}/public/data/stage_admins`), (snapshot) => {
            setStageAdmins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching stage admins:", error));


        return () => {
            unsubscribeJudges();
            unsubscribeEvents();
            unsubscribeParticipants();
            unsubscribeSectors();
            unsubscribeStageAdmins(); // Cleanup stage admins listener
        };
    }, [db, appId]);

    // --- Admin-specific Functions (moved to top-level AdminDashboard) ---

    const handleDownloadParticipantsExcel = async (eventId, eventName, participantsInEvent) => {
        setMessage('');
        try {
            const headers = ["Participant Code", "Name", "Class", "Age", "Sector", "Unit", "Category"];

            const csvRows = participantsInEvent.map(p => {
                const eventEntry = p.events.find(e => e.eventId === eventId);
                const code = eventEntry ? eventEntry.code : 'N/A';
                return [
                    code,
                    p.name,
                    p.class,
                    p.age,
                    p.sector,
                    p.unit,
                    p.category
                ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
            });

            const csvContent = [headers.join(','), ...csvRows].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `${eventName.replace(/[^a-zA-Z0-9]/g, '_')}_Participants.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setMessage(`Participant list for "${eventName}" downloaded successfully!`);
        } catch (error) {
            console.error("Error downloading participant list:", error);
            setMessage("Failed to download participant list: " + error.message);
        }
    };

    // --- Admin-specific Sub-Components ---

    const ManageEvents = () => {
        const [eventName, setEventName] = useState('');
        const [eventDate, setEventDate] = useState('');
        const [eventTime, setEventTime] = useState('');
        // Removed eventLocation state
        const [eventStageType, setEventStageType] = useState('on-stage'); // 'on-stage' or 'off-stage'
        const [eventStageNumber, setEventStageNumber] = useState(''); // E.g., 'Stage 1', 'Stage 2'
        const [eventCategory, setEventCategory] = useState(EVENT_CATEGORIES[0]);
        const [competitionType, setCompetitionType] = useState('single');
        const [totalMarks, setTotalMarks] = useState(100);
        const [selectedJudgeIds, setSelectedJudgeIds] = useState([]);
        const [judgeMarkDistribution, setJudgeMarkDistribution] = useState({});
        const [isViewScoresModalOpen, setIsViewScoresModalOpen] = useState(false);
        const [scoresForEvent, setScoresForEvent] = useState([]);
        const [selectedEventForScores, setSelectedEventForScores] = useState(null);
        const [editingEventId, setEditingEventId] = useState(null);
        const [isPublic, setIsPublic] = useState(false); // New state for public visibility
        const [eventSearchTerm, setEventSearchTerm] = useState(''); // New state for event search

        const handleAddEvent = async (e) => {
            e.preventDefault();
            setMessage('');

            if (selectedJudgeIds.length > 3) {
                setMessage("An event can have a maximum of 3 judges.");
                return;
            }

            const currentJudges = judges.filter(j => selectedJudgeIds.includes(j.id));
            const judgesWithNames = currentJudges.map(j => ({ id: j.id, name: j.name }));

            const distributedSum = Object.values(judgeMarkDistribution).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
            if (distributedSum !== parseInt(totalMarks)) {
                setMessage("Sum of judge marks must equal total marks for the event.");
                return;
            }

            // Validation for stage number if on-stage
            if (eventStageType === 'on-stage' && !eventStageNumber.trim()) {
                setMessage("Stage Number is required for 'On Stage' events.");
                return;
            }

            try {
                const eventData = {
                    name: eventName,
                    date: eventDate,
                    time: eventTime,
                    // Removed location from eventData
                    stageType: eventStageType, // 'on-stage' or 'off-stage'
                    stage: eventStageType === 'on-stage' ? eventStageNumber : 'N/A', // Actual stage name/number
                    category: eventCategory,
                    competitionType: competitionType,
                    totalMarks: parseInt(totalMarks),
                    judges: judgesWithNames,
                    markDistribution: judgeMarkDistribution,
                    status: 'scheduled', // Default status for new events
                    isPublic: isPublic // Save public visibility status
                };

                if (editingEventId) {
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/events`, editingEventId), eventData);
                    setMessage("Event updated successfully!");
                    setEditingEventId(null);
                } else {
                    await addDoc(collection(db, `artifacts/${appId}/public/data/events`), eventData);
                    setMessage("Event added successfully!");
                }
                // Reset form
                setEventName('');
                setEventDate('');
                setEventTime('');
                // Removed setEventLocation
                setEventStageType('on-stage'); // Reset to default
                setEventStageNumber(''); // Reset stage number
                setEventCategory(EVENT_CATEGORIES[0]);
                setCompetitionType('single');
                setTotalMarks(100);
                setSelectedJudgeIds([]);
                setJudgeMarkDistribution({});
                setIsPublic(false); // Reset public visibility
            } catch (error) {
                console.error("Error adding/updating event:", error);
                setMessage("Failed to add/update event: " + error.message);
            }
        };

        const handleEditEvent = (event) => {
            setEditingEventId(event.id);
            setEventName(event.name);
            setEventDate(event.date);
            setEventTime(event.time);
            // Removed event.location from here
            setEventStageType(event.stageType || 'on-stage');
            setEventStageNumber(event.stageType === 'on-stage' ? (event.stage || '') : '');
            setEventCategory(event.category);
            setCompetitionType(event.competitionType || 'single');
            setTotalMarks(event.totalMarks);
            setSelectedJudgeIds(event.judges?.map(j => j.id) || []);
            setJudgeMarkDistribution(event.markDistribution || {});
            setIsPublic(event.isPublic || false); // Set public visibility for editing
        };

        const handleJudgeSelection = (e) => {
            const options = Array.from(e.target.selectedOptions).map(option => option.value);
            setSelectedJudgeIds(options);

            const newDistribution = {};
            options.forEach(id => {
                newDistribution[id] = judgeMarkDistribution[id] || 0;
            });
            setJudgeMarkDistribution(newDistribution);
        };

        const handleMarkDistributionChange = (judgeId, value) => {
            setJudgeMarkDistribution(prev => ({
                ...prev,
                [judgeId]: parseInt(value) || 0
            }));
        };

        // New function to set event status to 'scheduled'
        const handleSetEventToScheduled = async (eventId) => {
            setMessage('');
            try {
                const eventDocRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
                await updateDoc(eventDocRef, { status: 'scheduled' });
                setMessage("Event status updated to 'scheduled'!");
            } catch (error) {
                console.error("Error setting event to scheduled:", error);
                setMessage("Failed to set event to scheduled: " + error.message);
            }
        };

        const handleTogglePublic = async (eventId, currentIsPublic) => {
            setMessage('');
            try {
                const eventDocRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
                await updateDoc(eventDocRef, { isPublic: !currentIsPublic });
                setMessage(`Event public visibility toggled to "${!currentIsPublic}"!`);
            } catch (error) {
                console.error("Error toggling public status:", error);
                setMessage("Failed to toggle public status: " + error.message);
            }
        };

        const handleDeleteEvent = async (eventId) => {
            if (!window.confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
                return;
            }
            setMessage('');
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/events`, eventId));
                setMessage("Event deleted successfully!");
            } catch (error) {
                console.error("Error deleting event:", error);
                setMessage("Failed to delete event: " + error.message);
            }
        };

        const handleViewJudgeScores = async (event) => {
            setMessage('');
            try {
                const scoresQuery = query(
                    collection(db, `artifacts/${appId}/public/data/scores`),
                    where('eventId', '==', event.id)
                );
                const scoresSnapshot = await getDocs(scoresQuery);
                const fetchedScores = scoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const enrichedScores = fetchedScores.map(score => {
                    const participant = participants.find(p => p.id === score.participantId);
                    const judge = judges.find(j => j.id === score.judgeId);
                    return {
                        ...score,
                        participantName: participant ? participant.name : 'Unknown Participant',
                        judgeName: judge ? judge.name : 'Unknown Judge'
                    };
                });

                setScoresForEvent(enrichedScores);
                setSelectedEventForScores(event);
                setIsViewScoresModalOpen(true);
            } catch (error) {
                console.error("Error fetching judge scores for event:", error);
                setMessage("Failed to fetch judge scores: " + error.message);
            }
        };

        const handleProcessEventRanks = async (event) => {
            setMessage('');
            try {
                const competitionTypeKey = event.competitionType || 'single';
                const currentRankPoints = RANK_POINT_SCHEMES[competitionTypeKey]?.points;

                if (!currentRankPoints) {
                    setMessage(`Error: No point scheme defined for competition type '${competitionTypeKey}'.`);
                    return;
                }

                // Correctly define scoresQuery here
                const scoresQuery = query(
                    collection(db, `artifacts/${appId}/public/data/scores`),
                    where('eventId', '==', event.id)
                );
                const scoresSnapshot = await getDocs(scoresQuery);
                const scoresData = scoresSnapshot.docs.map(doc => doc.data());

                const participantTotalScores = {};
                scoresData.forEach(score => {
                    if (participantTotalScores[score.participantId]) {
                        participantTotalScores[score.participantId] += score.marks;
                    } else {
                        participantTotalScores[score.participantId] = score.marks;
                    }
                });

                const rankedParticipants = Object.entries(participantTotalScores)
                    .map(([participantId, totalScore]) => ({ participantId, totalScore }))
                    .sort((a, b) => b.totalScore - a.totalScore);

                // Clear existing rank points for this event
                const existingRankPointsQuery = query(
                    collection(db, `artifacts/${appId}/public/data/event_rank_points`),
                    where('eventId', '==', event.id)
                );
                const existingRankPointsSnapshot = await getDocs(existingRankPointsQuery);
                const deletePromises = existingRankPointsSnapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);

                for (let i = 0; i < rankedParticipants.length; i++) {
                    const participant = rankedParticipants[i];
                    const participantDetails = participants.find(p => p.id === participant.participantId);

                    let currentRank = 0;
                    if (i > 0 && participant.totalScore === rankedParticipants[i - 1].totalScore) {
                        currentRank = rankedParticipants[i - 1].rank;
                    } else {
                        currentRank = i + 1;
                    }

                    const pointsToAward = currentRankPoints[currentRank] || 0;

                    if (pointsToAward > 0) {
                        await addDoc(collection(db, `artifacts/${appId}/public/data/event_rank_points`), {
                            eventId: event.id,
                            eventName: event.name,
                            participantId: participant.participantId,
                            participantName: participantDetails ? participantDetails.name : 'Unknown Participant',
                            participantSector: participantDetails ? participantDetails.sector : 'Unknown Sector',
                            participantCategory: event.category,
                            rank: currentRank,
                            pointsAwarded: pointsToAward,
                            participantEventTotalScore: participant.totalScore,
                            competitionType: competitionTypeKey,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                setMessage(`Ranks processed for event: ${event.name}. Remember to recalculate leaderboard.`);
            } catch (error) {
                console.error("Error processing event ranks:", error);
                setMessage("Failed to process event ranks: " + error.message);
            }
        };

        const handleDownloadPoster = (base64Data, eventName) => {
            setMessage('');
            if (!base64Data) {
                setMessage("No poster available for this event.");
                return;
            }
            try {
                const mimeTypeMatch = base64Data.match(/^data:(.*?);base64,/);
                const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
                const fileExtension = mimeType.split('/')[1] || 'png';

                const link = document.createElement('a');
                link.href = base64Data;
                link.download = `${eventName.replace(/[^a-zA-Z0-9]/g, '_')}_Poster.${fileExtension}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setMessage(`Poster for "${eventName}" downloaded successfully!`);
            } catch (error) {
                console.error("Error downloading poster:", error);
                setMessage("Failed to download poster: " + error.message);
            }
        };

        // Filter events based on search term
        const filteredEvents = events.filter(event =>
            event.name.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
            event.category.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
            (event.stageType === 'on-stage' && event.stage.toLowerCase().includes(eventSearchTerm.toLowerCase()))
        );

        const eventsByCategory = filteredEvents.reduce((acc, event) => {
            const category = event.category || 'Uncategorized';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(event);
            return acc;
        }, {});

        return (
            <div className="admin-section">
                <h3>Manage Events</h3>
                <form onSubmit={handleAddEvent} className="form-card">
                    <h4>{editingEventId ? 'Edit Event' : 'Add New Event'}</h4>
                    <div className="form-group">
                        <label>Event Name:</label>
                        <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Date (YYYY-MM-DD):</label>
                        <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Time:</label>
                        <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} required />
                    </div>
                    {/* Removed Location input field */}
                    <div className="form-group">
                        <label>Stage Type:</label>
                        <select value={eventStageType} onChange={(e) => {
                            setEventStageType(e.target.value);
                            if (e.target.value === 'off-stage') {
                                setEventStageNumber(''); // Clear stage number if off-stage
                            }
                        }} required>
                            <option value="on-stage">On Stage</option>
                            <option value="off-stage">Off Stage</option>
                        </select>
                    </div>
                    {eventStageType === 'on-stage' && (
                        <div className="form-group">
                            <label>Stage Number (e.g., Stage 1, Stage 2):</label>
                            <select value={eventStageNumber} onChange={(e) => setEventStageNumber(e.target.value)} required>
                                <option value="">-- Select Stage Number --</option>
                                {stageAdmins.map(stage => (
                                    <option key={stage.id} value={stage.assignedStage}>{stage.assignedStage}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="form-group">
                        <label>Category:</label>
                        <select value={eventCategory} onChange={(e) => setEventCategory(e.target.value)} required>
                            {EVENT_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Competition Type:</label>
                        <select value={competitionType} onChange={(e) => setCompetitionType(e.target.value)} required>
                            <option value="single">Single Competition</option>
                            <option value="group">Group Competition</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Total Marks:</label>
                        <input type="number" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} min="1" required />
                    </div>
                    <div className="form-group">
                        <label>Assign Judges (Max 3):</label>
                        <select multiple value={selectedJudgeIds} onChange={handleJudgeSelection} className="multi-select">
                            {judges.map(judge => (
                                <option key={judge.id} value={judge.id}>{judge.name} ({judge.email})</option>
                            ))}
                        </select>
                        <small>Hold Ctrl/Cmd to select multiple.</small>
                    </div>
                    {selectedJudgeIds.length > 0 && (
                        <div className="form-group judge-mark-distribution">
                            <label>Mark Distribution per Judge:</label>
                            {selectedJudgeIds.map(judgeId => {
                                const judge = judges.find(j => j.id === judgeId);
                                return (
                                    <div key={judgeId} className="judge-mark-input">
                                        <span>{judge?.name || 'Unknown Judge'}:</span>
                                        <input
                                            type="number"
                                            value={judgeMarkDistribution[judgeId] || 0}
                                            onChange={(e) => handleMarkDistributionChange(judgeId, e.target.value)}
                                            min="0"
                                            max={totalMarks}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="form-group checkbox-group">
                        <input
                            type="checkbox"
                            id="isPublic"
                            checked={isPublic}
                            onChange={(e) => setIsPublic(e.target.checked)}
                        />
                        <label htmlFor="isPublic">Make Publicly Viewable on Homepage</label>
                    </div>
                    <button type="submit" className="btn btn-primary">{editingEventId ? 'Update Event' : 'Add Event'}</button>
                    {editingEventId && <button type="button" className="btn btn-secondary" onClick={() => {
                        setEditingEventId(null);
                        setEventName('');
                        setEventDate('');
                        setEventTime('');
                        // Removed setEventLocation
                        setEventStageType('on-stage');
                        setEventStageNumber('');
                        setEventCategory(EVENT_CATEGORIES[0]);
                        setCompetitionType('single');
                        setTotalMarks(100);
                        setSelectedJudgeIds([]);
                        setJudgeMarkDistribution({});
                        setIsPublic(false); // Reset public visibility
                    }}>Cancel Edit</button>}
                </form>

                <div className="list-section">
                    <h4>Current Events</h4>
                    <div className="form-group search-box">
                        <label htmlFor="eventSearch">Search Events:</label>
                        <input
                            type="text"
                            id="eventSearch"
                            placeholder="Search by name, category, or stage"
                            value={eventSearchTerm}
                            onChange={(e) => setEventSearchTerm(e.target.value)}
                        />
                    </div>
                    {Object.keys(eventsByCategory).length === 0 ? (
                        <p>No events added yet or matching your search.</p>
                    ) : (
                        Object.entries(eventsByCategory).map(([category, eventsInCat]) => (
                            <div key={category} className="event-category-group">
                                <h5>Category: {category}</h5>
                                <div className="event-list-cards">
                                    {eventsInCat.map(event => (
                                        <div key={event.id} className="list-card event-list-card">
                                            <p><strong>{event.name}</strong> ({event.category})</p>
                                            <p>Date: {event.date}, Time: {event.time}</p>
                                            {/* Removed Location display */}
                                            <p>Stage Type: {event.stageType || 'N/A'}, Stage: {event.stage || 'N/A'}, Type: {event.competitionType || 'N/A'}, Total Marks: {event.totalMarks}</p>
                                            <p>Judges: {event.judges.map(j => j.name).join(', ')}</p>
                                            <p>Mark Dist: {Object.entries(event.markDistribution || {}).map(([jId, marks]) => `${judges.find(j => j.id === jId)?.name || jId}: ${marks}`).join(', ')}</p>
                                            <p>Status: <span className={`event-status ${event.status}`}>{event.status}</span></p>
                                            <p>Public: <span className={`event-status ${event.isPublic ? 'live' : 'over'}`}>{event.isPublic ? 'Yes' : 'No'}</span></p>
                                            <div className="card-actions">
                                                {/* New: Set Scheduled button */}
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => handleSetEventToScheduled(event.id)}
                                                    disabled={event.status === 'scheduled'}
                                                >
                                                    Set Scheduled
                                                </button>
                                                {/* Removed Set Live/Set Over buttons - now handled by Stage Admin */}
                                                <button
                                                    className={`btn ${event.isPublic ? 'btn-danger' : 'btn-info'}`}
                                                    onClick={() => handleTogglePublic(event.id, event.isPublic)}
                                                >
                                                    {event.isPublic ? 'Hide from Public' : 'Make Public'}
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => handleEditEvent(event)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="btn btn-danger"
                                                    onClick={() => handleDeleteEvent(event.id)}
                                                >
                                                    Delete
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => handleViewJudgeScores(event)}
                                                >
                                                    View Judge Scores
                                                </button>
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={() => handleProcessEventRanks(event)}
                                                    disabled={event.status !== 'live' && event.status !== 'over'}
                                                >
                                                    Process Event Ranks
                                                </button>
                                                <button
                                                    className="btn btn-info btn-small"
                                                    onClick={() => handleDownloadPoster(event.posterBase64, event.name)}
                                                    disabled={!event.posterBase64}
                                                >
                                                    Download Poster
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <Modal
                    isOpen={isViewScoresModalOpen}
                    onClose={() => setIsViewScoresModalOpen(false)}
                    title={`Judge Scores for ${selectedEventForScores?.name || ''}`}
                >
                    {scoresForEvent.length === 0 ? (
                        <p>No judge scores submitted for this event yet.</p>
                    ) : (
                        <table className="modal-table">
                            <thead>
                                <tr>
                                    <th>Participant</th>
                                    <th>Judge</th>
                                    <th>Marks</th>
                                    <th>Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scoresForEvent.map(score => (
                                    <tr key={score.id}>
                                        <td>{score.participantName}</td>
                                        <td>{score.judgeName}</td>
                                        <td>{score.marks}</td>
                                        <td>{new Date(score.timestamp).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Modal>
            </div>
        );
    };

    const ManageJudges = () => {
        const [judgeName, setJudgeName] = useState('');
        const [judgeEmail, setJudgeEmail] = useState('');
        const [judgePassword, setJudgePassword] = useState('');
        const [editingJudgeId, setEditingJudgeId] = useState(null);

        const handleAddJudge = async (e) => {
            e.preventDefault();
            setMessage('');
            try {
                if (editingJudgeId) {
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/judges`, editingJudgeId), {
                        name: judgeName,
                        email: judgeEmail,
                    });
                    setMessage(`Judge ${judgeName} updated successfully.`);
                    setEditingJudgeId(null);
                } else {
                    // Corrected: Call createUserWithEmailAndPassword as a method of 'auth'
                    const userCredential = await createUserWithEmailAndPassword(auth, judgeEmail, judgePassword);
                    const judgeId = userCredential.user.uid;

                    await setDoc(doc(db, `artifacts/${appId}/public/data/judges`, judgeId), {
                        name: judgeName,
                        email: judgeEmail,
                    });
                    setMessage(`Judge ${judgeName} added successfully with email: ${judgeEmail}. Password is NOT stored.`);
                }
                setJudgeName('');
                setJudgeEmail('');
                setJudgePassword('');
            } catch (error) {
                console.error("Error adding/updating judge:", error);
                setMessage("Failed to add/update judge: " + error.message);
            }
        };

        const handleEditJudge = (judge) => {
            setEditingJudgeId(judge.id);
            setJudgeName(judge.name);
            setJudgeEmail(judge.email);
            setJudgePassword('');
        };

        const handleDeleteJudge = async (judgeId, judgeEmailToDelete) => {
            if (!window.confirm(`Are you sure you want to delete judge ${judgeEmailToDelete}? This will remove them from the system.`)) {
                return;
            }
            setMessage('');
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/judges`, judgeId));
                setMessage(`Judge ${judgeEmailToDelete} deleted from database. Remember to manually delete their user from Firebase Authentication if needed.`);
            } catch (error) {
                console.error("Error deleting judge:", error);
                setMessage("Failed to delete judge: " + error.message);
            }
        };

        return (
            <div className="admin-section">
                <h3>Manage Judges</h3>
                <form onSubmit={handleAddJudge} className="form-card">
                    <h4>{editingJudgeId ? 'Edit Judge' : 'Add New Judge'}</h4>
                    <div className="form-group">
                        <label>Judge Name:</label>
                        <input type="text" value={judgeName} onChange={(e) => setJudgeName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Judge Email (Unique ID, e.g., judge1@judge.com):</label>
                        <input type="email" value={judgeEmail} onChange={(e) => setJudgeEmail(e.target.value)} required />
                    </div>
                    {!editingJudgeId && (
                        <div className="form-group">
                            <label>Temporary Password:</label>
                            <input type="password" value={judgePassword} onChange={(e) => setJudgePassword(e.target.value)} required minLength="6" />
                            <small>Password must be at least 6 characters.</small>
                        </div>
                    )}
                    <button type="submit" className="btn btn-primary">{editingJudgeId ? 'Update Judge' : 'Add Judge'}</button>
                    {editingJudgeId && <button type="button" className="btn btn-secondary" onClick={() => {
                        setEditingJudgeId(null);
                        setJudgeName('');
                        setJudgeEmail('');
                        setJudgePassword('');
                    }}>Cancel Edit</button>}
                </form>

                <div className="list-section">
                    <h4>Current Judges</h4>
                    {judges.length === 0 ? <p>No judges added yet.</p> : (
                        <div className="list-cards">
                            {judges.map(judge => (
                                <div key={judge.id} className="list-card">
                                    <p><strong>{judge.name}</strong></p>
                                    <p>Email: {judge.email}</p>
                                    <div className="card-actions">
                                        <button
                                            className="btn btn-secondary btn-small"
                                            onClick={() => handleEditJudge(judge)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn btn-danger btn-small"
                                            onClick={() => handleDeleteJudge(judge.id, judge.email)}
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
        );
    };

    const ManageParticipants = () => {
        const [participantName, setParticipantName] = useState('');
        const [participantClass, setParticipantClass] = useState('');
        const [participantAge, setParticipantAge] = useState('');
        const [participantSector, setParticipantSector] = useState('');
        const [participantUnit, setParticipantUnit] = useState('');
        const [participantCategory, setParticipantCategory] = useState(EVENT_CATEGORIES[0]);
        const [selectedEvents, setSelectedEvents] = useState([]);
        const [editingParticipantId, setEditingParticipantId] = useState(null);
        const [participantSearchTerm, setParticipantSearchTerm] = useState(''); // New state for participant search

        const filteredEventsForParticipant = events.filter(event => event.category === participantCategory);

        const handleAddParticipant = async (e) => {
            e.preventDefault();
            setMessage('');
            try {
                // Participants added by Admin will initially have empty codes
                const eventsForParticipant = selectedEvents.map(eventId => ({
                    eventId: eventId,
                    code: '' // Code is initially empty, to be filled by Stage Admin
                }));

                const participantData = {
                    name: participantName,
                    class: participantClass,
                    age: parseInt(participantAge),
                    sector: participantSector,
                    unit: participantUnit,
                    category: participantCategory,
                    events: eventsForParticipant,
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
                setParticipantSector('');
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
            setParticipantSector(participant.sector);
            setParticipantUnit(participant.unit);
            setParticipantCategory(participant.category);
            if (participant.events) {
                const eventIds = [];
                participant.events.forEach(eventEntry => {
                    if (typeof eventEntry === 'object' && eventEntry !== null && eventEntry.eventId) {
                        eventIds.push(eventEntry.eventId);
                    } else if (typeof eventEntry === 'string') {
                        eventIds.push(eventEntry);
                    }
                });
                setSelectedEvents(eventIds);
            } else {
                setSelectedEvents([]);
            }
        };

        const handleDeleteParticipantEvent = async (participantId, eventIdToDelete, participantName, eventName) => {
            if (!window.confirm(`Are you sure you want to remove ${eventName} from ${participantName}?`)) {
                return;
            }
            setMessage('');
            try {
                const participantRef = doc(db, `artifacts/${appId}/public/data/participants`, participantId);
                const participantSnap = await getDoc(participantRef);

                if (!participantSnap.exists()) {
                    setMessage("Participant not found.");
                    return;
                }

                const currentEvents = participantSnap.data().events || [];
                const updatedEvents = currentEvents.filter(eventEntry => eventEntry.eventId !== eventIdToDelete);

                if (updatedEvents.length === 0) {
                    // If no events left, delete the entire participant
                    await deleteDoc(participantRef);
                    setMessage(`Participant ${participantName} deleted as they have no more events.`);
                } else {
                    // Otherwise, just update the events array
                    await updateDoc(participantRef, { events: updatedEvents });
                    setMessage(`Event '${eventName}' removed from ${participantName}.`);
                }
            } catch (error) {
                console.error("Error deleting participant event:", error);
                setMessage("Failed to delete event from participant: " + error.message);
            }
        };


        const handleFileUpload = async (event) => {
            setMessage('');
            const file = event.target.files[0];
            if (!file) {
                setMessage("No file selected.");
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // --- Start of edited part ---
                    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                        setMessage("Excel file has no sheets or could not be read.");
                        return;
                    }
                    // --- End of edited part ---

                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);

                    if (!json || json.length === 0) {
                        setMessage("Excel file is empty or could not be parsed.");
                        return;
                    }

                    const batch = writeBatch(db);
                    const participantsCollectionRef = collection(db, `artifacts/${appId}/public/data/participants`);
                    let addedCount = 0;
                    let updatedCount = 0;
                    let errorCount = 0;

                    for (const row of json) {
                        // Basic validation and mapping for participant data
                        // Ensure all values are converted to string before trim(), and age is safely parsed
                        const name = String(row['Name'] || '').trim();
                        const participantClass = String(row['Class'] || '').trim();
                        const age = parseInt(row['Age']); // parseInt handles non-numeric safely, returns NaN
                        const sector = String(row['Sector'] || '').trim();
                        const unit = String(row['Unit'] || '').trim();
                        const category = String(row['Category'] || '').trim();
                        const eventNames = String(row['Events'] || '').split(',').map(e => e.trim()).filter(Boolean); // Comma-separated event names

                        if (!name || !participantClass || isNaN(age) || !sector || !unit || !category) {
                            console.warn("Skipping row due to missing or invalid required fields:", row);
                            errorCount++;
                            continue;
                        }

                        // Find event IDs based on names
                        const eventsForParticipant = eventNames.map(eventName => {
                            const foundEvent = events.find(e => e.name.toLowerCase() === eventName.toLowerCase() && e.category.toLowerCase() === category.toLowerCase());
                            return foundEvent ? { eventId: foundEvent.id, code: '' } : null;
                        }).filter(Boolean); // Filter out nulls if event not found

                        if (eventsForParticipant.length === 0 && eventNames.length > 0) {
                            console.warn(`No matching events found for participant ${name} in category ${category} with events ${eventNames.join(', ')}. Participant will be added without events.`);
                        }

                        const participantData = {
                            name,
                            class: participantClass,
                            age,
                            sector,
                            unit,
                            category,
                            events: eventsForParticipant,
                        };

                        // Check if participant already exists (e.g., by name and category, or a unique ID if available)
                        // For simplicity, let's assume `name` is unique enough for this upload context.
                        // In a real app, you might use a generated unique ID or a combination of fields.
                        const existingParticipantQuery = query(
                            participantsCollectionRef,
                            where('name', '==', name),
                            where('category', '==', category)
                        );
                        const existingParticipantSnapshot = await getDocs(existingParticipantQuery);

                        if (!existingParticipantSnapshot.empty) {
                            const existingDoc = existingParticipantSnapshot.docs[0];
                            // Merge existing events with new ones, avoiding duplicates
                            const currentEvents = existingDoc.data().events || [];
                            const newEvents = [...currentEvents];
                            eventsForParticipant.forEach(newEvent => {
                                if (!newEvents.some(e => e.eventId === newEvent.eventId)) {
                                    newEvents.push(newEvent);
                                }
                            });
                            batch.update(existingDoc.ref, { ...participantData, events: newEvents });
                            updatedCount++;
                        } else {
                            // Corrected: Use batch.set with a new document reference
                            batch.set(doc(participantsCollectionRef), participantData);
                            addedCount++;
                        }
                    }

                    await batch.commit();
                    setMessage(`Excel upload complete! Added: ${addedCount}, Updated: ${updatedCount}, Skipped/Errors: ${errorCount}.`);
                    // Refresh participant list after upload
                    // The onSnapshot listener will automatically update the state, so no manual fetch needed.
                } catch (error) {
                    console.error("Error processing Excel file:", error);
                    setMessage("Failed to process Excel file: " + error.message);
                }
            };
            reader.readAsArrayBuffer(file);
        };


        // Filter participants based on search term
        const filteredParticipants = participants.filter(p =>
            p.name.toLowerCase().includes(participantSearchTerm.toLowerCase()) ||
            p.sector.toLowerCase().includes(participantSearchTerm.toLowerCase()) ||
            p.unit.toLowerCase().includes(participantSearchTerm.toLowerCase()) ||
            p.class.toLowerCase().includes(participantSearchTerm.toLowerCase()) ||
            p.category.toLowerCase().includes(participantSearchTerm.toLowerCase())
        );


        const participantsByEventAndCategory = EVENT_CATEGORIES.reduce((catAcc, category) => {
            catAcc[category] = {};
            const eventsInThisCategory = events.filter(e => e.category === category);

            eventsInThisCategory.forEach(event => {
                const participantsForThisEvent = filteredParticipants.filter(p => // Use filteredParticipants here
                    p.category === category &&
                    p.events && p.events.some(e => e.eventId === event.id)
                );

                if (participantsForThisEvent.length > 0) {
                    catAcc[category][event.id] = participantsForThisEvent.map(p => {
                        const eventEntry = p.events.find(e => e.eventId === event.id);
                        return {
                            ...p,
                            assignedCode: eventEntry ? eventEntry.code : ''
                        };
                    }).sort((a, b) => a.assignedCode.localeCompare(b.assignedCode));
                }
            });
            return catAcc;
        }, {});

        return (
            <div className="admin-section">
                <h3>Manage Participants</h3>
                <form onSubmit={handleAddParticipant} className="form-card">
                    <h4>{editingParticipantId ? 'Edit Participant' : 'Add New Participant'}</h4>
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
                        <select value={participantSector} onChange={(e) => setParticipantSector(e.target.value)} required>
                            <option value="">-- Select Sector --</option>
                            {sectors.map(sector => (
                                <option key={sector.id} value={sector.name}>{sector.name}</option>
                            ))}
                        </select>
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
                        <select multiple value={selectedEvents} onChange={(e) => {
                            const selectedOpts = Array.from(e.target.selectedOptions).map(option => option.value);
                            setSelectedEvents(selectedOpts);
                        }} className="multi-select">
                            {filteredEventsForParticipant.length === 0 ? (
                                <option disabled>No events available for this category.</option>
                            ) : (
                                filteredEventsForParticipant.map(event => (
                                    <option key={event.id} value={event.id}>{event.name}</option>
                                ))
                            )}
                        </select>
                        <small>Hold Ctrl/Cmd to select multiple. Event codes will be assigned by Stage Admins.</small>
                    </div>
                    <button type="submit" className="btn btn-primary">{editingParticipantId ? 'Update Participant' : 'Add Participant'}</button>
                    {editingParticipantId && <button type="button" className="btn btn-secondary" onClick={() => {
                        setEditingParticipantId(null);
                        setParticipantName('');
                        setParticipantClass('');
                        setParticipantAge('');
                        setParticipantSector('');
                        setParticipantUnit('');
                        setParticipantCategory(EVENT_CATEGORIES[0]);
                        setSelectedEvents([]);
                    }}>Cancel Edit</button>}
                </form>

                <div className="form-card">
                    <h4>Upload Participants via Excel</h4>
                    <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                    <small>Upload an Excel file with columns: Name, Class, Age, Sector, Unit, Category, Events (comma-separated event names).</small>
                </div>

                <div className="list-section">
                    <h4>All Registered Participants (by Category and Event)</h4>
                    <div className="form-group search-box">
                        <label htmlFor="participantSearch">Search Participants:</label>
                        <input
                            type="text"
                            id="participantSearch"
                            placeholder="Search by name, sector, unit, class, or category"
                            value={participantSearchTerm}
                            onChange={(e) => setParticipantSearchTerm(e.target.value)}
                        />
                    </div>
                    {Object.keys(participantsByEventAndCategory).length === 0 ? (
                        <p>No participants registered yet or matching your search.</p>
                    ) : (
                        Object.entries(participantsByEventAndCategory).map(([category, eventsData]) => {
                            const eventsWithParticipants = Object.keys(eventsData).filter(eventId => eventsData[eventId].length > 0);

                            if (eventsWithParticipants.length === 0) return null;

                            return (
                                <div key={category} className="participant-category-group">
                                    <h5>Category: {category}</h5>
                                    {eventsWithParticipants.map(eventId => {
                                        const eventName = events.find(e => e.id === eventId)?.name || 'Unknown Event';
                                        const participantsInEvent = eventsData[eventId];
                                        return (
                                            <div key={eventId} className="event-participants-group">
                                                <h4>Event: {eventName}</h4>
                                                <table className="participant-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Name</th>
                                                            <th>Class</th>
                                                            <th>Age</th>
                                                            <th>Sector</th>
                                                            <th>Unit</th>
                                                            <th>Event Code</th>
                                                            <th>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {participantsInEvent.filter(Boolean).map(participant => (
                                                            <tr key={participant.id}>
                                                                <td>{participant.name}</td>
                                                                <td>{participant.class}</td>
                                                                <td>{participant.age}</td>
                                                                <td>{participant.sector}</td>
                                                                <td>{participant.unit}</td>
                                                                <td>
                                                                    <input
                                                                        type="text"
                                                                        value={
                                                                            participant.events?.find(e => e.eventId === eventId)?.code || 'N/A'
                                                                        }
                                                                        disabled
                                                                        style={{ width: '50px', textTransform: 'uppercase', textAlign: 'center' }}
                                                                    />
                                                                </td>
                                                                <td>
                                                                    <button
                                                                        className="btn btn-secondary btn-small"
                                                                        onClick={() => handleEditParticipant(participant)}
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-danger btn-small"
                                                                        onClick={() => handleDeleteParticipantEvent(participant.id, eventId, participant.name, eventName)}
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                <button
                                                    className="btn btn-info btn-small mt-3" // Added margin-top for spacing
                                                    onClick={() => handleDownloadParticipantsExcel(eventId, eventName, participantsInEvent)}
                                                >
                                                    Download Excel for {eventName}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    const ManageResults = () => {
        const [selectedEventId, setSelectedEventId] = useState('');
        const [processedRankedParticipants, setProcessedRankedParticipants] = useState([]);
        const [posterBase64, setPosterBase64] = useState('');
        const [results, setResults] = useState([]);
        const [eventResultSearchTerm, setEventResultSearchTerm] = useState(''); // New state for event result search

        const [currentPlacements, setCurrentPlacements] = useState({
            1: null,
            2: null,
            3: null
        });

        useEffect(() => {
            if (!db) return;
            const unsubscribe = onSnapshot(collection(db, `artifacts/${appId}/public/data/results`), (snapshot) => {
                setResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }, (error) => console.error("Error fetching results:", error));
            return () => unsubscribe();
        }, [db, appId]);

        useEffect(() => {
            const fetchRankedParticipants = async () => {
                if (!db || !selectedEventId) {
                    setProcessedRankedParticipants([]);
                    setCurrentPlacements({ 1: null, 2: null, 3: null });
                    setPosterBase64('');
                    return;
                }
                try {
                    const q = query(
                        collection(db, `artifacts/${appId}/public/data/event_rank_points`),
                        where('eventId', '==', selectedEventId)
                    );
                    const snapshot = await getDocs(q);
                    const fetchedParticipants = snapshot.docs.map(doc => doc.data());
                    setProcessedRankedParticipants(fetchedParticipants);

                    const newPlacements = { 1: null, 2: null, 3: null };
                    fetchedParticipants.forEach(p => {
                        if (p.rank >= 1 && p.rank <= 3) {
                            newPlacements[p.rank] = {
                                rank: p.rank,
                                participantId: p.participantId,
                                participantName: p.participantName,
                                pointsAwarded: p.pointsAwarded,
                                totalJudgeScore: p.participantEventTotalScore
                            };
                        }
                    });
                    setCurrentPlacements(newPlacements);

                    const existingResult = results.find(r => r.eventId === selectedEventId);
                    if (existingResult && existingResult.posterBase64) {
                        setPosterBase64(existingResult.posterBase64);
                    } else {
                        setPosterBase64('');
                    }

                } catch (error) {
                    console.error("Error fetching ranked participants for results:", error);
                    setMessage("Failed to load ranked participants for this event.");
                }
            };
            fetchRankedParticipants();
        }, [db, appId, selectedEventId, results]);


        const handlePosterUpload = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPosterBase64(reader.result);
                };
                reader.readAsDataURL(file);
            }
        };

        const handleAddResult = async (e) => {
            e.preventDefault();
            setMessage('');
            try {
                const event = events.find(e => e.id === selectedEventId);

                if (!event) {
                    setMessage("Please select a valid event.");
                    return;
                }
                if (processedRankedParticipants.length === 0) {
                    setMessage("No processed ranks available for this event. Please process ranks first.");
                    return;
                }

                const placementsToSave = [];
                for (let i = 1; i <= 3; i++) {
                    if (currentPlacements[i]) {
                        placementsToSave.push({
                            rank: i,
                            participantId: currentPlacements[i].participantId,
                            participantName: currentPlacements[i].participantName,
                            pointsAwarded: currentPlacements[i].pointsAwarded,
                            totalJudgeScore: currentPlacements[i].totalJudgeScore
                        });
                    }
                }

                const finalCompetitionType = event.competitionType || 'single';

                const existingResultQuery = query(
                    collection(db, `artifacts/${appId}/public/data/results`),
                    where('eventId', '==', selectedEventId)
                );
                const existingResultSnapshot = await getDocs(existingResultQuery);

                const resultData = {
                    eventId: selectedEventId,
                    eventName: event.name,
                    categoryName: event.category,
                    competitionType: finalCompetitionType,
                    placements: placementsToSave,
                    posterBase64: posterBase64,
                    timestamp: new Date().toISOString()
                };

                if (existingResultSnapshot.empty) {
                    await addDoc(collection(db, `artifacts/${appId}/public/data/results`), resultData);
                    setMessage("Result added successfully!");
                } else {
                    const resultDocToUpdate = existingResultSnapshot.docs[0];
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/results`, resultDocToUpdate.id), resultData);
                    setMessage("Result updated successfully!");
                }

                setSelectedEventId('');
                setProcessedRankedParticipants([]);
                setCurrentPlacements({ 1: null, 2: null, 3: null });
                setPosterBase64('');
            } catch (error) {
                console.error("Error adding/updating result:", error);
                setMessage("Failed to add/update result: " + error.message);
            }
        };

        const handleDeleteResult = async (resultId) => {
            if (!window.confirm("Are you sure you want to delete this result?")) {
                return;
            }
            setMessage('');
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/results`, resultId));
                setMessage("Result deleted successfully!");
            } catch (error) {
                    console.error("Error deleting result:", error);
                setMessage("Failed to delete result: " + error.message);
            }
        };

        // Filter events for the dropdown based on search term
        const filteredEventsForDropdown = events.filter(event =>
            event.name.toLowerCase().includes(eventResultSearchTerm.toLowerCase()) ||
            event.category.toLowerCase().includes(eventResultSearchTerm.toLowerCase())
        );

        return (
            <div className="admin-section">
                <h3>Manage Results</h3>
                <form onSubmit={handleAddResult} className="form-card">
                    <h4>Finalize Event Result</h4>
                    <div className="form-group">
                        <label>Search and Select Event:</label>
                        <input
                            type="text"
                            placeholder="Search event by name or category"
                            value={eventResultSearchTerm}
                            onChange={(e) => setEventResultSearchTerm(e.target.value)}
                            className="search-input-for-dropdown"
                        />
                        <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} required>
                            <option value="">-- Select an Event --</option>
                            {filteredEventsForDropdown.map(event => (
                                <option key={event.id} value={event.id}>{event.name} ({event.category})</option>
                            ))}
                        </select>
                    </div>

                    {selectedEventId && (
                        <div className="form-group">
                            <label>Processed Ranks for this Event:</label>
                            {processedRankedParticipants.length > 0 ? (
                                <div className="processed-ranks-display">
                                    {[1, 2, 3].map(rank => (
                                        <div key={rank} className="rank-display-item">
                                            <strong>{rank} Place:</strong> {' '}
                                            {currentPlacements[rank] ? (
                                                `${currentPlacements[rank].participantName} (${currentPlacements[rank].pointsAwarded} points, Total Score: ${currentPlacements[rank].totalJudgeScore})`
                                            ) : (
                                                <span style={{ color: '#888' }}>Not Awarded</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="warn-message">No processed ranks found for this event. Please go to "Manage Events" and click "Process Event Ranks" for the selected event.</p>
                            )}
                            <small>These ranks are based on "Process Event Ranks".</small>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Poster (Optional, for the event result):</label>
                        <input type="file" accept="image/*" onChange={handlePosterUpload} />
                        {posterBase64 && <img src={posterBase64} alt="Poster preview" style={{ maxWidth: '100px', maxHeight: '100px', marginTop: '10px' }} />}
                        <small>Upload a small image for the event result poster. Large images will slow down the app.</small>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={!selectedEventId || processedRankedParticipants.length === 0}>
                        {results.some(r => r.eventId === selectedEventId) ? 'Update Result' : 'Add Result'}
                    </button>
                </form>

                <div className="list-section">
                    <h4>Finalized Results</h4>
                    {results.length === 0 ? <p>No results added yet.</p> : (
                        <div className="list-cards">
                            {results.map(result => (
                                <div key={result.id} className="list-card result-list-card">
                                    <p><strong>{result.eventName} ({result.categoryName})</strong></p>
                                    <p>Type: {result.competitionType || 'N/A'}</p>
                                    {result.placements && result.placements.map(p => (
                                        <p key={p.rank}>
                                            <strong>{p.rank} Place:</strong> {p.participantName} ({p.pointsAwarded} pts)
                                        </p>
                                    ))}
                                    {result.posterBase64 && (
                                        <img src={result.posterBase64} alt="Result Poster" style={{ maxWidth: '80px', maxHeight: '80px', marginTop: '10px' }} />
                                    )}
                                    <button
                                        className="btn btn-danger btn-small"
                                        onClick={() => handleDeleteResult(result.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const ManageLeaderboard = () => {
        // The point scheme selection is removed as requested.
        // The recalculate button remains.

        const handleRecalculateLeaderboard = async () => {
            setMessage('Recalculating leaderboard...');
            try {
                const eventRankPointsRef = collection(db, `artifacts/${appId}/public/data/event_rank_points`);
                const sectorsRef = collection(db, `artifacts/${appId}/public/data/sectors`);

                const [rankPointsSnapshot, sectorsSnapshot] = await Promise.all([
                    getDocs(eventRankPointsRef),
                    getDocs(sectorsRef)
                ]);

                const rankPointsData = rankPointsSnapshot.docs.map(doc => doc.data());
                const sectorsData = sectorsSnapshot.docs.map(doc => doc.data().name);

                const sectorCategoryScores = {};

                sectorsData.forEach(sector => {
                    sectorCategoryScores[sector] = { total: 0 };
                    EVENT_CATEGORIES.forEach(category => {
                        sectorCategoryScores[sector][category] = 0;
                    });
                });

                rankPointsData.forEach(rankPoint => {
                    const sector = rankPoint.participantSector;
                    const category = rankPoint.participantCategory;

                    if (sector && category && sectorCategoryScores[sector]) {
                        sectorCategoryScores[sector][category] = (sectorCategoryScores[sector][category] || 0) + rankPoint.pointsAwarded;
                        sectorCategoryScores[sector].total += rankPoint.pointsAwarded;
                    } else {
                        console.warn(`Skipping rank points for participant ${rankPoint.participantName} (ID: ${rankPoint.participantId}) due to missing sector/category or uninitialized sector. Sector: ${sector}, Category: ${category}`);
                    }
                });

                const sortedLeaderboard = Object.entries(sectorCategoryScores)
                    .map(([sector, data]) => ({ sector, totalScore: data.total }))
                    .sort((a, b) => b.totalScore - a.totalScore);

                const leaderboardDocRef = doc(db, `artifacts/${appId}/public/data/leaderboard_summary`, 'current_leaderboard');
                await setDoc(leaderboardDocRef, {
                    sortedLeaderboard,
                    sectorCategoryScores,
                    lastUpdated: new Date().toISOString()
                });

                setMessage("Leaderboard successfully recalculated!");
            } catch (error) {
                console.error("Error recalculating leaderboard:", error);
                setMessage("Failed to recalculate leaderboard: " + error.message);
            }
        };

        return (
            <div className="admin-section">
                <h3>Manage Leaderboard</h3>
                <div className="form-card" style={{ textAlign: 'center', marginTop: '20px' }}>
                    <h4>Recalculate Sector Leaderboard</h4>
                    <p>Click the button below to recalculate the overall sector leaderboard based on current event rank points.</p>
                    <button onClick={handleRecalculateLeaderboard} className="btn btn-primary">Recalculate Leaderboard</button>
                </div>
            </div>
        );
    };

    const ManageStageAdmins = () => { // New component for managing stage admins
        const [stageName, setStageName] = useState(''); // Changed from stageAdminName
        const [stageAdminPassword, setStageAdminPassword] = useState('');
        const [editingStageAdminId, setEditingStageAdminId] = useState(null);

        const handleAddStageAdmin = async (e) => {
            e.preventDefault();
            setMessage('');
            if (!stageName.trim() || !stageAdminPassword.trim()) {
                setMessage("Stage Name and Password are required.");
                return;
            }
            if (stageAdminPassword.length < 6) {
                setMessage("Password must be at least 6 characters.");
                return;
            }

            // Derive stageAdminEmail from stageName (e.g., "Stage 1" -> "stage1@stage.com")
            const derivedStageAdminEmail = `${stageName.toLowerCase().replace(/\s/g, '')}@stage.com`;

            try {
                if (editingStageAdminId) {
                    // For editing, we only allow updating the name. Email and password are not changed here.
                    // The assignedStage is derived from the email, which is not editable here.
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/stage_admins`, editingStageAdminId), {
                        name: stageName, // Update name
                        // email and assignedStage remain as they are derived from the email
                    });
                    setMessage(`Stage Admin for "${stageName}" updated successfully.`);
                    setEditingStageAdminId(null);
                } else {
                    const userCredential = await createUserWithEmailAndPassword(auth, derivedStageAdminEmail, stageAdminPassword);
                    const stageAdminUid = userCredential.user.uid;

                    await setDoc(doc(db, `artifacts/${appId}/public/data/stage_admins`, stageAdminUid), {
                        name: stageName, // Store the user-friendly stage name
                        email: derivedStageAdminEmail, // Store the derived email
                        assignedStage: stageName, // Store the stage name as assignedStage
                        createdAt: new Date().toISOString()
                    });
                    setMessage(`Stage Admin for "${stageName}" created successfully! Login Email: ${derivedStageAdminEmail}. Password is NOT stored.`);
                }
                setStageName('');
                setStageAdminPassword('');
            } catch (error) {
                console.error("Error adding/updating stage admin:", error);
                let errorMessage = "Failed to add/update stage admin: " + error.message;
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = `Failed to add stage admin: An account with email ${derivedStageAdminEmail} already exists.`;
                }
                setMessage(errorMessage);
            }
        };

        const handleEditStageAdmin = (stageAdmin) => {
            setEditingStageAdminId(stageAdmin.id);
            setStageName(stageAdmin.name); // Set the stage name for editing
            setStageAdminPassword(''); // Password is not editable
        };

        const handleDeleteStageAdmin = async (stageAdminId, stageAdminEmailToDelete) => {
            if (!window.confirm(`Are you sure you want to delete stage admin ${stageAdminEmailToDelete}? This will remove them from the system.`)) {
                return;
            }
            setMessage('');
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/stage_admins`, stageAdminId));
                setMessage(`Stage Admin ${stageAdminEmailToDelete} deleted from database. Remember to manually delete their user from Firebase Authentication if needed.`);
            } catch (error) {
                console.error("Error deleting stage admin:", error);
                setMessage("Failed to delete stage admin: " + error.message);
            }
        };

        return (
            <div className="admin-section">
                <h3>Manage Stage Admins</h3>
                <form onSubmit={handleAddStageAdmin} className="form-card">
                    <h4>{editingStageAdminId ? 'Edit Stage Admin' : 'Add New Stage Admin'}</h4>
                    <div className="form-group">
                        <label>Stage Name (e.g., Stage 1, Stage 2):</label>
                        <input type="text" value={stageName} onChange={(e) => setStageName(e.target.value)} required />
                        <small>This will be used to create the login email (e.g., 'Stage 1' will be 'stage1@stage.com').</small>
                    </div>
                    {!editingStageAdminId && (
                        <div className="form-group">
                            <label>Temporary Password:</label>
                            <input type="password" value={stageAdminPassword} onChange={(e) => setStageAdminPassword(e.target.value)} required minLength="6" />
                            <small>Password must be at least 6 characters.</small>
                        </div>
                    )}
                    <button type="submit" className="btn btn-primary">{editingStageAdminId ? 'Update Stage Admin' : 'Add Stage Admin'}</button>
                    {editingStageAdminId && <button type="button" className="btn btn-secondary" onClick={() => {
                        setEditingStageAdminId(null);
                        setStageName('');
                        setStageAdminPassword('');
                    }}>Cancel Edit</button>}
                </form>

                <div className="list-section">
                    <h4>Current Stage Admins</h4>
                    {stageAdmins.length === 0 ? <p>No stage admins added yet.</p> : (
                        <div className="list-cards">
                            {stageAdmins.map(admin => (
                                <div key={admin.id} className="list-card">
                                    <p><strong>Stage Name: {admin.name}</strong></p>
                                    <p>Login Email: {admin.email}</p>
                                    <div className="card-actions">
                                        <button
                                            className="btn btn-secondary btn-small"
                                            onClick={() => handleEditStageAdmin(admin)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn btn-danger btn-small"
                                            onClick={() => handleDeleteStageAdmin(admin.id, admin.email)}
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
        );
    };

    // The ManageSectors component is now removed as per user's request.
    // const ManageSectors = () => { /* ... existing code ... */ };


    return (
        <div className="page-container admin-dashboard">
            <h1>Admin Dashboard</h1>
            <p>Welcome, {currentUser?.email}!</p>
            <MessageBox message={message} type={message.includes("Failed") || message.includes("Error") ? 'error' : 'success'} onClose={() => setMessage('')} />

            <div className="admin-tabs">
                <button className={`tab-button ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>Manage Events</button>
                <button className={`tab-button ${activeTab === 'judges' ? 'active' : ''}`} onClick={() => setActiveTab('judges')}>Manage Judges</button>
                <button className={`tab-button ${activeTab === 'participants' ? 'active' : ''}`} onClick={() => setActiveTab('participants')}>Manage Participants</button>
                <button className={`tab-button ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>Manage Results</button>
                <button className={`tab-button ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>Manage Leaderboard</button>
                <button className={`tab-button ${activeTab === 'stageAdmins' ? 'active' : ''}`} onClick={() => setActiveTab('stageAdmins')}>Manage Stage Admins</button> {/* New tab */}
            </div>

            <div className="admin-content">
                {activeTab === 'events' && <ManageEvents />}
                {activeTab === 'judges' && <ManageJudges />}
                {activeTab === 'participants' && <ManageParticipants />}
                {activeTab === 'results' && <ManageResults />}
                {activeTab === 'leaderboard' && <ManageLeaderboard />}
                {activeTab === 'stageAdmins' && <ManageStageAdmins />} {/* Render new component */}
            </div>
        </div>
    );
};

export default AdminDashboard;
