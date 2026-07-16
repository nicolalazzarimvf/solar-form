import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  BookingProvider,
  useBooking,
  shouldHardLock,
} from '../../contexts/BookingContext';

describe('BookingContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.name = '';
  });

  const wrapper = ({ children }) => (
    <BookingProvider>{children}</BookingProvider>
  );

  it('provides initial booking data', () => {
    const { result } = renderHook(() => useBooking(), { wrapper });

    expect(result.current.bookingData).toBeDefined();
    expect(result.current.bookingData.firstName).toBe('');
    expect(result.current.bookingData.sessionId).toBeTruthy();
    expect(result.current.bookingData.journeyStatus).toBe('started');
  });

  it('initializes session with sessionId and timestamp', () => {
    const { result } = renderHook(() => useBooking(), { wrapper });

    act(() => {
      result.current.initializeSession();
    });

    expect(result.current.bookingData.sessionId).toBeTruthy();
    expect(result.current.bookingData.journeyStartTime).toBeTruthy();
  });

  it('updates user data correctly', () => {
    const { result } = renderHook(() => useBooking(), { wrapper });

    const userData = {
      firstName: 'John',
      lastName: 'Doe',
      postcode: 'SW1A 1AA',
      phoneNumber: '07700900000',
      emailAddress: 'john@example.com',
    };

    act(() => {
      result.current.setUserData(userData);
    });

    expect(result.current.bookingData.firstName).toBe('John');
    expect(result.current.bookingData.lastName).toBe('Doe');
    expect(result.current.bookingData.postcode).toBe('SW1A 1AA');
    expect(result.current.bookingData.phoneNumber).toBe('07700900000');
    expect(result.current.bookingData.emailAddress).toBe('john@example.com');
  });

  it('updates address data correctly', () => {
    const { result } = renderHook(() => useBooking(), { wrapper });

    const addressData = {
      fullAddress: '10 Downing Street, London, SW1A 2AA',
      latitude: 51.5034,
      longitude: -0.1276,
    };

    act(() => {
      result.current.setAddressData(addressData);
    });

    expect(result.current.bookingData.fullAddress).toBe('10 Downing Street, London, SW1A 2AA');
    expect(result.current.bookingData.latitude).toBe(51.5034);
    expect(result.current.bookingData.longitude).toBe(-0.1276);
    expect(result.current.bookingData.lastAction).toBe('address_selected');
  });

  it('updates eligibility data correctly', () => {
    const { result } = renderHook(() => useBooking(), { wrapper });

    const eligibilityData = {
      isOver75: false,
      roofWorksPlanned: false,
      incomeOver15k: true,
      likelyToPassCreditCheck: true,
    };

    act(() => {
      result.current.setEligibilityData(eligibilityData);
    });

    expect(result.current.bookingData.isOver75).toBe(false);
    expect(result.current.bookingData.roofWorksPlanned).toBe(false);
    expect(result.current.bookingData.incomeOver15k).toBe(true);
    expect(result.current.bookingData.likelyToPassCreditCheck).toBe(true);
  });

  it('confirms booking with reference', () => {
    const { result } = renderHook(() => useBooking(), { wrapper });

    act(() => {
      result.current.updateBookingData({ submissionId: 'sub-1' });
    });

    act(() => {
      result.current.confirmBooking('PS-2024-001234');
    });

    expect(result.current.bookingData.bookingReference).toBe('PS-2024-001234');
    expect(result.current.bookingData.journeyStatus).toBe('booking_confirmed');
    expect(result.current.bookingData.lockedSubmissionId).toBe('sub-1');
  });

  it('resetForNewSubmission clears stale terminal state', () => {
    const { result } = renderHook(() => useBooking(), { wrapper });

    act(() => {
      result.current.updateBookingData({
        submissionId: 'old-sub',
        journeyStatus: 'session_expired',
        lockedSubmissionId: 'old-sub',
        firstName: 'Stale',
      });
    });

    act(() => {
      result.current.resetForNewSubmission({
        submissionId: 'new-sub',
        userData: {
          firstName: 'Fresh',
          lastName: 'User',
          postcode: 'SW1A 1AA',
          phoneNumber: '07700900000',
          emailAddress: 'fresh@example.com',
        },
      });
    });

    expect(result.current.bookingData.submissionId).toBe('new-sub');
    expect(result.current.bookingData.journeyStatus).toBe('started');
    expect(result.current.bookingData.lockedSubmissionId).toBe('');
    expect(result.current.bookingData.firstName).toBe('Fresh');
    expect(
      shouldHardLock(
        result.current.bookingData.journeyStatus,
        result.current.bookingData.submissionId,
        result.current.bookingData.lockedSubmissionId
      )
    ).toBe(false);
  });

  it('setJourneyStatus records lockedSubmissionId for session_expired', () => {
    const { result } = renderHook(() => useBooking(), { wrapper });

    act(() => {
      result.current.updateBookingData({ submissionId: 'sub-99' });
    });

    act(() => {
      result.current.setJourneyStatus('session_expired');
    });

    expect(result.current.bookingData.journeyStatus).toBe('session_expired');
    expect(result.current.bookingData.lockedSubmissionId).toBe('sub-99');
    expect(
      shouldHardLock(
        result.current.bookingData.journeyStatus,
        result.current.bookingData.submissionId,
        result.current.bookingData.lockedSubmissionId
      )
    ).toBe(true);
  });

  it('throws error when used outside provider', () => {
    expect(() => {
      renderHook(() => useBooking());
    }).toThrow('useBooking must be used within a BookingProvider');
  });
});
