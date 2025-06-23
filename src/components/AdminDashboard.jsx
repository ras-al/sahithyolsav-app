// Path: src/components/AdminDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx'; // Correct path to AuthContext
import { MessageBox, Modal } from './UtilityComponents.jsx'; // Import utility components
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, setDoc } from 'firebase/firestore';

// Predefined event categories
const EVENT_CATEGORIES = ["Kids", "LP", "UP", "HS", "HSS", "Junior", "Campus"];

// Define point schemes for leaderboard based on rank
const RANK_POINT_SCHEMES = {
    group: {
        name: "Group Competition (10/8/5)",
        points: { 1: 10, 2: 8, 3: 5 }
    },
    single: {
        name: "Single Competition (5/3/1)",
        points: { 1: 5, 2: 3, 3: 1 }
    }
};

const AdminDashboard = () => {
    const { currentUser, db, auth, appId } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('events'); // Default active tab
    const [message, setMessage] = useState('');
    const [judges, setJudges] = useState([]);
    const [events, setEvents] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [sectors, setSectors] = useState([]);

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

        return () => {
            unsubscribeJudges();
            unsubscribeEvents();
            unsubscribeParticipants();
            unsubscribeSectors();
        };
    }, [db, appId]);

    // --- Admin-specific Sub-Components ---

    const ManageEvents = () => {
        const [eventName, setEventName] = useState('');
        const [eventDate, setEventDate] = useState('');
        const [eventTime, setEventTime] = useState('');
        const [eventLocation, setEventLocation] = useState('');
        const [eventStage, setEventStage] = useState('on-stage');
        const [eventCategory, setEventCategory] = useState(EVENT_CATEGORIES[0]);
        const [competitionType, setCompetitionType] = useState('single');
        const [totalMarks, setTotalMarks] = useState(100);
        const [selectedJudgeIds, setSelectedJudgeIds] = useState([]);
        const [judgeMarkDistribution, setJudgeMarkDistribution] = useState({});
        const [isViewScoresModalOpen, setIsViewScoresModalOpen] = useState(false);
        const [scoresForEvent, setScoresForEvent] = useState([]);
        const [selectedEventForScores, setSelectedEventForScores] = useState(null);
        const [editingEventId, setEditingEventId] = useState(null);

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

            try {
                const eventData = {
                    name: eventName,
                    date: eventDate,
                    time: eventTime,
                    location: eventLocation,
                    stage: eventStage,
                    category: eventCategory,
                    competitionType: competitionType,
                    totalMarks: parseInt(totalMarks),
                    judges: judgesWithNames,
                    markDistribution: judgeMarkDistribution,
                    status: 'scheduled'
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
                setEventLocation('');
                setEventCategory(EVENT_CATEGORIES[0]);
                setCompetitionType('single');
                setTotalMarks(100);
                setSelectedJudgeIds([]);
                setJudgeMarkDistribution({});
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
            setEventLocation(event.location || '');
            setEventStage(event.stage);
            setEventCategory(event.category);
            setCompetitionType(event.competitionType || 'single');
            setTotalMarks(event.totalMarks);
            setSelectedJudgeIds(event.judges?.map(j => j.id) || []);
            setJudgeMarkDistribution(event.markDistribution || {});
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

        const handleSetLiveStatus = async (eventId, currentStatus) => {
            setMessage('');
            try {
                const eventDocRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
                const newStatus = currentStatus === 'live' ? 'scheduled' : 'live';
                await updateDoc(eventDocRef, { status: newStatus });
                setMessage(`Event status updated to "${newStatus}"!`);
            } catch (error) {
                console.error("Error updating event status:", error);
                setMessage("Failed to update event status: " + error.message);
            }
        };

        const handleMarkOver = async (eventId) => {
            setMessage('');
            try {
                const eventDocRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
                await updateDoc(eventDocRef, { status: 'over' });
                setMessage("Event marked as 'over'!");
            } catch (error) {
                console.error("Error marking event over:", error);
                setMessage("Failed to mark event over: " + error.message);
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

                const eventScoresQuery = query(
                    collection(db, `artifacts/${appId}/public/data/scores`),
                    where('eventId', '==', event.id)
                );
                const scoresSnapshot = await getDocs(eventScoresQuery);
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

        const eventsByCategory = events.reduce((acc, event) => {
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
                     <div className="form-group">
                        <label>Location (e.g., Room 3, Main Hall):</label>
                        <input type="text" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Stage:</label>
                        <select value={eventStage} onChange={(e) => setEventStage(e.target.value)}>
                            <option value="on-stage">On Stage</option>
                            <option value="off-stage">Off Stage</option>
                        </select>
                    </div>
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
                    <button type="submit" className="btn btn-primary">{editingEventId ? 'Update Event' : 'Add Event'}</button>
                    {editingEventId && <button type="button" className="btn btn-secondary" onClick={() => {
                        setEditingEventId(null);
                        setEventName('');
                        setEventDate('');
                        setEventTime('');
                        setEventLocation('');
                        setEventCategory(EVENT_CATEGORIES[0]);
                        setCompetitionType('single');
                        setTotalMarks(100);
                        setSelectedJudgeIds([]);
                        setJudgeMarkDistribution({});
                    }}>Cancel Edit</button>}
                </form>

                <div className="list-section">
                    <h4>Current Events</h4>
                    {Object.keys(eventsByCategory).length === 0 ? (
                        <p>No events added yet.</p>
                    ) : (
                        Object.entries(eventsByCategory).map(([category, eventsInCat]) => (
                            <div key={category} className="event-category-group">
                                <h5>Category: {category}</h5>
                                <div className="event-list-cards">
                                    {eventsInCat.map(event => (
                                        <div key={event.id} className="list-card event-list-card">
                                            <p><strong>{event.name}</strong> ({event.category})</p>
                                            <p>Date: {event.date}, Time: {event.time}</p>
                                            <p>Location: {event.location || 'N/A'}</p>
                                            <p>Stage: {event.stage}, Type: {event.competitionType || 'N/A'}, Total Marks: {event.totalMarks}</p>
                                            <p>Judges: {event.judges.map(j => j.name).join(', ')}</p>
                                            <p>Mark Dist: {Object.entries(event.markDistribution || {}).map(([jId, marks]) => `${judges.find(j => j.id === jId)?.name || jId}: ${marks}`).join(', ')}</p>
                                            <p>Status: <span className={`event-status ${event.status}`}>{event.status}</span></p>
                                            <div className="card-actions">
                                                <button
                                                    className={`btn ${event.status === 'live' ? 'btn-warn' : 'btn-success'}`}
                                                    onClick={() => handleSetLiveStatus(event.id, event.status)}
                                                >
                                                    {event.status === 'live' ? 'Mark Scheduled' : 'Go Live'}
                                                </button>
                                                <button
                                                    className="btn btn-info"
                                                    onClick={() => handleMarkOver(event.id)}
                                                    disabled={event.status === 'over'}
                                                >
                                                    Mark Over
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
                        <label>Judge Email (Unique ID, e.g., judge1@sahithyolsav.com):</label>
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
        const [participantEventCodes, setParticipantEventCodes] = useState({});
        const [editingParticipantId, setEditingParticipantId] = useState(null);

        const filteredEventsForParticipant = events.filter(event => event.category === participantCategory);

        useEffect(() => {
            if (editingParticipantId) {
                const participantToEdit = participants.find(p => p.id === editingParticipantId);
                if (participantToEdit && participantToEdit.events) {
                    const codesMap = {};
                    participantToEdit.events.forEach(e => {
                        if (typeof e === 'object' && e !== null && e.eventId && e.code) {
                            codesMap[e.eventId] = e.code;
                        } else if (typeof e === 'string') {
                             codesMap[e] = '';
                        }
                    });
                    setSelectedEvents(participantToEdit.events.map(e => (typeof e === 'object' ? e.eventId : e)));
                    setParticipantEventCodes(codesMap);
                }
            } else {
                setParticipantEventCodes({});
            }
        }, [editingParticipantId, participants]);


        const handleAddParticipant = async (e) => {
            e.preventDefault();
            setMessage('');
            try {
                const eventsWithCodes = selectedEvents.map(eventId => ({
                    eventId: eventId,
                    code: participantEventCodes[eventId] || ''
                }));

                const participantData = {
                    name: participantName,
                    class: participantClass,
                    age: parseInt(participantAge),
                    sector: participantSector,
                    unit: participantUnit,
                    category: participantCategory,
                    events: eventsWithCodes,
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
                setParticipantEventCodes({});
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
                const codesMap = {};
                participant.events.forEach(eventEntry => {
                    if (typeof eventEntry === 'object' && eventEntry !== null && eventEntry.eventId) {
                        eventIds.push(eventEntry.eventId);
                        codesMap[eventEntry.eventId] = eventEntry.code || '';
                    } else if (typeof eventEntry === 'string') {
                        eventIds.push(eventEntry);
                        codesMap[eventEntry] = '';
                    }
                });
                setSelectedEvents(eventIds);
                setParticipantEventCodes(codesMap);
            } else {
                setSelectedEvents([]);
                setParticipantEventCodes({});
            }
        };

        const handleEventCodeChangeLocal = (participantId, eventId, code) => {
            const formattedCode = code.toUpperCase().replace(/[^A-Z]/g, '');
            setParticipants(prevParticipants => prevParticipants.map(p => {
                if (p.id === participantId) {
                    const updatedEvents = p.events.map(e => {
                        if (typeof e === 'object' && e.eventId === eventId) {
                            return { ...e, code: formattedCode.slice(0, 1) };
                        }
                        return e;
                    });
                    return { ...p, events: updatedEvents };
                }
                return p;
            }));
        };

        const handleUpdateParticipantCode = async (participantId, eventId, newCode) => {
            setMessage('');
            try {
                const participantRef = doc(db, `artifacts/${appId}/public/data/participants`, participantId);
                const participantSnap = await getDoc(participantRef);

                if (participantSnap.exists()) {
                    const participantData = participantSnap.data();
                    const updatedEvents = participantData.events.map(eventEntry => {
                        if (typeof eventEntry === 'object' && eventEntry.eventId === eventId) {
                            return { ...eventEntry, code: newCode };
                        } else if (typeof eventEntry === 'string' && eventEntry === eventId) {
                            return { eventId: eventEntry, code: newCode };
                        }
                        return eventEntry;
                    });

                    await updateDoc(participantRef, { events: updatedEvents });
                    setMessage(`Participant code for ${participants.find(p => p.id === participantId)?.name} in event ${events.find(e => e.id === eventId)?.name} updated to ${newCode}.`);
                } else {
                    setMessage("Participant not found.");
                }
            } catch (error) {
                console.error("Error updating participant code:", error);
                setMessage("Failed to update participant code: " + error.message);
            }
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

        const participantsByEventAndCategory = EVENT_CATEGORIES.reduce((catAcc, category) => {
            catAcc[category] = {};
            const eventsInThisCategory = events.filter(e => e.category === category);

            eventsInThisCategory.forEach(event => {
                const participantsForThisEvent = participants.filter(p =>
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
                            setParticipantEventCodes({});
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
                            const newCodes = { ...participantEventCodes };
                            selectedOpts.forEach(id => {
                                if (!newCodes[id]) newCodes[id] = '';
                            });
                            Object.keys(newCodes).forEach(id => {
                                if (!selectedOpts.includes(id)) {
                                    delete newCodes[id];
                                }
                            });
                            setParticipantEventCodes(newCodes);
                        }} className="multi-select">
                            {filteredEventsForParticipant.length === 0 ? (
                                <option disabled>No events available for this category.</option>
                            ) : (
                                filteredEventsForParticipant.map(event => (
                                    <option key={event.id} value={event.id}>{event.name}</option>
                                ))
                            )}
                        </select>
                        <small>Hold Ctrl/Cmd to select multiple.</small>
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
                        setParticipantEventCodes({});
                    }}>Cancel Edit</button>}
                </form>

                <div className="list-section">
                    <h4>All Registered Participants (by Category and Event)</h4>
                    {Object.keys(participantsByEventAndCategory).length === 0 ? (
                        <p>No participants registered yet.</p>
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
                                                <h6>Event: {eventName}</h6>
                                                <div className="list-cards">
                                                    {participantsInEvent.map(participant => (
                                                        <div key={participant.id} className="list-card participant-list-card">
                                                            <p><strong>Name: {participant.name}</strong></p>
                                                            <p>Class: {participant.class}, Age: {participant.age}</p>
                                                            <p>Sector: {participant.sector}, Unit: {participant.unit}</p>
                                                            <div className="form-group participant-code-input">
                                                                <label htmlFor={`code-${participant.id}-${eventId}`}>Event Code:</label>
                                                                <input
                                                                    type="text"
                                                                    id={`code-${participant.id}-${eventId}`}
                                                                    maxLength="1"
                                                                    value={
                                                                        participant.events.find(e => e.eventId === eventId)?.code || ''
                                                                    }
                                                                    onChange={(e) => handleEventCodeChangeLocal(participant.id, eventId, e.target.value)}
                                                                    onBlur={(e) => handleUpdateParticipantCode(participant.id, eventId, e.target.value)}
                                                                    style={{ width: '50px', textTransform: 'uppercase', textAlign: 'center' }}
                                                                />
                                                                <button
                                                                    className="btn btn-primary btn-small"
                                                                    onClick={() => handleUpdateParticipantCode(
                                                                        participant.id,
                                                                        eventId,
                                                                        participant.events.find(e => e.eventId === eventId)?.code || ''
                                                                    )}
                                                                    style={{ marginLeft: '10px' }}
                                                                >
                                                                    Save Code
                                                                </button>
                                                            </div>

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
                                                                <button
                                                                    className="btn btn-info btn-small"
                                                                    onClick={() => handleDownloadParticipantsExcel(eventId, eventName, participantsInEvent)}
                                                                >
                                                                    Download Excel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
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

        return (
            <div className="admin-section">
                <h3>Manage Results</h3>
                <form onSubmit={handleAddResult} className="form-card">
                    <h4>Finalize Event Result</h4>
                    <div className="form-group">
                        <label>Select Event:</label>
                        <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} required>
                            <option value="">-- Select an Event --</option>
                            {events.map(event => (
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
        const [activePointSchemeId, setActivePointSchemeId] = useState('group');
        const [settingMessage, setSettingMessage] = useState('');

        useEffect(() => {
            if (!db) return;
            const pointsSchemeDocRef = doc(db, `artifacts/${appId}/public/data/settings`, 'leaderboard_point_scheme');
            const unsubscribe = onSnapshot(pointsSchemeDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    setActivePointSchemeId(docSnap.data().activeSchemeId);
                } else {
                    setDoc(pointsSchemeDocRef, { activeSchemeId: 'group' }, { merge: true });
                    setActivePointSchemeId('group');
                }
            }, (error) => {
                console.error("Error fetching point scheme:", error);
                setSettingMessage("Failed to load point scheme. Defaulting to Group Points.");
            });
            return () => unsubscribe();
        }, [db, appId]);

        const handlePointSchemeChange = async (schemeId) => {
            setSettingMessage('');
            try {
                const pointsSchemeDocRef = doc(db, `artifacts/${appId}/public/data/settings`, 'leaderboard_point_scheme');
                await setDoc(pointsSchemeDocRef, { activeSchemeId: schemeId }, { merge: true });
                setActivePointSchemeId(schemeId);
                setSettingMessage(`Leaderboard point scheme set to: ${RANK_POINT_SCHEMES[schemeId].name}`);
            } catch (error) {
                console.error("Error setting point scheme:", error);
                setSettingMessage("Failed to set point scheme: " + error.message);
            }
        };

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
                <div className="form-card" style={{ textAlign: 'center' }}>
                    <h4>Leaderboard Point System</h4>
                    <p>Select the point scheme to apply for 1st, 2nd, and 3rd place in events.</p>
                    <div className="form-group" style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
                        {Object.entries(RANK_POINT_SCHEMES).map(([key, scheme]) => (
                            <label key={key}>
                                <input
                                    type="radio"
                                    name="pointScheme"
                                    value={key}
                                    checked={activePointSchemeId === key}
                                    onChange={() => handlePointSchemeChange(key)}
                                />
                                {scheme.name}
                            </label>
                        ))}
                    </div>
                    <MessageBox message={settingMessage} type={settingMessage.includes("Failed") || settingMessage.includes("Error") ? 'error' : 'success'} onClose={() => setSettingMessage('')} />
                </div>
                <div className="form-card" style={{ textAlign: 'center', marginTop: '20px' }}>
                    <h4>Recalculate Sector Leaderboard</h4>
                    <p>Click the button below to recalculate the overall sector leaderboard based on current event rank points.</p>
                    <button onClick={handleRecalculateLeaderboard} className="btn btn-primary">Recalculate Leaderboard</button>
                </div>
            </div>
        );
    };

    const ManageSectors = () => {
        const [sectorName, setSectorName] = useState('');
        const [sectorPassword, setSectorPassword] = useState('');

        const handleAddSector = async (e) => {
            e.preventDefault();
            setMessage('');
            if (!sectorName.trim() || !sectorPassword.trim()) {
                setMessage("Sector name and password cannot be empty.");
                return;
            }
            if (sectorPassword.length < 6) {
                setMessage("Sector password must be at least 6 characters.");
                return;
            }

            try {
                const sectorEmail = `${sectorName.toLowerCase().replace(/\s/g, '')}@sector.com`;
                const userCredential = await createUserWithEmailAndPassword(auth, sectorEmail, sectorPassword);
                const sectorUid = userCredential.user.uid;

                await setDoc(doc(db, `artifacts/${appId}/public/data/sectors`, sectorUid), {
                    name: sectorName,
                    email: sectorEmail,
                    createdAt: new Date().toISOString()
                });
                setMessage(`Sector "${sectorName}" and official account created successfully! Email: ${sectorEmail}`);
                setSectorName('');
                setSectorPassword('');
            } catch (error) {
                console.error("Error adding sector:", error);
                let errorMessage = "Failed to add sector: " + error.message;
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = "Failed to add sector: An account with this email already exists.";
                }
                setMessage(errorMessage);
            }
        };

        const handleDeleteSector = async (sectorId, sectorNameToDelete, sectorEmailToDelete) => {
            if (!window.confirm(`Are you sure you want to delete sector "${sectorNameToDelete}"? This will remove all associated participants and official accounts.`)) {
                return;
            }
            setMessage('');
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/sectors`, sectorId));
                setMessage(`Sector "${sectorNameToDelete}" deleted from database. Remember to manually delete Firebase Auth user "${sectorEmailToDelete}" if needed.`);
            } catch (error) {
                console.error("Error deleting sector:", error);
                setMessage("Failed to delete sector: " + error.message);
            }
        };

        return (
            <div className="admin-section">
                <h3>Manage Sectors</h3>
                <form onSubmit={handleAddSector} className="form-card">
                    <h4>Add New Sector</h4>
                    <div className="form-group">
                        <label>Sector Name:</label>
                        <input type="text" value={sectorName} onChange={(e) => setSectorName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Temporary Password for Official:</label>
                        <input type="password" value={sectorPassword} onChange={(e) => setSectorPassword(e.target.value)} required minLength="6" />
                        <small>This password will be used for the sector official's login. Min 6 characters.</small>
                    </div>
                    <button type="submit" className="btn btn-primary">Add Sector</button>
                </form>

                <div className="list-section">
                    <h4>Current Sectors</h4>
                    {sectors.length === 0 ? <p>No sectors added yet.</p> : (
                        <div className="list-cards">
                            {sectors.map(sector => (
                                <div key={sector.id} className="list-card">
                                    <p><strong>{sector.name}</strong></p>
                                    <p>Login Email: {sector.email}</p>
                                    <button
                                        className="btn btn-danger btn-small"
                                        onClick={() => handleDeleteSector(sector.id, sector.name, sector.email)}
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
                <button className={`tab-button ${activeTab === 'sectors' ? 'active' : ''}`} onClick={() => setActiveTab('sectors')}>Manage Sectors</button>
            </div>

            <div className="admin-content">
                {activeTab === 'events' && <ManageEvents />}
                {activeTab === 'judges' && <ManageJudges />}
                {activeTab === 'participants' && <ManageParticipants />}
                {activeTab === 'results' && <ManageResults />}
                {activeTab === 'leaderboard' && <ManageLeaderboard />}
                {activeTab === 'sectors' && <ManageSectors />}
            </div>
        </div>
    );
};

export default AdminDashboard;
