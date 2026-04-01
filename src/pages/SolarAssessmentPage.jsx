import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBooking } from '../contexts';
import { config } from '../config/env';
import {
  RoofSegmentMap,
  PropertyMapSelector,
  ImageryAgeWarning,
} from '../components/forms';
import {
  adjustSegmentPanelCounts,
  calculateEffectivePanelRatio,
} from '../utils/panelCalculations';
import {
  isImageryOlderThan2Years,
  formatImageryDateForWarning,
} from '../utils/imageryDate';
import { isNorthFacing } from '../utils/orientation';
import {
  calculateAnnualSavings,
  formatSavings,
  getSavingsDisclaimer,
  getAnnualUsageByBedrooms,
} from '../utils/savingsCalculations';
import styles from './SolarAssessmentPage.module.css';

// Temporary flag to use mock data during UAT
const USE_MOCK_DATA = false;

/** Parent (Optimizely) maps this to POST …/appointments/{id} failed updates. */
function notifyParentSolarJourneyFailed(error) {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage(
    { type: 'solar-optly-booking-result', success: false, error },
    '*'
  );
}

// Mock solar assessment data for UAT with bounding boxes for map display
const MOCK_SOLAR_DATA = {
  imageryDate: '2024-06-15',
  imageryProcessedDate: '2024-07-01',
  imageryQuality: 'high',
  totalRoofArea: 45,
  segments: [
    {
      azimuth: 180, // South facing
      pitch: 30,
      area: 22,
      panelCount: 10, // Google's panel count (will be adjusted)
      estimatedEnergy: 2800,
      center: { latitude: 51.5074, longitude: -0.1278 },
      boundingBox: {
        sw: { latitude: 51.50735, longitude: -0.12790 },
        ne: { latitude: 51.50745, longitude: -0.12770 },
      },
    },
    {
      azimuth: 90, // East facing
      pitch: 25,
      area: 15,
      panelCount: 6, // Google's panel count
      estimatedEnergy: 1500,
      center: { latitude: 51.5075, longitude: -0.1276 },
      boundingBox: {
        sw: { latitude: 51.50745, longitude: -0.12770 },
        ne: { latitude: 51.50755, longitude: -0.12750 },
      },
    },
    {
      azimuth: 0, // North facing
      pitch: 30,
      area: 8,
      panelCount: 4, // Google's panel count
      estimatedEnergy: 600,
      center: { latitude: 51.5073, longitude: -0.1277 },
      boundingBox: {
        sw: { latitude: 51.50725, longitude: -0.12780 },
        ne: { latitude: 51.50735, longitude: -0.12760 },
      },
    },
  ],
};

