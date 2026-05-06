 export interface ProfessionalContact {
  telefone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
}

export interface ProfessionalData {
  id: string;
  company_name: string;
  category: string;
  description: string;
  image_url: string | null;
  city: string;
  state: string;
  address: string;
  contact: ProfessionalContact;
  rating: number | null;
  num_avaliacoes: number;
  verified_source: boolean;
  distance_km: number;
}

interface UserLocation {
  lat: number;
  lng: number;
}

export interface SuppliersResponse {
  total: number;
  limit: number;
  offset: number;
  user_location: UserLocation;
  data: ProfessionalData[];
}