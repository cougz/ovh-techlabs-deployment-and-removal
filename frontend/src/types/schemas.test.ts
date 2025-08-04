import { describe, it, expect } from '@jest/globals';
import { 
  WorkshopSchema, 
  AttendeeSchema, 
  LoginRequestSchema,
  CreateWorkshopRequestSchema 
} from './schemas';

describe('API Schema Validation', () => {
  describe('WorkshopSchema', () => {
    it('should validate a complete workshop object', () => {
      const validWorkshop = {
        id: 'workshop-123',
        name: 'Test Workshop',
        description: 'A test workshop',
        start_date: '2025-01-01T09:00:00Z',
        end_date: '2025-01-01T17:00:00Z',
        status: 'planning' as const,
        created_at: '2025-01-01T08:00:00Z',
        updated_at: '2025-01-01T08:00:00Z',
      };

      const result = WorkshopSchema.safeParse(validWorkshop);
      expect(result.success).toBe(true);
    });

    it('should reject workshop with invalid status', () => {
      const invalidWorkshop = {
        id: 'workshop-123',
        name: 'Test Workshop',
        start_date: '2025-01-01T09:00:00Z',
        end_date: '2025-01-01T17:00:00Z',
        status: 'invalid-status',
        created_at: '2025-01-01T08:00:00Z',
        updated_at: '2025-01-01T08:00:00Z',
      };

      const result = WorkshopSchema.safeParse(invalidWorkshop);
      expect(result.success).toBe(false);
    });

    it('should reject workshop with missing required fields', () => {
      const incompleteWorkshop = {
        id: 'workshop-123',
        name: 'Test Workshop',
      };

      const result = WorkshopSchema.safeParse(incompleteWorkshop);
      expect(result.success).toBe(false);
    });
  });

  describe('AttendeeSchema', () => {
    it('should validate a complete attendee object', () => {
      const validAttendee = {
        id: 'attendee-123',
        workshop_id: 'workshop-123',
        username: 'testuser',
        email: 'test@example.com',
        status: 'planning' as const,
        created_at: '2025-01-01T08:00:00Z',
        updated_at: '2025-01-01T08:00:00Z',
      };

      const result = AttendeeSchema.safeParse(validAttendee);
      expect(result.success).toBe(true);
    });

    it('should reject attendee with invalid email', () => {
      const invalidAttendee = {
        id: 'attendee-123',
        workshop_id: 'workshop-123',
        username: 'testuser',
        email: 'invalid-email',
        status: 'planning' as const,
        created_at: '2025-01-01T08:00:00Z',
        updated_at: '2025-01-01T08:00:00Z',
      };

      const result = AttendeeSchema.safeParse(invalidAttendee);
      expect(result.success).toBe(false);
    });
  });

  describe('LoginRequestSchema', () => {
    it('should validate valid login credentials', () => {
      const validLogin = {
        username: 'admin',
        password: 'secretpassword',
      };

      const result = LoginRequestSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
    });

    it('should reject login with empty username', () => {
      const invalidLogin = {
        username: '',
        password: 'secretpassword',
      };

      const result = LoginRequestSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });

    it('should reject login with empty password', () => {
      const invalidLogin = {
        username: 'admin',
        password: '',
      };

      const result = LoginRequestSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });
  });

  describe('CreateWorkshopRequestSchema', () => {
    it('should validate valid workshop creation request', () => {
      const validRequest = {
        name: 'New Workshop',
        description: 'Workshop description',
        start_date: '2025-01-01T09:00:00Z',
        end_date: '2025-01-01T17:00:00Z',
      };

      const result = CreateWorkshopRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should allow optional description', () => {
      const validRequest = {
        name: 'New Workshop',
        start_date: '2025-01-01T09:00:00Z',
        end_date: '2025-01-01T17:00:00Z',
      };

      const result = CreateWorkshopRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should reject request with invalid date format', () => {
      const invalidRequest = {
        name: 'New Workshop',
        start_date: 'invalid-date',
        end_date: '2025-01-01T17:00:00Z',
      };

      const result = CreateWorkshopRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });
});