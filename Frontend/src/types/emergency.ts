export type EmergencyResource = 'medical' | 'rescue' | 'supplies' | 'transport' | 'other';
export type EmergencyUrgency = 'high' | 'low';
export type EmergencySource = 'app' | 'sms';
export type EmergencyStatus = 'open' | 'matched' | 'assigned' | 'completed' | 'cancelled';

export interface EmergencyRequest {
  _id: string;
  requester_id: string | null;
  requester_phone: string;
  source: EmergencySource;
  resource: EmergencyResource;
  description: string;
  urgency: EmergencyUrgency;
  location_name: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  raw_message: string | null;
  advisory?: string | null;
  status: EmergencyStatus;
  assigned_volunteer: string | null;
  current_radius_km: number;
  created_at: string;
  updated_at: string;
}

export interface CreateEmergencyPayload {
  resource: EmergencyResource;
  description: string;
  urgency: EmergencyUrgency;
  location_name: string;
  latitude: number;
  longitude: number;
}

export interface EmergencyCardData {
  _id: string;
  requester_phone: string;
  resource: EmergencyResource;
  description: string;
  urgency: EmergencyUrgency;
  location_name: string;
  status: EmergencyStatus;
  distance_km: number;
  time_ago: string;
  current_radius_km: number;
  created_at: string;
  latitude?: number;
  longitude?: number;
}

export interface EmergencyFormData {
  resource: EmergencyResource;
  description: string;
  urgency: EmergencyUrgency;
  location_name: string;
  latitude: number;
  longitude: number;
}

export interface EmergencyLocation {
  emergency_id: string;
  resource: EmergencyResource;
  location_name: string;
  coordinates: [number, number];
}
