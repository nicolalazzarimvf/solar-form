import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBooking } from '../contexts';
import { config } from '../config/env';
import { queueFunnelEvent, redactTelemetryObject, STEPS } from '../telemetry';
import styles from './AddressPage.module.css';

// Temporary flag to bypass address lookup API during UAT
const USE_MANUAL_ENTRY = false;

export default function AddressPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { bookingData, setAddressData, updateBookingData } = useBooking();
  const lastAutoLookupPostcodeRef = useRef('');

  const [postcode, setPostcode] = useState(bookingData.postcode || '');
  const [addresses, setAddresses] = useState([]);
  const lastSyncedPrefillRef = useRef(bookingData.postcode || '');

  // Sync postcode only when bookingData.postcode actually changes (e.g. prefill arrives)
  useEffect(() => {
    const prefilled = formatPostcode(bookingData.postcode || '');
    if (prefilled && prefilled !== formatPostcode(lastSyncedPrefillRef.current || '')) {
      lastSyncedPrefillRef.current = bookingData.postcode;
      setPostcode(prefilled);
    }
  }, [bookingData.postcode]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Manual entry fallback state
  const [manualAddress, setManualAddress] = useState('');
  const [manualAddressSelected, setManualAddressSelected] = useState(false);

  const formatPostcode = (value) => {
    // Remove all spaces and convert to uppercase
    return value.replace(/\s/g, '').toUpperCase();
  };

  const handlePostcodeChange = (e) => {
    const formatted = formatPostcode(e.target.value);
    setPostcode(formatted);
    // Reset state when postcode changes
    setAddresses([]);
    setSelectedAddress(null);
    setError('');
    setHasSearched(false);
  };

  const lookupAddresses = useCallback(async () => {
    if (!postcode || postcode.length < 5) {
      setError('Please enter a valid postcode');
      return;
    }

    setIsLoading(true);
    setError('');
    setAddresses([]);
    setSelectedAddress(null);

    try {
      // Use Ideal Postcodes API
      const apiKey = config.idealPostcodesApiKey;

      if (!apiKey || apiKey === 'your_ideal_postcodes_api_key_here') {
        throw new Error('API key not configured');
      }

      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      const response = await fetch(
        `https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(postcode)}?api_key=${apiKey}`
      );

      const data = await response.json();
      const duration_ms = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : null;

      queueFunnelEvent({
        event_type: 'api_call',
        step: STEPS.ADDRESS_IDEAL_LOOKUP,
        response_summary: `Ideal Postcodes: ${response.status}, code ${data?.code}, ${Array.isArray(data?.result) ? data.result.length : 0} addresses, ${duration_ms ?? '?'}ms`,
        payload: redactTelemetryObject({
          api: 'ideal_postcodes_lookup',
          route: '/address',
          request: { postcode },
          response: {
            code: data?.code,
            message: data?.message,
            resultCount: Array.isArray(data?.result) ? data.result.length : 0,
          },
          duration_ms,
        }),
      });

      if (data.code === 2000 && data.result && data.result.length > 0) {
        // Transform the results to a simpler format
        const formattedAddresses = data.result.map((addr, index) => ({
          id: index,
          line1: addr.line_1,
          line2: addr.line_2,
          line3: addr.line_3,
          postTown: addr.post_town,
          county: addr.county,
          postcode: addr.postcode,
          latitude: addr.latitude,
          longitude: addr.longitude,
          fullAddress: [
            addr.line_1,
            addr.line_2,
            addr.line_3,
            addr.post_town,
            addr.county,
            addr.postcode,
          ].filter(Boolean).join(', '),
        }));

        setAddresses(formattedAddresses);
      } else if (data.code === 4040) {
        setError('No addresses found for this postcode. Please check and try again.');
      } else {
        throw new Error(data.message || 'Failed to lookup addresses');
      }
    } catch (err) {
      console.error('Address lookup error:', err);
      queueFunnelEvent({
        event_type: 'api_call',
        step: STEPS.ADDRESS_IDEAL_LOOKUP,
        response_summary: `Ideal Postcodes failed: ${err?.message || 'unknown'}`,
        payload: {
          api: 'ideal_postcodes_lookup',
          route: '/address',
          request: { postcode },
          error: String(err?.message || err),
        },
      });
      setError('Unable to lookup addresses. Please try again or enter manually.');
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  }, [postcode]);

  useEffect(() => {
    if (USE_MANUAL_ENTRY) return;
    if (isLoading) return;
    if (addresses.length > 0) return;
    if (postcode.length < 5) return;

    const prefilledPostcode = formatPostcode(bookingData.postcode || '');
    if (!prefilledPostcode || prefilledPostcode !== postcode) return;
    if (lastAutoLookupPostcodeRef.current === postcode) return;

    lastAutoLookupPostcodeRef.current = postcode;
    lookupAddresses();
  }, [bookingData.postcode, postcode, isLoading, addresses.length, lookupAddresses]);

  const handleAddressSelect = (e) => {
    const addressId = parseInt(e.target.value, 10);
    const address = addresses.find(a => a.id === addressId);
    setSelectedAddress(address || null);
  };

  const handleManualAddressChange = (e) => {
    setManualAddress(e.target.value);
  };

  const handleUseManualAddress = () => {
    if (!postcode || !manualAddress) return;

    // Use mock coordinates for manual entry (central London as fallback)
    const mockCoordinates = {
      latitude: 51.5074,
      longitude: -0.1278,
    };

    setAddressData({
      postcode,
      fullAddress: `${manualAddress}, ${postcode}`,
      latitude: mockCoordinates.latitude,
      longitude: mockCoordinates.longitude,
    });
    setManualAddressSelected(true);
  };

  const handleContinue = () => {
    if (USE_MANUAL_ENTRY) {
      if (!manualAddressSelected) return;
    } else {
      if (!selectedAddress) return;

      console.log('[AddressPage] handleContinue: setting address data', {
        postcode: selectedAddress.postcode,
        latitude: selectedAddress.latitude,
        longitude: selectedAddress.longitude,
        fullAddress: selectedAddress.fullAddress,
      });

      setAddressData({
        postcode: selectedAddress.postcode,
        fullAddress: selectedAddress.fullAddress,
        latitude: selectedAddress.latitude,
        longitude: selectedAddress.longitude,
      });
    }

    const confirmedAddress = USE_MANUAL_ENTRY
      ? (manualAddress ? `${manualAddress}, ${postcode}` : '')
      : (selectedAddress?.fullAddress || '');

    const confirmedPostcode = USE_MANUAL_ENTRY ? postcode : (selectedAddress?.postcode || postcode);
    if (confirmedAddress && window.parent !== window) {
      window.parent.postMessage({
        type: 'solar-optly-address',
        address: confirmedAddress,
        postcode: confirmedPostcode,
      }, '*');
    }

    updateBookingData({
      currentPage: '/solar-assessment',
      lastAction: 'address_confirmed',
      lastActionPage: '/address',
    });

    queueFunnelEvent({
      event_type: 'user_action',
      step: STEPS.ADDRESS_CONFIRMED,
      response_summary: USE_MANUAL_ENTRY
        ? 'Address confirmed (manual entry)'
        : 'Address confirmed from list — lat/lng saved',
      payload: {
        route: '/address',
        postcode: confirmedPostcode,
        manual: Boolean(USE_MANUAL_ENTRY),
      },
    });

    const addr = USE_MANUAL_ENTRY ? null : selectedAddress;
    console.log('[AddressPage] navigating to /solar-assessment');
    navigate(
      { pathname: '/solar-assessment', search: location.search },
      {
        state: addr ? {
          latitude: addr.latitude,
          longitude: addr.longitude,
          postcode: addr.postcode,
          fullAddress: addr.fullAddress,
        } : undefined,
      }
    );
  };

  const isFormValid = USE_MANUAL_ENTRY
    ? manualAddressSelected
    : selectedAddress !== null;

  // Render manual entry mode
  if (USE_MANUAL_ENTRY) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Confirm your address</h1>

        <p className={styles.description}>
          We'll use your address to assess your roof's solar potential using satellite imagery.
        </p>

        <div className={styles.uatBanner}>
          UAT Mode: Manual address entry enabled
        </div>

        <div className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="postcode">
              Postcode
            </label>
            <input
              id="postcode"
              type="text"
              className={styles.input}
              value={postcode}
              onChange={(e) => setPostcode(formatPostcode(e.target.value))}
              placeholder="e.g. SW1A 1AA"
              maxLength={8}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="address">
              Address
            </label>
            <input
              id="address"
              type="text"
              className={styles.input}
              value={manualAddress}
              onChange={handleManualAddressChange}
              placeholder="e.g. 10 Downing Street, London"
            />
          </div>

          {!manualAddressSelected && (
            <button
              type="button"
              className={styles.useAddressButton}
              onClick={handleUseManualAddress}
              disabled={postcode.length < 5 || manualAddress.length < 5}
            >
              Use this address
            </button>
          )}

          {manualAddressSelected && (
            <div className={styles.selectedAddress}>
              <span className={styles.selectedLabel}>Selected address:</span>
              <span className={styles.selectedValue}>
                {manualAddress}, {postcode}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          className={styles.continueButton}
          onClick={handleContinue}
          disabled={!isFormValid}
        >
          Continue
        </button>
      </div>
    );
  }

  // Render API lookup mode
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Confirm your address</h1>

      <p className={styles.description}>
        We'll use your address to assess your roof's solar potential using satellite imagery.
      </p>

      <div className={styles.form}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="postcode">
            Postcode
          </label>
          <div className={styles.postcodeRow}>
            <input
              id="postcode"
              type="text"
              className={styles.input}
              value={postcode}
              onChange={handlePostcodeChange}
              placeholder="e.g. SW1A1AA"
              maxLength={8}
            />
            <button
              type="button"
              className={styles.lookupButton}
              onClick={lookupAddresses}
              disabled={isLoading || postcode.length < 5}
            >
              {isLoading ? 'Looking up...' : 'Find address'}
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {addresses.length > 0 && (
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="address-select">
              Select your address
            </label>
            <select
              id="address-select"
              className={`${styles.select} ${styles.selectScrollable}`}
              value={selectedAddress?.id ?? ''}
              onChange={handleAddressSelect}
              size={Math.min(6, Math.max(addresses.length, 2))}
            >
              <option value="">-- Select an address --</option>
              {addresses.map((addr) => (
                <option key={addr.id} value={addr.id}>
                  {addr.fullAddress}
                </option>
              ))}
            </select>
          </div>
        )}

        {hasSearched && addresses.length === 0 && !error && (
          <div className={styles.noResults}>
            No addresses found. Please check your postcode.
          </div>
        )}

        {selectedAddress && (
          <div className={styles.selectedAddress}>
            <span className={styles.selectedLabel}>Selected address:</span>
            <span className={styles.selectedValue}>
              {selectedAddress.fullAddress}
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        className={styles.continueButton}
        onClick={handleContinue}
        disabled={!isFormValid}
      >
        Continue
      </button>
    </div>
  );
}
