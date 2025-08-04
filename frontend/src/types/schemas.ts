import { z } from 'zod';

// Base schemas for common patterns
const DateTimeSchema = z.string().datetime();
const EmailSchema = z.string().email();
const NonEmptyStringSchema = z.string().min(1);

// Workshop status enum
export const WorkshopStatusSchema = z.enum([
  'planning',
  'deploying', 
  'active',
  'completed',
  'failed',
  'deleting'
]);

// Workshop template enum
export const WorkshopTemplateNameSchema = z.enum([
  'Generic'
]);

// Attendee status enum  
export const AttendeeStatusSchema = z.enum([
  'planning',
  'deploying',
  'active', 
  'failed',
  'deleting',
  'deleted'
]);

// Deployment enums
export const DeploymentActionSchema = z.enum(['deploy', 'destroy', 'plan', 'apply']);
export const DeploymentStatusSchema = z.enum(['started', 'running', 'completed', 'failed']);

// Core entity schemas
export const WorkshopSchema = z.object({
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  description: z.string().optional(),
  start_date: DateTimeSchema,
  end_date: DateTimeSchema,
  status: WorkshopStatusSchema,
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema,
  deletion_scheduled_at: DateTimeSchema.optional(),
});

export const WorkshopSummarySchema = WorkshopSchema.extend({
  attendee_count: z.number().int().nonnegative(),
  active_attendees: z.number().int().nonnegative(),
});

export const AttendeeSchema = z.object({
  id: NonEmptyStringSchema,
  workshop_id: NonEmptyStringSchema,
  username: NonEmptyStringSchema,
  email: EmailSchema,
  ovh_project_id: NonEmptyStringSchema.optional(),
  ovh_user_urn: NonEmptyStringSchema.optional(),
  status: AttendeeStatusSchema,
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema,
  deletion_scheduled_at: DateTimeSchema.optional(),
});

export const AttendeeCredentialsSchema = z.object({
  username: NonEmptyStringSchema,
  password: NonEmptyStringSchema,
  ovh_project_id: NonEmptyStringSchema.optional(),
  ovh_user_urn: NonEmptyStringSchema.optional(),
  access_key: NonEmptyStringSchema.optional(),
  secret_key: NonEmptyStringSchema.optional(),
});

export const DeploymentLogSchema = z.object({
  id: NonEmptyStringSchema,
  attendee_id: NonEmptyStringSchema,
  action: DeploymentActionSchema,
  status: DeploymentStatusSchema,
  terraform_output: z.string().optional(),
  error_message: z.string().optional(),
  started_at: DateTimeSchema,
  completed_at: DateTimeSchema.optional(),
});

// API request/response schemas
export const LoginRequestSchema = z.object({
  username: NonEmptyStringSchema,
  password: NonEmptyStringSchema,
});

export const LoginResponseSchema = z.object({
  access_token: NonEmptyStringSchema,
  token_type: NonEmptyStringSchema,
});

// Workshop template schema
export const WorkshopTemplateSchema = z.object({
  name: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  resources: z.array(NonEmptyStringSchema),
  is_active: z.boolean(),
  resource_config: z.record(z.any()).optional(),
});

export const CreateWorkshopRequestSchema = z.object({
  name: NonEmptyStringSchema,
  description: z.string().optional(),
  start_date: DateTimeSchema,
  end_date: DateTimeSchema,
  timezone: NonEmptyStringSchema,
  template: WorkshopTemplateNameSchema,
});

export const UpdateWorkshopRequestSchema = z.object({
  name: NonEmptyStringSchema.optional(),
  description: z.string().optional(),
  start_date: DateTimeSchema.optional(),
  end_date: DateTimeSchema.optional(),
  status: WorkshopStatusSchema.optional(),
  deletion_scheduled_at: DateTimeSchema.optional(),
});

export const CreateAttendeeRequestSchema = z.object({
  username: NonEmptyStringSchema,
  email: EmailSchema,
});

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
  data: dataSchema,
  message: z.string().optional(),
});

export const ApiErrorSchema = z.object({
  detail: NonEmptyStringSchema,
  status_code: z.number().int().optional(),
});

export const TaskResponseSchema = z.object({
  message: NonEmptyStringSchema,
  task_id: NonEmptyStringSchema.optional(),
  task_ids: z.array(NonEmptyStringSchema).optional(),
  attendee_id: NonEmptyStringSchema.optional(),
  attendee_count: z.number().int().nonnegative().optional(),
});

export const UserSchema = z.object({
  username: NonEmptyStringSchema,
});

// Derived types from schemas
export type Workshop = z.infer<typeof WorkshopSchema>;
export type WorkshopSummary = z.infer<typeof WorkshopSummarySchema>;
export type WorkshopStatus = z.infer<typeof WorkshopStatusSchema>;
export type WorkshopTemplate = z.infer<typeof WorkshopTemplateSchema>;
export type WorkshopTemplateName = z.infer<typeof WorkshopTemplateNameSchema>;
export type Attendee = z.infer<typeof AttendeeSchema>;
export type AttendeeStatus = z.infer<typeof AttendeeStatusSchema>;
export type AttendeeCredentials = z.infer<typeof AttendeeCredentialsSchema>;
export type DeploymentLog = z.infer<typeof DeploymentLogSchema>;
export type DeploymentAction = z.infer<typeof DeploymentActionSchema>;
export type DeploymentStatus = z.infer<typeof DeploymentStatusSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type CreateWorkshopRequest = z.infer<typeof CreateWorkshopRequestSchema>;
export type UpdateWorkshopRequest = z.infer<typeof UpdateWorkshopRequestSchema>;
export type CreateAttendeeRequest = z.infer<typeof CreateAttendeeRequestSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type TaskResponse = z.infer<typeof TaskResponseSchema>;
export type User = z.infer<typeof UserSchema>;

// Generic API response type
export type ApiResponse<T> = {
  data: T;
  message?: string;
};