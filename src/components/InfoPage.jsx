// Path: src/components/InfoPage.jsx

import React from 'react';
import { Link } from 'react-router-dom';

const InfoPage = () => {
    return (
        <div className="page-container info-page">
            <h1>General Information</h1>

            <section className="info-section">
                <h2>Event Overview</h2>
                <p>
                    Sahithyolsav is an annual inter-sector cultural competition hosted by the Iritty Division.
                    It aims to identify and nurture talents in various artistic and literary fields across different age groups.
                    This event promotes healthy competition, cultural exchange, and community bonding.
                </p>
            </section>

            <section className="info-section">
                <h2>Participation Guidelines</h2>
                <ul>
                    <li>Participants must be registered through their respective sectors.</li>
                    <li>Each participant can register for multiple events within their eligible category.</li>
                    <li>Event codes for participants will be assigned by the Admin.</li>
                    <li>Please refer to the detailed rulebook for specific event guidelines.</li>
                </ul>
            </section>

            <section className="info-section">
                <h2>Judging Criteria</h2>
                <p>
                    Our events are judged by experienced and impartial judges. Marks are awarded based on predefined
                    criteria specific to each competition, including creativity, presentation, adherence to rules,
                    and technical skill. The judging process is transparent and aims to ensure fairness.
                </p>
            </section>

            <section className="info-section">
                <h2>Results and Leaderboard</h2>
                <p>
                    Results for individual events will be published on the "Results" page shortly after the completion
                    of judging for that event. The overall sector leaderboard, showcasing cumulative points, will be
                    updated periodically and finalized at the end of the event.
                </p>
            </section>

            <section className="info-section">
                <h2>Contact & Support</h2>
                <p>
                    For any queries regarding registration, events, or general information, please reach out to:
                </p>
                <ul>
                    <li><strong>Event Coordinators:</strong> coordinator@sahithyolsav.com</li>
                    <li><strong>Technical Support:</strong> support@sahithyolsav.com</li>
                    <li><strong>Emergency Contact:</strong> +91 XXXXXXXX</li>
                </ul>
            </section>
        </div>
    );
};

export default InfoPage;
