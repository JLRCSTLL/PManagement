import React from 'react';
import { TicketListPageBase } from './tickets/TicketListPageBase';

export function MyTicketsPage() {
  return (
    <TicketListPageBase
      title="My Tickets"
      subtitle="Tickets you requested or that are assigned to you"
      mineOnly
      basePath="/tickets"
    />
  );
}
