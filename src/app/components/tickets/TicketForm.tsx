import React from 'react';
import { Ticket, User } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import {
  TICKET_IMPACT_OPTIONS,
  TICKET_PRIORITY_OPTIONS,
  TICKET_SOURCE_OPTIONS,
  TICKET_STATUS_OPTIONS,
  TICKET_URGENCY_OPTIONS,
} from '../../lib/tickets';

export interface TicketFormData {
  title: string;
  description: string;
  address: string;
  soNumber: string;
  category: string;
  subcategory: string;
  priority: Ticket['priority'];
  impact: Ticket['impact'];
  urgency: Ticket['urgency'];
  source: Ticket['source'];
  assignedAgentId: string;
  assignedGroup: string;
  status: Ticket['status'];
  dueDate: string;
}

interface TicketFormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<Ticket>;
  users: User[];
  categories: Array<{ id: string; name: string; subcategories: string[]; isActive: boolean }>;
  teams: string[];
  canManageFields: boolean;
  onSubmit: (data: TicketFormData) => Promise<void>;
  onCancel: () => void;
}

function buildInitialData(initial?: Partial<Ticket>): TicketFormData {
  return {
    title: initial?.title || '',
    description: initial?.description || '',
    address: initial?.address || '',
    soNumber: initial?.soNumber || '',
    category: initial?.category || '',
    subcategory: initial?.subcategory || '',
    priority: initial?.priority || 'Medium',
    impact: initial?.impact || 'Medium',
    urgency: initial?.urgency || 'Medium',
    source: initial?.source || 'Portal',
    assignedAgentId: initial?.assignedAgentId || '',
    assignedGroup: initial?.assignedGroup || '',
    status: initial?.status || 'Open',
    dueDate: initial?.dueDate || '',
  };
}

export function TicketForm({
  mode,
  initialData,
  users,
  categories,
  teams,
  canManageFields,
  onSubmit,
  onCancel,
}: TicketFormProps) {
  const [formData, setFormData] = React.useState<TicketFormData>(buildInitialData(initialData));
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setFormData(buildInitialData(initialData));
  }, [initialData]);

  const activeCategories = React.useMemo(
    () => categories.filter((entry) => entry.isActive !== false),
    [categories],
  );

  const selectedCategory = React.useMemo(
    () => activeCategories.find((entry) => entry.name === formData.category) || null,
    [activeCategories, formData.category],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!formData.title.trim() || !formData.description.trim() || !formData.category.trim()) return;
    setIsSaving(true);
    try {
      await onSubmit({
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        address: formData.address.trim(),
        soNumber: formData.soNumber.trim(),
        category: formData.category.trim(),
        subcategory: formData.subcategory.trim(),
        assignedGroup: formData.assignedGroup.trim(),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="ticket-title">Title</Label>
          <Input
            id="ticket-title"
            value={formData.title}
            onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
            required
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="ticket-description">Description</Label>
          <Textarea
            id="ticket-description"
            rows={5}
            value={formData.description}
            onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ticket-address">Address</Label>
          <Input
            id="ticket-address"
            value={formData.address}
            onChange={(event) => setFormData((prev) => ({ ...prev, address: event.target.value }))}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ticket-so-number">SO#</Label>
          <Input
            id="ticket-so-number"
            value={formData.soNumber}
            onChange={(event) => setFormData((prev) => ({ ...prev, soNumber: event.target.value }))}
            placeholder="Optional"
          />
        </div>

        {activeCategories.length > 0 ? (
          <>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={formData.category || '__none__'}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value === '__none__' ? '' : value, subcategory: '' }))}
              >
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select category</SelectItem>
                  {activeCategories.map((entry) => (
                    <SelectItem key={entry.id} value={entry.name}>{entry.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Subcategory</Label>
              <Select
                value={formData.subcategory || '__none__'}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, subcategory: value === '__none__' ? '' : value }))}
              >
                <SelectTrigger><SelectValue placeholder="Select subcategory" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No subcategory</SelectItem>
                  {(selectedCategory?.subcategories || []).map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-category">Category</Label>
              <Input
                id="ticket-category"
                value={formData.category}
                onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}
                placeholder="Enter category"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-subcategory">Subcategory</Label>
              <Input
                id="ticket-subcategory"
                value={formData.subcategory}
                onChange={(event) => setFormData((prev) => ({ ...prev, subcategory: event.target.value }))}
                placeholder="Optional"
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select
            value={formData.priority}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, priority: value as Ticket['priority'] }))}
            disabled={!canManageFields && mode === 'edit'}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TICKET_PRIORITY_OPTIONS.map((value) => (
                <SelectItem key={value} value={value}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Impact</Label>
          <Select
            value={formData.impact}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, impact: value as Ticket['impact'] }))}
            disabled={!canManageFields && mode === 'edit'}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TICKET_IMPACT_OPTIONS.map((value) => (
                <SelectItem key={value} value={value}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Urgency</Label>
          <Select
            value={formData.urgency}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, urgency: value as Ticket['urgency'] }))}
            disabled={!canManageFields && mode === 'edit'}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TICKET_URGENCY_OPTIONS.map((value) => (
                <SelectItem key={value} value={value}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Source</Label>
          <Select
            value={formData.source}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, source: value as Ticket['source'] }))}
            disabled={mode === 'edit'}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TICKET_SOURCE_OPTIONS.map((value) => (
                <SelectItem key={value} value={value}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mode === 'edit' ? (
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value as Ticket['status'] }))}
              disabled={!canManageFields}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TICKET_STATUS_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label>Assigned Agent</Label>
          <Select
            value={formData.assignedAgentId || '__none__'}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, assignedAgentId: value === '__none__' ? '' : value }))}
            disabled={!canManageFields}
          >
            <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {users.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>{entry.name || entry.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Assigned Group</Label>
          <Select
            value={formData.assignedGroup || '__none__'}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, assignedGroup: value === '__none__' ? '' : value }))}
            disabled={!canManageFields}
          >
            <SelectTrigger><SelectValue placeholder="No group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No group</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team} value={team}>{team}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dueDate">Due Date</Label>
          <Input
            id="dueDate"
            type="date"
            value={formData.dueDate}
            onChange={(event) => setFormData((prev) => ({ ...prev, dueDate: event.target.value }))}
            disabled={!canManageFields}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : mode === 'create' ? 'Create Ticket' : 'Save Ticket'}</Button>
      </div>
    </form>
  );
}
