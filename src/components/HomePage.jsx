// Path: src/components/HomePage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx'; // Correct path to AuthContext
import { MessageBox } from './UtilityComponents.jsx'; // Import MessageBox
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'; // Import Firestore functions

import themeImage from '/banner.png'; // Import the theme image for the banner

const HomePage = () => {
    const { db, appId } = useAuth();
    const [events, setEvents] = useState([]);
    const [message, setMessage] = useState('');
    const [displayMode, setDisplayMode] = useState('category'); // 'category' or 'stage'

    // --- Countdown State and Logic ---
    const showCountdown = false; // Set to false to hide the countdown
    const eventDate = new Date('2025-07-19T09:00:00+05:30'); // July 19, 2025, 9:00 AM IST (UTC+5:30)
    const [timeLeft, setTimeLeft] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
    });
    const [countdownEnded, setCountdownEnded] = useState(false);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            const difference = eventDate.getTime() - now.getTime();

            if (difference < 0) {
                setCountdownEnded(true);
                return { days: 0, hours: 0, minutes: 0, seconds: 0 };
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((difference / 1000 / 60) % 60);
            const seconds = Math.floor((difference / 1000) % 60);

            return { days, hours, minutes, seconds };
        };

        if (showCountdown) {
            setTimeLeft(calculateTimeLeft()); // Initial calculation
            const timer = setInterval(() => {
                const newTimeLeft = calculateTimeLeft();
                if (newTimeLeft.days === 0 && newTimeLeft.hours === 0 && newTimeLeft.minutes === 0 && newTimeLeft.seconds === 0) {
                    setCountdownEnded(true);
                    clearInterval(timer);
                }
                setTimeLeft(newTimeLeft);
            }, 1000);

            return () => clearInterval(timer); // Cleanup on unmount
        }
    }, [showCountdown]);
    // --- End Countdown State and Logic ---


    useEffect(() => {
        if (!db) return;

        // Query to fetch only public events, ordered by date and then time
        const eventsColRef = collection(db, `artifacts/${appId}/public/data/events`);
        const q = query(
            eventsColRef,
            where('isPublic', '==', true),
            orderBy('date', 'asc'), // Sort by date ascending
            orderBy('time', 'asc')  // Then by time ascending
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEvents(eventsData);
            setMessage('');
        }, (error) => {
            console.error("Error fetching public events:", error);
            setMessage("Failed to load events. Please try again.");
        });

        return () => unsubscribe();
    }, [db, appId]);

    const getEventStatus = (event) => {
        const eventDate = new Date(event.date);
        const eventTimeParts = event.time.split(':');
        eventDate.setHours(parseInt(eventTimeParts[0]), parseInt(eventTimeParts[1]));
        const now = new Date();

        if (event.status === 'over') return 'Over';
        if (event.status === 'live') return 'Live Now';
        if (eventDate < now) return 'Scheduled';
        if (eventDate > now) return 'Scheduled'; // If future, still scheduled
        return 'Unknown';
    };

    // Helper to convert 24-hour time to 12-hour AM/PM format
    const formatTime = (time24) => {
        if (!time24) return 'N/A';
        const [hours, minutes] = time24.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes));
        // Explicitly set hour12 to true and define locale for consistent AM/PM
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const getJudgesForEvent = (event) => {
        if (!event.judges || event.judges.length === 0) return 'No judges assigned yet.';
        return event.judges.map(j => j.name).join(', ');
    };

    // Group events based on selected display mode
    const groupedEvents = events.reduce((acc, event) => {
        const key = displayMode === 'category' ? event.category : event.stage;
        const groupName = key || (displayMode === 'category' ? 'Uncategorized' : 'Unassigned Stage');
        if (!acc[groupName]) {
            acc[groupName] = [];
        }
        acc[groupName].push(event);
        return acc;
    }, {});

    // Sort the keys (category names or stage names) alphabetically
    const sortedGroupNames = Object.keys(groupedEvents).sort();

    return (
        <div className="home-page-container">
            <header className="hero-section-image">
                <img src={themeImage} alt="Sahithyolsav Banner" className="banner-image" />
            </header>

            <MessageBox message={message} type={message.includes("Failed") ? 'error' : 'info'} onClose={() => setMessage('')} />

            <section className="events-section home-section">
                <h2>Event Schedule</h2>
                {showCountdown && (
                    <div className="countdown-container">
                        <p className="countdown-title">Event Starts In:</p>
                        {countdownEnded ? (
                            <p className="countdown-timer">The event has started!</p>
                        ) : (
                            <div className="countdown-timer">
                                <div className="countdown-item">
                                    {timeLeft.days}<span>Days</span>
                                </div>
                                <div className="countdown-item">
                                    {timeLeft.hours}<span>Hours</span>
                                </div>
                                <div className="countdown-item">
                                    {timeLeft.minutes}<span>Minutes</span>
                                </div>
                                <div className="countdown-item">
                                    {timeLeft.seconds}<span>Seconds</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="display-mode-selector form-group">
                    <label htmlFor="display-mode-select">View Events By:</label>
                    <select
                        id="display-mode-select"
                        value={displayMode}
                        onChange={(e) => setDisplayMode(e.target.value)}
                        className="select-filter"
                    >
                        <option value="category">Category</option>
                        <option value="stage">Stage</option>
                    </select>
                </div>

                {sortedGroupNames.length === 0 ? (
                    <p className="no-data-message">No public events scheduled yet. Check back soon!</p>
                ) : (
                    sortedGroupNames.map(groupName => (
                        <div key={groupName} className="event-category-group-homepage">
                            <h3>{displayMode === 'category' ? `Category: ${groupName}` : `Stage: ${groupName}`}</h3>
                            <div className="event-cards-container">
                                {groupedEvents[groupName].map(event => ( // Events within group are already sorted by date/time from Firestore query
                                    <div key={event.id} className="event-card">
                                        <h4>{event.name}</h4>
                                        <p><strong>Date:</strong> {event.date}</p>
                                        <p><strong>Time:</strong> {formatTime(event.time)} {event.endTime ? `- ${formatTime(event.endTime)}` : ''}</p>
                                        <p><strong>Stage:</strong> {event.stage}</p>
                                        <p><strong>Category:</strong> {event.category}</p>
                                        <p><strong>Status:</strong> <span className={`event-status ${getEventStatus(event).toLowerCase().replace(' (not marked as complete)', '').replace(' ', '-')}`}>{getEventStatus(event)}</span></p>
                                        <p><strong>Judges:</strong> {getJudgesForEvent(event)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </section>

            <section className="about-section home-section">
                <h2>About Sahithyolsav</h2>
                <p>
                    Sahithyolsav—Kerala’s beloved festival of 
                    literature—returns in all its glory with the 32nd 
                    edition under the Iritty Division, set against the 
                    serene backdrop of Vallithode on July 19–20, 2025.
                </p>
                <p>
                    This year’s theme, “അനുഭവങ്ങളുടെ കല – Feel the Experience,” 
                    invites us to explore literature not just as written word, but as living emotion, shared memory, and creative reflection. Every poem, every story, every dialogue becomes a brushstroke in the grand canvas of human experience.
                </p>
                <p>
                    This 32nd edition is more than an event—it is an invitation to feel, to reflect, and to express. Whether you are a budding writer, a curious student, a passionate reader, or a cultural enthusiast, 
                    Sahithyolsav promises two days of literary immersion, creative awakening, and unforgettable moments.
                </p>
            </section>

            <section className="contact-info-section home-section">
                <h2>Get in Touch</h2>
                <p>Have questions or need assistance? Reach out to us!</p>
                <ul>
                    <li><strong>Email:</strong> info@sahithyolsav.com</li>
                    <li><strong>Phone:</strong> +91 70253 03402</li>
                    <li><strong>Address:</strong> Sunni Center, Iritty Division,Vallithod, Kerala</li>
                </ul>
                <p>For more details, visit our <Link to="/info" className="text-link">Information Page</Link>.</p>
            </section>
        </div>
    );
};

export default HomePage;
