import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BookingProvider, useBooking } from '../../contexts/BookingContext';

describe('BookingContext', () => {
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
      result.current.confirmBooking('PS-2024-001234');
    });

    expect(result.current.bookingData.bookingReference).toBe('PS-2024-001234');
    expect(result.current.bookingData.journeyStatus).toBe('booking_confirmed');
  });

  it('throws error when used outside provider', () => {
    expect(() => {
      renderHook(() => useBooking());
    }).toThrow('useBooking must be used within a BookingProvider');
  });
});
