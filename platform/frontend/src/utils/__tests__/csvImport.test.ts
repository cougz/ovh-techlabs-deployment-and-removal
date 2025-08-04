import { parseCsvAttendees, validateAttendeeData, CsvAttendeeData } from '../csvImport';

describe('csvImport utilities', () => {
  describe('parseCsvAttendees', () => {
    it('should parse valid CSV data', () => {
      const csvText = 'john-doe,john@example.com\njane-smith,jane@example.com';
      const result = parseCsvAttendees(csvText);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toEqual({
          username: 'john-doe',
          email: 'john@example.com',
          lineNumber: 1
        });
        expect(result.data[1]).toEqual({
          username: 'jane-smith',
          email: 'jane@example.com',
          lineNumber: 2
        });
      }
    });

    it('should handle empty lines', () => {
      const csvText = 'john-doe,john@example.com\n\njane-smith,jane@example.com\n';
      const result = parseCsvAttendees(csvText);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].lineNumber).toBe(1);
        expect(result.data[1].lineNumber).toBe(3);
      }
    });

    it('should return error for missing email', () => {
      const csvText = 'john-doe';
      const result = parseCsvAttendees(csvText);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          lineNumber: 1,
          message: 'Missing email address',
          line: 'john-doe'
        });
      }
    });

    it('should return error for missing username', () => {
      const csvText = ',john@example.com';
      const result = parseCsvAttendees(csvText);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          lineNumber: 1,
          message: 'Missing username',
          line: ',john@example.com'
        });
      }
    });

    it('should return error for missing email after comma', () => {
      const csvText = 'john-doe,';
      const result = parseCsvAttendees(csvText);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          lineNumber: 1,
          message: 'Missing email address',
          line: 'john-doe,'
        });
      }
    });

    it('should handle multiple errors', () => {
      const csvText = 'john-doe\n,jane@example.com\nbob-smith,';
      const result = parseCsvAttendees(csvText);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(3);
        expect(result.errors[0].message).toBe('Missing email address');
        expect(result.errors[1].message).toBe('Missing username');
        expect(result.errors[2].message).toBe('Missing email address');
      }
    });

    it('should handle empty string', () => {
      const result = parseCsvAttendees('');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should handle whitespace-only input', () => {
      const result = parseCsvAttendees('   \n  \n   ');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should trim whitespace from username and email', () => {
      const csvText = '  john-doe  ,  john@example.com  ';
      const result = parseCsvAttendees(csvText);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].username).toBe('john-doe');
        expect(result.data[0].email).toBe('john@example.com');
      }
    });
  });

  describe('validateAttendeeData', () => {
    const createAttendee = (overrides: Partial<CsvAttendeeData> = {}): CsvAttendeeData => ({
      username: 'john-doe',
      email: 'john@example.com',
      lineNumber: 1,
      ...overrides
    });

    it('should validate valid attendee data', () => {
      const attendees = [
        createAttendee({ username: 'john-doe', email: 'john@example.com', lineNumber: 1 }),
        createAttendee({ username: 'jane-smith', email: 'jane@example.com', lineNumber: 2 })
      ];
      
      const result = validateAttendeeData(attendees);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(attendees);
      }
    });

    it('should return error for username too short', () => {
      const attendees = [createAttendee({ username: 'a' })];
      
      const result = validateAttendeeData(attendees);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          lineNumber: 1,
          message: 'Username must be at least 2 characters long',
          field: 'username',
          value: 'a'
        });
      }
    });

    it('should return error for username too long', () => {
      const longUsername = 'a'.repeat(51);
      const attendees = [createAttendee({ username: longUsername })];
      
      const result = validateAttendeeData(attendees);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          lineNumber: 1,
          message: 'Username must be less than 50 characters',
          field: 'username',
          value: longUsername
        });
      }
    });

    it('should return error for invalid email format', () => {
      const invalidEmail = 'not-an-email';
      const attendees = [createAttendee({ email: invalidEmail })];
      
      const result = validateAttendeeData(attendees);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          lineNumber: 1,
          message: 'Invalid email format',
          field: 'email',
          value: invalidEmail
        });
      }
    });

    it('should return error for duplicate username', () => {
      const attendees = [
        createAttendee({ username: 'john-doe', email: 'john1@example.com', lineNumber: 1 }),
        createAttendee({ username: 'john-doe', email: 'john2@example.com', lineNumber: 3 })
      ];
      
      const result = validateAttendeeData(attendees);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          lineNumber: 3,
          message: 'Username already exists in the list (first seen on line 1)',
          field: 'username',
          value: 'john-doe'
        });
      }
    });

    it('should return error for duplicate email', () => {
      const attendees = [
        createAttendee({ email: 'john@example.com', lineNumber: 1 }),
        createAttendee({ username: 'jane-doe', email: 'john@example.com', lineNumber: 2 })
      ];
      
      const result = validateAttendeeData(attendees);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          lineNumber: 2,
          message: 'Email already exists in the list (first seen on line 1)',
          field: 'email',
          value: 'john@example.com'
        });
      }
    });

    it('should handle multiple validation errors', () => {
      const attendees = [
        createAttendee({ username: 'a', email: 'invalid-email', lineNumber: 1 }),
        createAttendee({ username: 'b'.repeat(51), lineNumber: 2 })
      ];
      
      const result = validateAttendeeData(attendees);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(3);
        expect(result.errors.find(e => e.message.includes('Username must be at least 2 characters'))).toBeTruthy();
        expect(result.errors.find(e => e.message.includes('Invalid email format'))).toBeTruthy();
        expect(result.errors.find(e => e.message.includes('Username must be less than 50 characters'))).toBeTruthy();
      }
    });

    it('should return error for username with dots', () => {
      const attendees = [createAttendee({ username: 'max.mustermann' })];
      
      const result = validateAttendeeData(attendees);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          lineNumber: 1,
          message: 'Username cannot contain dots (.) - use dashes (-) instead',
          field: 'username',
          value: 'max.mustermann'
        });
      }
    });

    it('should return error for username with spaces', () => {
      const attendees = [createAttendee({ username: 'max mustermann' })];
      
      const result = validateAttendeeData(attendees);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          lineNumber: 1,
          message: 'Username cannot contain spaces - use dashes (-) instead',
          field: 'username',
          value: 'max mustermann'
        });
      }
    });

    it('should return error for username with @ symbols', () => {
      const attendees = [createAttendee({ username: 'max@company' })];
      
      const result = validateAttendeeData(attendees);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          lineNumber: 1,
          message: 'Username can only contain letters, numbers, hyphens (-), underscores (_), and plus (+) symbols',
          field: 'username',
          value: 'max@company'
        });
      }
    });

    it('should allow valid username formats', () => {
      const attendees = [
        createAttendee({ username: 'max-mustermann', email: 'max1@example.com', lineNumber: 1 }),
        createAttendee({ username: 'max_mustermann', email: 'max2@example.com', lineNumber: 2 }),
        createAttendee({ username: 'max+test', email: 'max3@example.com', lineNumber: 3 }),
        createAttendee({ username: 'MaxMustermann123', email: 'max4@example.com', lineNumber: 4 })
      ];
      
      const result = validateAttendeeData(attendees);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(4);
      }
    });

    it('should handle empty attendees list', () => {
      const result = validateAttendeeData([]);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });
});