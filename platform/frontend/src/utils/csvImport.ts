export interface CsvAttendeeData {
  username: string;
  email: string;
  lineNumber: number;
}

export interface CsvParseError {
  lineNumber: number;
  message: string;
  line: string;
}

export interface CsvValidationError {
  lineNumber: number;
  message: string;
  field: string;
  value: string;
}

export type CsvParseResult = 
  | { success: true; data: CsvAttendeeData[] }
  | { success: false; errors: CsvParseError[] };

export type CsvValidationResult = 
  | { success: true; data: CsvAttendeeData[] }
  | { success: false; errors: CsvValidationError[] };

/**
 * Parse CSV text into attendee data
 * Expected format: username,email per line
 */
export const parseCsvAttendees = (csvText: string): CsvParseResult => {
  const errors: CsvParseError[] = [];
  const attendees: CsvAttendeeData[] = [];
  
  const lines = csvText.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line === '') {
      continue;
    }
    
    const parts = line.split(',');
    
    if (parts.length < 2) {
      errors.push({
        lineNumber,
        message: 'Missing email address',
        line
      });
      continue;
    }
    
    const username = parts[0].trim();
    const email = parts[1].trim();
    
    if (!username) {
      errors.push({
        lineNumber,
        message: 'Missing username',
        line
      });
      continue;
    }
    
    if (!email) {
      errors.push({
        lineNumber,
        message: 'Missing email address',
        line
      });
      continue;
    }
    
    attendees.push({
      username,
      email,
      lineNumber
    });
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  return { success: true, data: attendees };
};

/**
 * Validate parsed attendee data
 */
export const validateAttendeeData = (attendees: CsvAttendeeData[]): CsvValidationResult => {
  const errors: CsvValidationError[] = [];
  const seenUsernames = new Map<string, number>();
  const seenEmails = new Map<string, number>();
  
  for (const attendee of attendees) {
    // Validate username length
    if (attendee.username.length < 2) {
      errors.push({
        lineNumber: attendee.lineNumber,
        message: 'Username must be at least 2 characters long',
        field: 'username',
        value: attendee.username
      });
    }
    
    if (attendee.username.length > 50) {
      errors.push({
        lineNumber: attendee.lineNumber,
        message: 'Username must be less than 50 characters',
        field: 'username',
        value: attendee.username
      });
    }
    
    // Validate username format - prioritize specific error messages
    if (attendee.username.includes('.')) {
      errors.push({
        lineNumber: attendee.lineNumber,
        message: 'Username cannot contain dots (.) - use dashes (-) instead',
        field: 'username',
        value: attendee.username
      });
    } else if (attendee.username.includes(' ')) {
      errors.push({
        lineNumber: attendee.lineNumber,
        message: 'Username cannot contain spaces - use dashes (-) instead',
        field: 'username',
        value: attendee.username
      });
    } else {
      // Validate username format - only allowed characters (alphanumeric, -, _, +)
      const usernameRegex = /^[a-zA-Z0-9\-_+]+$/;
      if (!usernameRegex.test(attendee.username)) {
        errors.push({
          lineNumber: attendee.lineNumber,
          message: 'Username can only contain letters, numbers, hyphens (-), underscores (_), and plus (+) symbols',
          field: 'username',
          value: attendee.username
        });
      }
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(attendee.email)) {
      errors.push({
        lineNumber: attendee.lineNumber,
        message: 'Invalid email format',
        field: 'email',
        value: attendee.email
      });
    }
    
    // Check for duplicate usernames
    const existingUsernameLine = seenUsernames.get(attendee.username);
    if (existingUsernameLine !== undefined) {
      errors.push({
        lineNumber: attendee.lineNumber,
        message: `Username already exists in the list (first seen on line ${existingUsernameLine})`,
        field: 'username',
        value: attendee.username
      });
    } else {
      seenUsernames.set(attendee.username, attendee.lineNumber);
    }
    
    // Check for duplicate emails
    const existingEmailLine = seenEmails.get(attendee.email);
    if (existingEmailLine !== undefined) {
      errors.push({
        lineNumber: attendee.lineNumber,
        message: `Email already exists in the list (first seen on line ${existingEmailLine})`,
        field: 'email',
        value: attendee.email
      });
    } else {
      seenEmails.set(attendee.email, attendee.lineNumber);
    }
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  return { success: true, data: attendees };
};