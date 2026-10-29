import React, { useState, useEffect } from 'react';
import './IntroSplash.css';

/**
 * IntroSplash Component
 * Displays the animated brand splash screen before transitioning to the Login screen.
 * 
 * Animation Timeline:
 * - 0.1s - 0.8s : "Smart Expense" reveals with smooth upward slide & blur dissolve
 * - 0.6s - 1.5s : Teal signature curved underline draws from left to right
 * - 1.4s - 1.8s : Accent terminal dot pops with elastic scale and soft glow
 * - 1.6s - 2.2s : "T R A C K E R" expands with letter-spacing tracking
 * - 2.0s - 2.6s : Tagline "Know where every rupee goes." fades in
 * - 3.2s        : Seamless cross-dissolve to the Login screen
 */
const IntroSplash = ({ onFinish }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleProceed = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      if (onFinish) onFinish();
    }, 600); // Wait for exit fade animation to finish
  };

  useEffect(() => {
    // Automatically transition to login after animation completes
    const timer = setTimeout(() => {
      handleProceed();
    }, 3200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      className={`intro-splash-container ${isExiting ? 'fade-exit' : ''}`}
      onClick={handleProceed}
      title="Click anywhere to continue"
    >
      {/* Background ambient lighting */}
      <div className="intro-ambient-glow" />

      {/* Main White Canvas Card */}
      <div className="intro-card" onClick={(e) => e.stopPropagation()}>
        
        {/* Skip / Continue button in top right */}
        <button 
          className="intro-skip-btn" 
          onClick={handleProceed}
          aria-label="Skip to Login"
        >
          <span>Continue</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <div className="intro-content">
          
          {/* Main Brand Title */}
          <h1 className="intro-title">Smart Expense</h1>

          {/* Signature Teal Curved Swoosh with Dot */}
          <div className="intro-swoosh-wrapper">
            <svg 
              className="intro-swoosh-svg" 
              viewBox="0 0 460 48" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="swooshGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00b894" />
                  <stop offset="100%" stopColor="#00d68f" />
                </linearGradient>
                <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#00d68f" floodOpacity="0.6" />
                </filter>
              </defs>

              {/* Animated Curve */}
              <path
                d="M 12 22 C 145 42, 315 42, 438 12"
                stroke="url(#swooshGrad)"
                strokeWidth="5.5"
                strokeLinecap="round"
                className="intro-swoosh-path"
              />

              {/* Terminal Teal Dot */}
              <circle
                cx="441"
                cy="11"
                r="6.5"
                fill="#00d68f"
                className="intro-swoosh-dot"
                filter="url(#dotGlow)"
              />
            </svg>
          </div>

          {/* Spaced Out TRACKER */}
          <div className="intro-subtitle">
            <span>T</span>
            <span>R</span>
            <span>A</span>
            <span>C</span>
            <span>K</span>
            <span>E</span>
            <span>R</span>
          </div>

        </div>

        {/* Tagline at Bottom */}
        <p className="intro-tagline">Know where every rupee goes.</p>

      </div>
    </div>
  );
};

export default IntroSplash;

