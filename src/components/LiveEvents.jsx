// Path: src/components/LiveEvents.jsx

import React from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation

const LiveEvents = () => {
    // Removed all state and useEffect hooks for fetching live events and participants
    // const { db, appId } = useAuth();
    // const [liveEventsByStage, setLiveEventsByStage] = useState({});
    // const [allParticipants, setAllParticipants] = useState([]);
    // const [loading, setLoading] = useState(true);
    // const [error, setError] = useState(null);
    // useEffect(() => { ... }, [db, appId]);

    // Helper to convert 24-hour time to 12-hour AM/PM format (kept for potential future use if live events are re-enabled)
    // const formatTime = (time24) => {
    //     if (!time24) return 'N/A';
    //     const [hours, minutes] = time24.split(':');
    //     const date = new Date();
    //     date.setHours(parseInt(hours), parseInt(minutes));
    //     return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    // };

    return (
        <div className="page-container live-events-page">
            <h2>Live Events</h2>
            <p className="no-data-message">
                Sahithyolsav 2025 has concluded. There are no live events happening at this time.
                <br /><br />
                Please visit the <Link to="/results" className="text-link">Results page</Link> for final event outcomes
                and the <Link to="/leaderboard" className="text-link">Leaderboard page</Link> for overall sector standings.
            </p>
        </div>
    );
};

export default LiveEvents;
