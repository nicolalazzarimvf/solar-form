import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { queueFunnelEvent } from './funnelTelemetry';
import { pageViewStep } from './stepLabels';

export function FunnelRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    queueFunnelEvent({
      event_type: 'page_view',
      step: pageViewStep(location.pathname),
      response_summary: `Opened ${location.pathname}`,
      payload: { route: location.pathname, search: location.search || '' },
    });
  }, [location.pathname, location.search]);

  return null;
}
