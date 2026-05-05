import React from 'react';
import { TicketListPageBase } from './tickets/TicketListPageBase';

export function TicketQueuePage() {
  return (
    <TicketListPageBase
      title="All Tickets"
      subtitle="Agent and team queue"
      basePath="/tickets"
    />
  );
}
