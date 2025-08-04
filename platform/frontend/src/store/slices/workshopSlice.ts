import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Workshop, WorkshopSummary, Attendee } from '../../types';

interface WorkshopState {
  workshops: WorkshopSummary[];
  currentWorkshop: Workshop | null;
  currentWorkshopAttendees: Attendee[];
  loading: boolean;
  error: string | null;
}

const initialState: WorkshopState = {
  workshops: [],
  currentWorkshop: null,
  currentWorkshopAttendees: [],
  loading: false,
  error: null,
};

const workshopSlice = createSlice({
  name: 'workshops',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setWorkshops: (state, action: PayloadAction<WorkshopSummary[]>) => {
      state.workshops = action.payload;
    },
    setCurrentWorkshop: (state, action: PayloadAction<Workshop | null>) => {
      state.currentWorkshop = action.payload;
    },
    setCurrentWorkshopAttendees: (state, action: PayloadAction<Attendee[]>) => {
      state.currentWorkshopAttendees = action.payload;
    },
    updateWorkshop: (state, action: PayloadAction<WorkshopSummary>) => {
      const index = state.workshops.findIndex(w => w.id === action.payload.id);
      if (index !== -1) {
        state.workshops[index] = action.payload;
      }
    },
    addWorkshop: (state, action: PayloadAction<WorkshopSummary>) => {
      state.workshops.unshift(action.payload);
    },
    removeWorkshop: (state, action: PayloadAction<string>) => {
      state.workshops = state.workshops.filter(w => w.id !== action.payload);
    },
    updateAttendee: (state, action: PayloadAction<Attendee>) => {
      const index = state.currentWorkshopAttendees.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        state.currentWorkshopAttendees[index] = action.payload;
      }
    },
    addAttendee: (state, action: PayloadAction<Attendee>) => {
      state.currentWorkshopAttendees.push(action.payload);
    },
    removeAttendee: (state, action: PayloadAction<string>) => {
      state.currentWorkshopAttendees = state.currentWorkshopAttendees.filter(a => a.id !== action.payload);
    },
    clearCurrentWorkshop: (state) => {
      state.currentWorkshop = null;
      state.currentWorkshopAttendees = [];
    },
    updateAttendeeStatus: (state, action: PayloadAction<{
      attendeeId: string;
      status: string;
      details?: any;
    }>) => {
      const { attendeeId, status, details } = action.payload;
      
      // Update in current workshop attendees
      const attendee = state.currentWorkshopAttendees.find(a => a.id === attendeeId);
      if (attendee) {
        attendee.status = status as any;
        if (details?.project_id) {
          attendee.ovh_project_id = details.project_id;
        }
        if (details?.user_urn) {
          attendee.ovh_user_urn = details.user_urn;
        }
      }
    },
    updateWorkshopStatus: (state, action: PayloadAction<{
      workshopId: string;
      status: string;
    }>) => {
      const { workshopId, status } = action.payload;
      
      // Update in workshops list
      const workshop = state.workshops.find(w => w.id === workshopId);
      if (workshop) {
        workshop.status = status as any;
      }
      
      // Update current workshop
      if (state.currentWorkshop?.id === workshopId) {
        state.currentWorkshop.status = status as any;
      }
    },
  },
});

export const {
  setLoading,
  setError,
  setWorkshops,
  setCurrentWorkshop,
  setCurrentWorkshopAttendees,
  updateWorkshop,
  addWorkshop,
  removeWorkshop,
  updateAttendee,
  addAttendee,
  removeAttendee,
  clearCurrentWorkshop,
  updateAttendeeStatus,
  updateWorkshopStatus,
} = workshopSlice.actions;

export default workshopSlice.reducer;