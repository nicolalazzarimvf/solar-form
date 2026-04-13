import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { queueFunnelEvent } from './funnelTelemetry';

export function FunnelRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    queueFunnelEvent({
      event_type: 'page_view',
      step: location.pathname,
      response_summary: null,
      payload: { search: location.search || '' },
    });
  }, [location.pathname, location.search]);

  return null;
}
