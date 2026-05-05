import React from 'react';
import { TicketListPageBase } from './tickets/TicketListPageBase';

export function TicketSlaQueuePage() {
  return (
    <TicketListPageBase
      title="SLA At-Risk / Breached"
      subtitle="Prioritize tickets before SLA violations"
      queue="at-risk"
      basePath="/tickets"
    />
  );
}