export default function SolarAssessmentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    bookingData,
    setSolarAssessmentData,
    updateBookingData,
    setJourneyStatus,
    setManualLocation,
  } = useBooking();

  // React Router state is synchronous and always available on the
  // destination render -- use it as a fallback when context hasn't
  // committed yet (Safari cross-origin iframe timing).
  const routeState = location.state || {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [solarData, setSolarData] = useState(null);
  const [selectedSegments, setSelectedSegments] = useState([]);
  const [showPropertySelector, setShowPropertySelector] = useState(false);
  const [showImageryWarning, setShowImageryWarning] = useState(false);
  const [imageryWarningAnswered, setImageryWarningAnswered] = useState(false);
  const [showSavingsTooltip, setShowSavingsTooltip] = useState(false);

  // Calculate estimated annual savings based on selected segments
  const estimatedSavings = useMemo(() => {
    if (!solarData?.segments?.length || selectedSegments.length === 0) {
      return { totalSavings: 0 };
    }

    const selected = selectedSegments.map(i => solarData.segments[i]).filter(Boolean);
    const totalEstimatedEnergy = selected.reduce((sum, s) => sum + (s.estimatedEnergy ?? 0), 0);

    // Use 3 bedrooms as default if not specified (average UK home)
    const annualUsage = getAnnualUsageByBedrooms(3);
    return calculateAnnualSavings(totalEstimatedEnergy, annualUsage);
  }, [solarData, selectedSegments]);

  // Calculate solar potential stats for selected segments
  const solarPotential = useMemo(() => {
    if (!solarData?.segments?.length || selectedSegments.length === 0) {
      return {
        suitableFaces: 0,
        maxPanels: 0,
        usableRoofArea: 0,
        avgSunHours: 0,
        systemCapacity: 0,
        yearlyOutput: 0,
      };
    }

    const selected = selectedSegments.map(i => solarData.segments[i]).filter(Boolean);
    const getPanelCount = (s) => s.adjustedPanelCount ?? s.panelCount ?? 0;

    const suitableFaces = selected.length;
    const maxPanels = selected.reduce((sum, s) => sum + getPanelCount(s), 0);
    const usableRoofArea = selected.reduce((sum, s) => sum + (s.area ?? 0), 0);
    const yearlyOutput = selected.reduce((sum, s) => sum + (s.estimatedEnergy ?? 0), 0);

    // Estimate average sun hours (UK average ~1000-1200 hours/year for solar production)
    // Calculate based on energy output vs panel count (higher = more sun hours)
    // Using 500W panels (0.5kW) as per Project Solar specifications
    const avgSunHours = maxPanels > 0 ? Math.round(yearlyOutput / (maxPanels * 0.5 * 4)) : 0;

    // System capacity in kW (each panel ~500W = 0.5kW per Project Solar specs)
    const systemCapacity = maxPanels * 0.5;

    return {
      suitableFaces,
      maxPanels,
      usableRoofArea: Math.round(usableRoofArea),
      avgSunHours: Math.min(avgSunHours, 1200), // Cap at realistic UK max
      systemCapacity: systemCapacity.toFixed(1),
      yearlyOutput: Math.round(yearlyOutput),
    };
  }, [solarData, selectedSegments]);

  const hasFetched = useRef(false);

  useEffect(() => {
    const lat = bookingData.latitude ?? routeState.latitude;
    const lng = bookingData.longitude ?? routeState.longitude;

    console.log('[SolarAssessment] useEffect fired', {
      hasFetched: hasFetched.current,
      contextLat: bookingData.latitude,
      contextLng: bookingData.longitude,
      routeStateLat: routeState.latitude,
      routeStateLng: routeState.longitude,
      resolvedLat: lat,
      resolvedLng: lng,
    });

    if (hasFetched.current) return;

    if (lat != null && lng != null) {
      console.log('[SolarAssessment] Coordinates available, fetching solar data');
      hasFetched.current = true;
      fetchSolarAssessment(lat, lng);
      return;
    }

    console.log('[SolarAssessment] Coordinates null, waiting (5s timeout)');
    const timeout = setTimeout(() => {
      if (!hasFetched.current) {
        console.warn('[SolarAssessment] Timeout: coordinates never arrived');
        notifyParentSolarJourneyFailed('solar_coordinates_unavailable');
        setLoading(false);
        setError('Location coordinates not available. Please go back and select your address.');
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [bookingData.latitude, bookingData.longitude, routeState.latitude, routeState.longitude]);

  const fetchSolarAssessment = async (lat, lng) => {
    const minDisplayTime = new Promise(resolve => setTimeout(resolve, 3000));
    try {
      setLoading(true);
      setError('');

      const latitude = lat ?? bookingData.latitude;
      const longitude = lng ?? bookingData.longitude;

      if (latitude == null || longitude == null) {
        throw new Error('Location coordinates not available. Please go back and select your address.');
      }

      if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Process segments with panel adjustments
        const processedSegments = adjustSegmentPanelCounts(
          MOCK_SOLAR_DATA.segments,
          MOCK_SOLAR_DATA.imageryQuality
        );

        // Filter segments: pitch >= 15 AND adjustedPanelCount >= 3
        const displayableSegments = processedSegments.filter(
          s => s.pitch >= 15 && (s.adjustedPanelCount ?? s.panelCount) >= 3
        );

        setSolarData({
          ...MOCK_SOLAR_DATA,
          segments: displayableSegments,
        });

        // Auto-select all segments by default
        const allSegmentIndices = displayableSegments.map((_, index) => index);
        setSelectedSegments(allSegmentIndices);
        setLoading(false);
        return;
      }

      // Call Google Solar API directly
      const apiKey = config.googleMapsApiKey;
      if (!apiKey) {
        throw new Error('Google Maps API key not configured');
      }

      const googleSolarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${latitude}&location.longitude=${longitude}&requiredQuality=MEDIUM&key=${apiKey}`;

      const response = await fetch(googleSolarUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Google Solar API error:', errorData);

        // Handle specific error cases
        if (response.status === 404) {
          throw new Error('NO_COVERAGE');
        }
        throw new Error(errorData.error?.message || 'Failed to fetch solar assessment');
      }

      const googleData = await response.json();

      // Debug: Log raw Google Solar API response
      console.log('=== GOOGLE SOLAR API RAW RESPONSE ===');
      console.log('Total solarPanels count:', googleData.solarPotential?.solarPanels?.length || 0);
      console.log('Total roofSegments count:', googleData.solarPotential?.roofSegmentStats?.length || 0);
      console.log('Imagery quality:', googleData.imageryQuality);
      console.log('Full response:', googleData);

      // Transform Google Solar API response to our expected format
      const data = transformGoogleSolarResponse(googleData, latitude, longitude);

      // Debug: Log transformed data
      console.log('=== TRANSFORMED DATA ===');
      console.log('Segments before adjustment:', data.segments);

      // Process segments with panel adjustments
      const processedSegments = adjustSegmentPanelCounts(
        data.segments,
        data.imageryQuality
      );

      // Debug: Log adjusted segments
      console.log('=== SEGMENTS AFTER PANEL ADJUSTMENT ===');
      processedSegments.forEach((seg, i) => {
        console.log(`Segment ${i}: azimuth=${seg.azimuth}°, pitch=${seg.pitch}°, googlePanels=${seg.googlePanelCount}, adjustedPanels=${seg.adjustedPanelCount}, energy=${seg.estimatedEnergy}kWh`);
      });

      // Filter segments: pitch >= 15 AND adjustedPanelCount >= 3
      const displayableSegments = processedSegments.filter(
        s => s.pitch >= 15 && (s.adjustedPanelCount ?? s.panelCount) >= 3
      );

      // Debug: Log displayable segments
      console.log('=== DISPLAYABLE SEGMENTS (pitch>=15, panels>=3) ===');
      console.log('Count:', displayableSegments.length);
      displayableSegments.forEach((seg, i) => {
        console.log(`Display ${i}: azimuth=${seg.azimuth}°, pitch=${seg.pitch}°, panels=${seg.adjustedPanelCount}`);
      });

      setSolarData({
        ...data,
        segments: displayableSegments,
      });

      // Auto-select all segments by default
      const allSegmentIndices = displayableSegments.map((_, index) => index);
      setSelectedSegments(allSegmentIndices);
    } catch (err) {
      console.error('Solar assessment error:', err);

      if (err.message === 'NO_COVERAGE') {
        notifyParentSolarJourneyFailed('solar_no_coverage');
        setError('Solar data is not available for this location. Google Solar API coverage is limited to certain areas. Please contact us for a manual assessment.');
      } else if (
        String(err.message || '').toLowerCase().indexOf('coordinate') !== -1
      ) {
        notifyParentSolarJourneyFailed('solar_coordinates_unavailable');
        setError(
          err.message ||
            'Location coordinates not available. Please go back and select your address.'
        );
      } else {
        notifyParentSolarJourneyFailed('solar_api_error');
        setError('Unable to assess your roof. Please try again or contact support.');
      }
    } finally {
      await minDisplayTime;
      setLoading(false);
    }
  };

  // Transform Google Solar API response to our app's expected format
  // Following Lovable app's data processing rules
  const transformGoogleSolarResponse = (googleData, latitude, longitude) => {
    const solarPotential = googleData.solarPotential || {};
    const roofSegments = solarPotential.roofSegmentStats || [];
    const solarPanels = solarPotential.solarPanels || [];

    // Count panels per segment from the solarPanels array
    // Each panel has a segmentIndex indicating which roof segment it belongs to
    const panelCountsBySegment = {};
    const energyBySegment = {};

    solarPanels.forEach((panel) => {
      const segmentIndex = panel.segmentIndex ?? 0;
      panelCountsBySegment[segmentIndex] = (panelCountsBySegment[segmentIndex] || 0) + 1;
      energyBySegment[segmentIndex] = (energyBySegment[segmentIndex] || 0) + (panel.yearlyEnergyDcKwh || 0);
    });

    // Map Google's roof segment data to our format using actual API center/boundingBox
    const segments = roofSegments.map((segment, index) => {
      // Use actual center from API, fallback to property coordinates with offset
      const segmentCenter = segment.center || {
        latitude: latitude + (index * 0.0001),
        longitude: longitude + (index * 0.0001),
      };

      // Use actual boundingBox from API, fallback to calculated box
      const segmentBoundingBox = segment.boundingBox || {
        sw: {
          latitude: segmentCenter.latitude - 0.00005,
          longitude: segmentCenter.longitude - 0.00005,
        },
        ne: {
          latitude: segmentCenter.latitude + 0.00005,
          longitude: segmentCenter.longitude + 0.00005,
        },
      };

      // Get Google's panel count for this segment from solarPanels array
      const googlePanelCount = panelCountsBySegment[index] || 0;

      // Get energy for this segment from solarPanels array
      const segmentEnergy = energyBySegment[index] || 0;

      // Get sunshine quantiles for additional calculations
      const sunshineQuantiles = segment.stats?.sunshineQuantiles || [];

      return {
        azimuth: segment.azimuthDegrees ?? 0,
        pitch: segment.pitchDegrees ?? 0,
        area: segment.stats?.areaMeters2 ?? 0,
        // Store Google's raw panel count - will be adjusted by adjustSegmentPanelCounts
        panelCount: googlePanelCount,
        googlePanelCount: googlePanelCount,
        // Use energy from solarPanels array, adjusted for 500W panels (ratio 500/400 = 1.25)
        estimatedEnergy: Math.round(segmentEnergy * 1.25),
        sunshineQuantiles: sunshineQuantiles,
        // Use actual coordinates from API
        center: {
          latitude: segmentCenter.latitude,
          longitude: segmentCenter.longitude,
        },
        boundingBox: {
          sw: {
            latitude: segmentBoundingBox.sw?.latitude ?? segmentCenter.latitude - 0.00005,
            longitude: segmentBoundingBox.sw?.longitude ?? segmentCenter.longitude - 0.00005,
          },
          ne: {
            latitude: segmentBoundingBox.ne?.latitude ?? segmentCenter.latitude + 0.00005,
            longitude: segmentBoundingBox.ne?.longitude ?? segmentCenter.longitude + 0.00005,
          },
        },
      };
    });

    // Determine imagery quality from Google's response
    let imageryQuality = 'medium';
    if (googleData.imageryQuality === 'HIGH') imageryQuality = 'high';
    else if (googleData.imageryQuality === 'LOW') imageryQuality = 'low';

    // Format dates from Google's date object format
    const formatGoogleDate = (dateObj) => {
      if (!dateObj?.year) return new Date().toISOString().split('T')[0];
      const year = dateObj.year;
      const month = String(dateObj.month || 1).padStart(2, '0');
      const day = String(dateObj.day || 1).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      imageryDate: formatGoogleDate(googleData.imageryDate),
      imageryProcessedDate: formatGoogleDate(googleData.imageryProcessedDate),
      imageryQuality,
      totalRoofArea: solarPotential.wholeRoofStats?.areaMeters2 ?? 0,
      maxSunshineHours: solarPotential.maxSunshineHoursPerYear ?? 0,
      carbonOffset: solarPotential.carbonOffsetFactorKgPerMwh ?? 0,
      // Include max panel configurations for reference
      maxPanelCount: solarPotential.maxArrayPanelsCount ?? solarPanels.length,
      maxArrayAreaMeters2: solarPotential.maxArrayAreaMeters2 ?? 0,
      segments,
    };
  };

  const handleSegmentToggle = (index) => {
    setSelectedSegments(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      return [...prev, index];
    });
  };

  const handlePropertyConfirm = async (lat, lng) => {
    setManualLocation({ latitude: lat, longitude: lng });
    setShowPropertySelector(false);
    // Re-fetch solar assessment with new coordinates
    await fetchSolarAssessment(lat, lng);
  };

  const checkQualification = () => {
    if (!solarData) return { qualified: false, reason: '' };

    const segments = solarData.segments;
    const selected = selectedSegments.map(i => segments[i]).filter(Boolean);

    // Check total roof area
    if (solarData.totalRoofArea < 10) {
      return { qualified: false, reason: 'Roof area is less than 10m²' };
    }

    // Check for non-north facing segment with pitch >= 15
    const hasQualifyingSegment = selected.some(
      s => !isNorthFacing(s.azimuth) && s.pitch >= 15
    );

    if (!hasQualifyingSegment) {
      return { qualified: false, reason: 'No suitable south-facing roof segments' };
    }

    // Count panels using adjusted counts
    const getPanelCount = (s) => s.adjustedPanelCount ?? s.panelCount ?? 0;
    const totalPanels = selected.reduce((sum, s) => sum + getPanelCount(s), 0);
    const northSegments = selected.filter(s => isNorthFacing(s.azimuth)).length;
    const nonNorthSegments = selected.filter(s => !isNorthFacing(s.azimuth));

    // Option A: 6+ panels on 1 non-north segment
    const hasOptionA = nonNorthSegments.some(s => getPanelCount(s) >= 6);

    // Option B: 4+ panels across 2 segments (max 1 north)
    const hasOptionB = selected.length === 2 && totalPanels >= 4 && northSegments <= 1;

    // Option C: 3+ panels across 3 segments (max 1 north)
    const hasOptionC = selected.length >= 3 && totalPanels >= 3 && northSegments <= 1;

    if (!hasOptionA && !hasOptionB && !hasOptionC) {
      return { qualified: false, reason: 'Insufficient panel capacity' };
    }

    // Check minimum energy (1,200 kWh/year)
    const totalEnergy = selected.reduce((sum, s) => sum + (s.estimatedEnergy ?? 0), 0);
    if (totalEnergy < 1200) {
      return { qualified: false, reason: 'Estimated energy output below minimum threshold' };
    }

    return { qualified: true, reason: '' };
  };

  const proceedWithQualification = () => {
    const { qualified } = checkQualification();

    if (!qualified) {
      // Disqualified - go to confirmation with callback required
      setJourneyStatus('disqualified_solar');
      updateBookingData({
        currentPage: '/confirmation',
        lastAction: 'solar_disqualified',
        lastActionPage: '/solar-assessment',
      });
      navigate('/confirmation');
      return;
    }

    const selected = selectedSegments.map(i => solarData.segments[i]).filter(Boolean);
    const getPanelCount = (s) => s.adjustedPanelCount ?? s.panelCount ?? 0;
    const totalPanelCount = selected.reduce((sum, s) => sum + getPanelCount(s), 0);
    const totalEstimatedEnergy = selected.reduce((sum, s) => sum + (s.estimatedEnergy ?? 0), 0);

    // Calculate usable roof area from selected segments
    const usableRoofArea = selected.reduce((sum, s) => sum + (s.area ?? 0), 0);
    // Carbon offset: energy (kWh) * factor (kg/MWh) / 1000
    const carbonOffsetFactor = solarData.carbonOffset || 400;
    const carbonOffsetKg = Math.round(totalEstimatedEnergy * carbonOffsetFactor / 1000);

    // Use the calculated savings from state
    setSolarAssessmentData({
      roofSegments: solarData.segments,
      selectedSegments,
      totalPanelCount,
      totalEstimatedEnergy,
      estimatedAnnualSavings: estimatedSavings.totalSavings,
      imageryQuality: solarData.imageryQuality,
      imageryDate: solarData.imageryDate,
      imageryProcessedDate: solarData.imageryProcessedDate,
      carbonOffset: carbonOffsetKg,
      solarRoofArea: Math.round(usableRoofArea * 10) / 10,
      sunExposureHours: solarPotential.avgSunHours,
      roofSpaceOver10m2: solarData.totalRoofArea >= 10,
    });

    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'solar-optly-solar-data',
        solarData: {
          total_panel_count: totalPanelCount,
          total_estimated_energy: totalEstimatedEnergy,
          estimated_annual_savings: estimatedSavings.totalSavings,
          solar_roof_area: Math.round(usableRoofArea * 10) / 10,
          sun_exposure_hours: solarPotential.avgSunHours,
          carbon_offset: carbonOffsetKg,
          imagery_quality: solarData.imageryQuality,
          imagery_date: solarData.imageryDate,
          selected_segments_count: selectedSegments.length,
        },
      }, '*');
    }

    updateBookingData({
      currentPage: '/eligibility-questions',
      lastAction: 'solar_assessment_passed',
      lastActionPage: '/solar-assessment',
    });

    navigate('/eligibility-questions');
  };

  const handleContinue = () => {
    proceedWithQualification();
  };

  const handleImageryWarningYes = () => {
    // User says roof has changed - end journey
    notifyParentSolarJourneyFailed('roof_changed_since_imagery');
    setJourneyStatus('callback_required');
    updateBookingData({
      roofChangedSinceImagery: true,
      currentPage: '/confirmation',
      lastAction: 'roof_changed_since_imagery',
      lastActionPage: '/solar-assessment',
    });
    navigate('/confirmation');
  };

  const handleImageryWarningNo = () => {
    setImageryWarningAnswered(true);
    updateBookingData({ roofChangedSinceImagery: false });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <h2 className={styles.loadingTitle}>Analysing your roof</h2>
          <p className={styles.loadingText}>
            We're using satellite imagery to assess your roof's solar potential...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    const isNoCoverage = error.includes('Solar data is not available') || error.includes('coverage');
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2 className={styles.errorTitle}>Unable to assess roof</h2>
          <p className={styles.errorText}>{error}</p>
          {isNoCoverage && (
            <div className={styles.callToConfirm}>
              <p className={styles.callToConfirmText}>
                A member of our team can confirm your location and eligibility. Call us:
              </p>
              <a href="tel:08001123110" className={styles.callToConfirmPhone}>
                0800 112 3110
              </a>
            </div>
          )}
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => fetchSolarAssessment()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const hasNoSolarData = solarData && (!solarData.segments || solarData.segments.length === 0) && !loading;

  if (hasNoSolarData) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Your roof assessment</h1>
        <div className={styles.noSolarDataCard}>
          <p className={styles.noSolarDataText}>
            Solar data isn't available for this property type. We'll need to confirm your location to assess your roof.
          </p>
          <p className={styles.noSolarDataSubtext}>
            A member of our team will be in touch shortly to book an appointment
          </p>
          <a href="tel:08001123110" className={styles.callToConfirmPhone}>
            0800 112 3110
          </a>
          <button
            type="button"
            className={styles.continueButton}
            onClick={() => {
              notifyParentSolarJourneyFailed('solar_no_segments');
              setJourneyStatus('callback_required');
              updateBookingData({
                currentPage: '/confirmation',
                lastAction: 'solar_unavailable_callback',
                lastActionPage: '/solar-assessment',
              });
              navigate('/confirmation');
            }}
          >
            Request callback
          </button>
        </div>
      </div>
    );
  }

  const { qualified, reason } = checkQualification();

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Your roof assessment</h1>

      <p className={styles.description}>
        Select the roof segments where you'd like solar panels installed.
      </p>

      {USE_MOCK_DATA && (
        <div className={styles.uatBanner}>
          UAT Mode: Using mock solar data
        </div>
      )}

      {solarData && (
        <>
          {/* Estimated Annual Savings Header */}
          <div className={styles.savingsHeader}>
            <div className={styles.savingsLabelRow}>
              <span className={styles.savingsLabel}>Est. Annual Savings</span>
              <button
                type="button"
                className={styles.infoButton}
                onClick={() => setShowSavingsTooltip(!showSavingsTooltip)}
                onMouseEnter={() => setShowSavingsTooltip(true)}
                onMouseLeave={() => setShowSavingsTooltip(false)}
                aria-label="More information about savings calculation"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M8 7V11M8 5V5.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              {showSavingsTooltip && (
                <div className={styles.savingsTooltip}>
                  {getSavingsDisclaimer()}
                </div>
              )}
            </div>
            <span className={styles.savingsAmount}>
              {formatSavings(estimatedSavings.totalSavings)}
            </span>
          </div>

          {/* Map visualization */}
          <div className={styles.mapSection}>
            <RoofSegmentMap
              latitude={bookingData.latitude}
              longitude={bookingData.longitude}
              segments={solarData.segments}
              selectedSegments={selectedSegments}
              onSegmentClick={handleSegmentToggle}
            />
          </div>

          {/* Not your property link */}
          <button
            type="button"
            className={styles.wrongPropertyLink}
            onClick={() => setShowPropertySelector(true)}
          >
            Not your property? Click here to select on map
          </button>

          {/* Imagery age warning - always shown until answered */}
          {!imageryWarningAnswered && (
            <ImageryAgeWarning
              formattedDate={formatImageryDateForWarning(
                solarData.imageryDate,
                solarData.imageryProcessedDate
              )}
              onYes={handleImageryWarningYes}
              onNo={handleImageryWarningNo}
            />
          )}

          {/* Estimated Solar Potential Card */}
          <div className={styles.solarPotentialCard}>
            <h3 className={styles.solarPotentialTitle}>Estimated Solar Potential</h3>
            <div className={styles.solarPotentialGrid}>
              <div className={styles.potentialItem}>
                <span className={styles.potentialIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 9L12 2L21 9V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V9Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span className={styles.potentialValue}>{solarPotential.suitableFaces}</span>
                <span className={styles.potentialLabel}>Suitable Faces</span>
              </div>
              <div className={styles.potentialItem}>
                <span className={styles.potentialIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </span>
                <span className={styles.potentialValue}>{solarPotential.maxPanels}</span>
                <span className={styles.potentialLabel}>Max Panels</span>
              </div>
              <div className={styles.potentialItem}>
                <span className={styles.potentialIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4H20V20H4V4Z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M4 4L20 20M20 4L4 20" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </span>
                <span className={styles.potentialValue}>{solarPotential.usableRoofArea}m²</span>
                <span className={styles.potentialLabel}>Usable Roof Area</span>
              </div>
              <div className={styles.potentialItem}>
                <span className={styles.potentialIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M12 2V4M12 20V22M2 12H4M20 12H22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </span>
                <span className={styles.potentialValue}>{solarPotential.avgSunHours}</span>
                <span className={styles.potentialLabel}>Avg Sun Hrs/Yr</span>
              </div>
              <div className={styles.potentialItem}>
                <span className={styles.potentialIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span className={styles.potentialValue}>{solarPotential.systemCapacity}kW</span>
                <span className={styles.potentialLabel}>System Capacity</span>
              </div>
              <div className={styles.potentialItem}>
                <span className={styles.potentialIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 12H18L15 21L9 3L6 12H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span className={styles.potentialValue}>~{solarPotential.yearlyOutput.toLocaleString()}</span>
                <span className={styles.potentialLabel}>kWh/Year Output</span>
              </div>
            </div>
          </div>

          {/* Qualification warning */}
          {!qualified && selectedSegments.length > 0 && (
            <div className={styles.warning}>
              <span className={styles.warningIcon}>&#x26A0;&#xFE0F;</span>
              {reason}
            </div>
          )}

          <button
            type="button"
            className={styles.continueButton}
            onClick={handleContinue}
            disabled={selectedSegments.length === 0}
          >
            Continue
          </button>
        </>
      )}

      {/* Property location selector modal */}
      <PropertyMapSelector
        isOpen={showPropertySelector}
        onClose={() => setShowPropertySelector(false)}
        initialLatitude={bookingData.latitude || 51.5074}
        initialLongitude={bookingData.longitude || -0.1278}
        fullAddress={bookingData.fullAddress}
        onConfirm={handlePropertyConfirm}
      />
    </div>
  );
}
