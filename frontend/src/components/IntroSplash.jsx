import React, { useState, useEffect } from 'react';
import './IntroSplash.css';

// Inspiring rotating tagline collection
const TAGLINES = [
  "Know where every rupee goes.",
  "Track today. Save tomorrow.",
  "Simple spending, smarter savings.",
  "Every transaction counts, every rupee matters.",
  "Master your cash, conquer your bank.",
  "Spend with clarity, save with confidence.",
  "Your personal finance, beautifully organized."
];

/**
 * IntroSplash Component (Full Screen View)
 * Displays the full-screen brand animation on site entrance with rotating taglines.
 */
const IntroSplash = ({ onFinish }) => {
  const [isExiting, setIsExiting] = useState(false);

  // Rotate through taglines on every refresh or visit
  const [tagline] = useState(() => {
    try {
      const lastIndex = parseInt(localStorage.getItem('splash_tagline_idx') || '-1', 10);
      const nextIndex = (lastIndex + 1) % TAGLINES.length;
      localStorage.setItem('splash_tagline_idx', nextIndex.toString());
      return TAGLINES[nextIndex];
    } catch {
      return TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
    }
  });

  const handleProceed = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      if (onFinish) onFinish();
    }, 600);
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
      className={`intro-splash-fullscreen ${isExiting ? 'fade-exit' : ''}`}
      onClick={handleProceed}
    >
      {/* Mathematically Centered Content */}
      <div className="intro-center-content">
        
        {/* Main Title: Smart Expense */}
        <h1 className="intro-title">Smart Expense</h1>

        {/* Signature Teal Curved Swoosh with Terminal Dot */}
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
            </defs>

            {/* Animated Curved Line */}
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

      {/* Rotating Bottom Tagline */}
      <p className="intro-tagline">{tagline}</p>

    </div>
  );
};

export default IntroSplash;
