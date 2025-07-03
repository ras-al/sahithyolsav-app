// Path: src/components/HomePage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx'; // Correct path to AuthContext
import { MessageBox } from './UtilityComponents.jsx'; // Import MessageBox
import { collection, onSnapshot, query, where } from 'firebase/firestore'; // Import Firestore functions

const HomePage = () => {
    const { db, appId } = useAuth();
    const [events, setEvents] = useState([]);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!db) return;

        // Query to fetch only public events
        const eventsColRef = collection(db, `artifacts/${appId}/public/data/events`);
        const q = query(eventsColRef, where('isPublic', '==', true)); // Only show public events

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

    const getJudgesForEvent = (event) => {
        if (!event.judges || event.judges.length === 0) return 'No judges assigned yet.';
        return event.judges.map(j => j.name).join(', ');
    };

    // Group events by category
    const eventsByCategory = events.reduce((acc, event) => {
        const category = event.category || 'Uncategorized';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(event);
        return acc;
    }, {});

    return (
        <div className="home-page-container">
            <header className="hero-section-image">
                {/* Banner Image */}
                <img src="/banner.png" alt="Sahithyolsav 2025 Banner" className="banner-image" />
            </header>

            <MessageBox message={message} type={message.includes("Failed") ? 'error' : 'info'} onClose={() => setMessage('')} />

            <section className="events-section home-section">
                <h2>Event Schedule</h2>
                {Object.keys(eventsByCategory).length === 0 ? (
                    <p className="no-data-message">No public events scheduled yet. Check back soon!</p>
                ) : (
                    Object.entries(eventsByCategory).map(([category, eventsInCat]) => (
                        <div key={category} className="event-category-group-homepage">
                            <h3>Category: {category}</h3>
                            <div className="event-cards-container">
                                {eventsInCat.map(event => (
                                    <div key={event.id} className="event-card">
                                        <h4>{event.name}</h4>
                                        <p><strong>Date:</strong> {event.date}</p>
                                        <p><strong>Time:</strong> {event.time}</p>
                                        <p><strong>Location:</strong> {event.location || 'N/A'}</p>
                                        <p><strong>Stage:</strong> {event.stage}</p>
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
                    Sahithyolsav is an annual cultural extravaganza bringing together artists, writers, and performers
                    from all age groups and sectors within the Iritty Division. Our aim is to foster creativity, promote
                    cultural exchange, and provide a platform for budding talents. This year's event promises to be
                    bigger and better, with a wide array of competitions and showcases designed to inspire and entertain.
                </p>
                <p>
                    From captivating on-stage performances like Khavali and music to intricate off-stage competitions
                    such as essay writing and painting, Sahithyolsav celebrates every facet of artistic expression.
                    We encourage everyone to participate, cheer for their favorite sectors, and make this event a grand success!
                </p>
            </section>

            <section className="contact-info-section home-section">
                <h2>Get in Touch</h2>
                <p>Have questions or need assistance? Reach out to us!</p>
                <ul>
                    <li><strong>Email:</strong> info@sahithyolsav.com</li>
                    <li><strong>Phone:</strong> +91 98765 43210</li>
                    <li><strong>Address:</strong> Cultural Event Grounds, Iritty Division, Kerala</li>
                </ul>
                <p>For more details, visit our <Link to="/info" className="text-link">Information Page</Link>.</p>
            </section>
        </div>
    );
};

export default HomePage;
