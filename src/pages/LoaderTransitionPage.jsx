import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './LoaderTransitionPage.module.css';

const LOADER_STATES = [
  {
    headline: 'Checking your answers...',
    supportingText: "We're reviewing your property details.",
    duration: 1200,
  },
  {
    headline: 'Matching you with a trusted solar installer',
    supportingText: 'We only work with vetted UK installers.',
    duration: 1200,
  },
  {
    headline: "You're eligible for solar panels",
    supportingText: 'Connecting you with Project Solar UK...',
    duration: 1200,
  },
];

const FADE_IN_MS = 500;
const FADE_OUT_MS = 400;

const ECO_EXPERTS_LOGO = 'https://images-ulpn.ecs.prd9.eu-west-1.mvfglobal.net/mp/wp-content/uploads/sites/3/2022/09/ee-logo.svg';
const PROJECT_SOLAR_LOGO = 'https://images-ulpn.ecs.prd9.eu-west-1.mvfglobal.net/wp-content/uploads/2025/10/Project-Solar-long-full-colour-without-tag.svg';

export default function LoaderTransitionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentState, setCurrentState] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showProjectSolar, setShowProjectSolar] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const containerRef = useRef(null);

  const navigateAway = useCallback(() => {
    setFadingOut(true);
    setTimeout(() => {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'solar-optly-loader-complete' }, '*');
      }
      navigate({ pathname: '/', search: location.search });
    }, FADE_OUT_MS);
  }, [navigate, location.search]);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    const totalDuration = LOADER_STATES.reduce((sum, state) => sum + state.duration, 0);
    let elapsed = 0;

    const progressInterval = setInterval(() => {
      elapsed += 50;
      setProgress(Math.min((elapsed / totalDuration) * 100, 100));
    }, 50);

    let cumulativeTime = 0;
    const timeouts = [];
    LOADER_STATES.forEach((state, index) => {
      if (index > 0) {
        timeouts.push(
          setTimeout(() => {
            setCurrentState(index);
            if (index === 2) {
              setShowProjectSolar(true);
            }
          }, cumulativeTime)
        );
      }
      cumulativeTime += state.duration;
    });

    const navigationTimeout = setTimeout(navigateAway, totalDuration + 200);
    timeouts.push(navigationTimeout);

    return () => {
      clearInterval(progressInterval);
      timeouts.forEach(clearTimeout);
    };
  }, [navigateAway]);

  const { headline, supportingText } = LOADER_STATES[currentState];

  const containerClass = [
    styles.container,
    mounted && !fadingOut ? styles.visible : '',
    fadingOut ? styles.fadeOutContainer : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={containerRef} className={containerClass}>
      <div className={styles.loaderArea}>
        {/* Brand Logo Animation */}
        <div className={styles.logoContainer}>
          <img
            src={ECO_EXPERTS_LOGO}
            alt="The Eco Experts"
            className={`${styles.logo} ${showProjectSolar ? styles.fadeOut : styles.fadeIn}`}
          />
          <img
            src={PROJECT_SOLAR_LOGO}
            alt="Project Solar"
            className={`${styles.logo} ${styles.projectSolarLogo} ${showProjectSolar ? styles.fadeIn : styles.hidden}`}
          />
        </div>

        {showProjectSolar && (
          <div className={styles.partnershipStrip}>
            <img
              src={ECO_EXPERTS_LOGO}
              alt="The Eco Experts"
              className={styles.partnershipLogo}
            />
            <span className={styles.partnershipText}>In partnership with</span>
            <img
              src={PROJECT_SOLAR_LOGO}
              alt="Project Solar"
              className={styles.partnershipLogo}
            />
          </div>
        )}

        {/* Progress Circle */}
        <div className={styles.progressContainer}>
          <svg className={styles.progressCircle} viewBox="0 0 100 100">
            <circle
              className={styles.progressBackground}
              cx="50"
              cy="50"
              r="45"
            />
            <circle
              className={styles.progressBar}
              cx="50"
              cy="50"
              r="45"
              strokeDasharray={`${progress * 2.83} 283`}
            />
          </svg>
          <span className={styles.progressText}>{Math.round(progress)}%</span>
        </div>

        {/* Loader Copy */}
        <h1 key={`h-${currentState}`} className={styles.headline}>{headline}</h1>
        <p key={`s-${currentState}`} className={styles.supportingText}>{supportingText}</p>
      </div>

      {/* Trust Signals */}
      <div className={styles.trustSignals}>
        <div className={styles.trustItem}>
          <span className={styles.trustIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </span>
          <span>Trusted by thousands of UK homeowners</span>
        </div>
        <div className={styles.trustItem}>
          <span className={styles.trustIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </span>
          <span>FCA & HIES regulated installers</span>
        </div>
        <div className={styles.trustItem}>
          <span className={styles.trustIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </span>
          <span>No obligation, free consultation</span>
        </div>
      </div>
    </div>
  );
}
