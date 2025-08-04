/**
 * Tests for centralized status utilities
 */
import {
  getEffectiveStatus,
  getStatusBadgeClass,
  getStatusIconClass,
  getStatusLabel,
  getStatusIconName,
  isActiveStatus,
  isFinalStatus,
  getWorkshopProgress,
  needsCleanup,
  sortByStatusPriority
} from '../statusUtils';
import { WorkshopSummary } from '../../types/schemas';

describe('statusUtils', () => {
  describe('getEffectiveStatus', () => {
    it('should return database status for non-planning workshops', () => {
      const workshop: WorkshopSummary = {
        id: '1',
        name: 'Test Workshop',
        status: 'active',
        attendee_count: 5,
        active_attendees: 3,
        start_date: '2025-01-01',
        end_date: '2025-01-02',
        created_at: '2025-01-01'
      };

      expect(getEffectiveStatus(workshop)).toBe('active');
    });

    it('should calculate effective status for planning workshops with all attendees deployed', () => {
      const workshop: WorkshopSummary = {
        id: '1',
        name: 'Test Workshop',
        status: 'planning',
        attendee_count: 5,
        active_attendees: 5,
        start_date: '2025-01-01',
        end_date: '2025-01-02',
        created_at: '2025-01-01'
      };

      expect(getEffectiveStatus(workshop)).toBe('active');
    });

    it('should calculate effective status for planning workshops with partial deployment', () => {
      const workshop: WorkshopSummary = {
        id: '1',
        name: 'Test Workshop',
        status: 'planning',
        attendee_count: 5,
        active_attendees: 3,
        start_date: '2025-01-01',
        end_date: '2025-01-02',
        created_at: '2025-01-01'
      };

      expect(getEffectiveStatus(workshop)).toBe('deploying');
    });

    it('should return planning for workshops with no deployed attendees', () => {
      const workshop: WorkshopSummary = {
        id: '1',
        name: 'Test Workshop',
        status: 'planning',
        attendee_count: 5,
        active_attendees: 0,
        start_date: '2025-01-01',
        end_date: '2025-01-02',
        created_at: '2025-01-01'
      };

      expect(getEffectiveStatus(workshop)).toBe('planning');
    });

    it('should return planning for workshops with no attendees', () => {
      const workshop: WorkshopSummary = {
        id: '1',
        name: 'Test Workshop',
        status: 'planning',
        attendee_count: 0,
        active_attendees: 0,
        start_date: '2025-01-01',
        end_date: '2025-01-02',
        created_at: '2025-01-01'
      };

      expect(getEffectiveStatus(workshop)).toBe('planning');
    });
  });

  describe('getStatusBadgeClass', () => {
    it('should return correct classes for all status types', () => {
      const statuses = ['active', 'deploying', 'failed', 'completed', 'deleting', 'queued', 'maintenance', 'suspended', 'planning'];
      
      statuses.forEach(status => {
        const classes = getStatusBadgeClass(status);
        expect(classes).toContain('inline-flex');
        expect(classes).toContain('items-center');
        expect(classes).toContain('px-2.5');
        expect(classes).toContain('py-0.5');
        expect(classes).toContain('rounded-full');
      });
    });

    it('should include dark mode classes', () => {
      const activeClasses = getStatusBadgeClass('active');
      expect(activeClasses).toContain('dark:bg-success-900');
      expect(activeClasses).toContain('dark:text-success-200');
    });

    it('should fallback to gray for unknown status', () => {
      const classes = getStatusBadgeClass('unknown');
      expect(classes).toContain('bg-gray-100');
      expect(classes).toContain('text-gray-800');
    });
  });

  describe('getStatusIconClass', () => {
    it('should return spinning animation for deploying and deleting', () => {
      expect(getStatusIconClass('deploying')).toContain('animate-spin');
      expect(getStatusIconClass('deleting')).toContain('animate-spin');
    });

    it('should return correct colors for different statuses', () => {
      expect(getStatusIconClass('active')).toContain('text-success-500');
      expect(getStatusIconClass('failed')).toContain('text-danger-500');
      expect(getStatusIconClass('completed')).toContain('text-primary-500');
    });
  });

  describe('getStatusLabel', () => {
    it('should return proper labels for all statuses', () => {
      expect(getStatusLabel('active')).toBe('Active');
      expect(getStatusLabel('deploying')).toBe('Deploying');
      expect(getStatusLabel('failed')).toBe('Failed');
      expect(getStatusLabel('completed')).toBe('Completed');
      expect(getStatusLabel('deleting')).toBe('Deleting');
      expect(getStatusLabel('queued')).toBe('Queued');
      expect(getStatusLabel('maintenance')).toBe('Maintenance');
      expect(getStatusLabel('suspended')).toBe('Suspended');
      expect(getStatusLabel('planning')).toBe('Planning');
    });

    it('should capitalize unknown statuses', () => {
      expect(getStatusLabel('custom')).toBe('Custom');
    });
  });

  describe('getStatusIconName', () => {
    it('should return appropriate icon names for different statuses', () => {
      expect(getStatusIconName('active')).toBe('CheckCircleIcon');
      expect(getStatusIconName('deploying')).toBe('ClockIcon');
      expect(getStatusIconName('failed')).toBe('ExclamationTriangleIcon');
      expect(getStatusIconName('completed')).toBe('CheckBadgeIcon');
      expect(getStatusIconName('deleting')).toBe('TrashIcon');
      expect(getStatusIconName('queued')).toBe('QueueListIcon');
      expect(getStatusIconName('maintenance')).toBe('WrenchScrewdriverIcon');
      expect(getStatusIconName('suspended')).toBe('PauseIcon');
      expect(getStatusIconName('planning')).toBe('DocumentIcon');
    });

    it('should fallback to ClockIcon for unknown statuses', () => {
      expect(getStatusIconName('unknown')).toBe('ClockIcon');
    });
  });

  describe('isActiveStatus', () => {
    it('should identify active statuses correctly', () => {
      expect(isActiveStatus('active')).toBe(true);
      expect(isActiveStatus('deploying')).toBe(true);
      expect(isActiveStatus('deleting')).toBe(true);
      expect(isActiveStatus('queued')).toBe(true);
      
      expect(isActiveStatus('completed')).toBe(false);
      expect(isActiveStatus('failed')).toBe(false);
      expect(isActiveStatus('planning')).toBe(false);
    });
  });

  describe('isFinalStatus', () => {
    it('should identify final statuses correctly', () => {
      expect(isFinalStatus('completed')).toBe(true);
      expect(isFinalStatus('failed')).toBe(true);
      expect(isFinalStatus('deleted')).toBe(true);
      
      expect(isFinalStatus('active')).toBe(false);
      expect(isFinalStatus('deploying')).toBe(false);
      expect(isFinalStatus('planning')).toBe(false);
    });
  });

  describe('getWorkshopProgress', () => {
    it('should calculate progress for workshop with attendees', () => {
      const workshop: WorkshopSummary = {
        id: '1',
        name: 'Test Workshop',
        status: 'planning',
        attendee_count: 10,
        active_attendees: 6,
        start_date: '2025-01-01',
        end_date: '2025-01-02',
        created_at: '2025-01-01'
      };

      const progress = getWorkshopProgress(workshop);
      expect(progress.percentage).toBe(60);
      expect(progress.completedCount).toBe(6);
      expect(progress.totalCount).toBe(10);
      expect(progress.description).toBe('6 of 10 attendees deployed');
    });

    it('should handle workshop with no attendees', () => {
      const workshop: WorkshopSummary = {
        id: '1',
        name: 'Test Workshop',
        status: 'planning',
        attendee_count: 0,
        active_attendees: 0,
        start_date: '2025-01-01',
        end_date: '2025-01-02',
        created_at: '2025-01-01'
      };

      const progress = getWorkshopProgress(workshop);
      expect(progress.percentage).toBe(100);
      expect(progress.completedCount).toBe(0);
      expect(progress.totalCount).toBe(0);
      expect(progress.description).toBe('No attendees to deploy');
    });

    it('should handle fully deployed workshop', () => {
      const workshop: WorkshopSummary = {
        id: '1',
        name: 'Test Workshop',
        status: 'planning',
        attendee_count: 5,
        active_attendees: 5,
        start_date: '2025-01-01',
        end_date: '2025-01-02',
        created_at: '2025-01-01'
      };

      const progress = getWorkshopProgress(workshop);
      expect(progress.percentage).toBe(100);
      expect(progress.description).toBe('All 5 attendees deployed');
    });
  });

  describe('needsCleanup', () => {
    it('should return true for active workshop with active attendees', () => {
      const workshop: WorkshopSummary = {
        id: '1',
        name: 'Test Workshop',
        status: 'active',
        attendee_count: 5,
        active_attendees: 3,
        start_date: '2025-01-01',
        end_date: '2025-01-02',
        created_at: '2025-01-01'
      };

      expect(needsCleanup(workshop)).toBe(true);
    });

    it('should return false for active workshop with no active attendees', () => {
      const workshop: WorkshopSummary = {
        id: '1',
        name: 'Test Workshop',
        status: 'active',
        attendee_count: 5,
        active_attendees: 0,
        start_date: '2025-01-01',
        end_date: '2025-01-02',
        created_at: '2025-01-01'
      };

      expect(needsCleanup(workshop)).toBe(false);
    });

    it('should return false for planning workshop', () => {
      const workshop: WorkshopSummary = {
        id: '1',
        name: 'Test Workshop',
        status: 'planning',
        attendee_count: 5,
        active_attendees: 0,
        start_date: '2025-01-01',
        end_date: '2025-01-02',
        created_at: '2025-01-01'
      };

      expect(needsCleanup(workshop)).toBe(false);
    });
  });

  describe('sortByStatusPriority', () => {
    it('should sort workshops by status priority', () => {
      const workshops: WorkshopSummary[] = [
        {
          id: '1',
          name: 'Planning Workshop',
          status: 'planning',
          attendee_count: 0,
          active_attendees: 0,
          start_date: '2025-01-01',
          end_date: '2025-01-02',
          created_at: '2025-01-01'
        },
        {
          id: '2',
          name: 'Failed Workshop',
          status: 'failed',
          attendee_count: 5,
          active_attendees: 2,
          start_date: '2025-01-01',
          end_date: '2025-01-02',
          created_at: '2025-01-01'
        },
        {
          id: '3',
          name: 'Active Workshop',
          status: 'active',
          attendee_count: 3,
          active_attendees: 3,
          start_date: '2025-01-01',
          end_date: '2025-01-02',
          created_at: '2025-01-01'
        }
      ];

      const sorted = sortByStatusPriority(workshops);
      expect(sorted[0].status).toBe('failed');  // Highest priority
      expect(sorted[1].status).toBe('active');  // Second priority
      expect(sorted[2].status).toBe('planning'); // Lowest priority
    });

    it('should not mutate original array', () => {
      const workshops: WorkshopSummary[] = [
        {
          id: '1',
          name: 'Workshop 1',
          status: 'planning',
          attendee_count: 0,
          active_attendees: 0,
          start_date: '2025-01-01',
          end_date: '2025-01-02',
          created_at: '2025-01-01'
        },
        {
          id: '2',
          name: 'Workshop 2',
          status: 'active',
          attendee_count: 3,
          active_attendees: 3,
          start_date: '2025-01-01',
          end_date: '2025-01-02',
          created_at: '2025-01-01'
        }
      ];

      const originalOrder = workshops.map(w => w.id);
      const sorted = sortByStatusPriority(workshops);
      
      expect(workshops.map(w => w.id)).toEqual(originalOrder);
      expect(sorted).not.toBe(workshops);
    });
  });
});