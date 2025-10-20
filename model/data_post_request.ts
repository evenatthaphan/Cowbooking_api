export interface FarmerPostRequest {
    id: number;
    farm_name: string;
    farm_password: string;
    phonenumber: number;
    farmer_email: string;
    profile_image: string;
    farm_address: string;
    province: string;
    district: string;
    locality: string;
}


export interface VetExpertPostRequest {
    id: number;
    VetExpert_name: string;
    VetExpert_password: string;
    phonenumber: number;
    VetExpert_email: string;
    profile_image: string;
    province: string;
    district: string;
    locality: string;
    VetExpert_address: string;
    VetExpert_PL: string;
}


export interface BullSiresPostRequest {
    id: number;
    Bullname: string;
    Bullbreed: string;
    Bullage: number;
    characteristics: string;
    farm_id : number;  //reference 
    price_per_dose: number;
    semen_stock: number;
    contest_records: string;
}

export interface VetBulls {
  id: number;
  vet_expert_id: number;
  bull_id: number;
  price_per_dose: number;
  semen_stock: number;
}


export interface FarmsPostRequest {
    id: number;
    name: string;
    province: string;
    district: string;
    locality: string;
    address: string;
}

export interface BullImages {
    id: number;
    bull_id: number;
    image1: string;
    image2: string;
    image3: string;
    image4: string;
    image5: string;
}


export interface BullRow {
  bull_id: number;
  Bullname: string;
  Bullbreed: string;
  Bullage: number;
  characteristics: string;
  farm_id: number;
  farm_name: string;
  province: string;
  district: string;
  locality: string;
  address: string;
  price_per_dose: number;
  semen_stock: number;
  contest_records: string;
  added_by: number;
  image_id: number | null;
  image1: string | null;
  image2: string | null;
  image3: string | null;
  image4: string | null;
  image5: string | null;
}

export interface Bull_VET {
  bull_id: number;
  Bullname: string;
  Bullbreed: string;
  characteristics: string;
  farm_id: number;
  farm_name: string;
  price_per_dose?: number;
  semen_stock?: number;
}

export interface Bull {
  bull_id: number;
  Bullname: string;
  Bullbreed: string;
  Bullage: number;
  characteristics: string;
  price_per_dose: number;
  semen_stock: number;
  contest_records: string;
  added_by: number;
  farm: {
    id: number;
    name: string;
    province: string;
    district: string;
    locality: string;
    address: string;
  };
  images: {
    id: number;
    image1: string | null;
    image2: string | null;
    image3: string | null;
    image4: string | null;
    image5: string | null;
  }[];
}

// Location Management Models
export interface Province {
  id: number;
  name: string;
  created_at?: string;
}

export interface District {
  id: number;
  name: string;
  province_id: number;
  created_at?: string;
}

export interface Locality {
  id: number;
  name: string;
  district_id: number;
  province_id: number;
  created_at?: string;
}

export interface ProvincePostRequest {
  name: string;
}

export interface DistrictPostRequest {
  name: string;
  province_id: number;
}

export interface LocalityPostRequest {
  name: string;
  district_id: number;
  province_id: number;
}

// Location Response Models
export interface LocationResponse {
  provinces: Province[];
  districts: District[];
  localities: Locality[];
}


export interface VetSchedulesPostRequest {
  id?: number;               
  vet_expert_id: number;     
  available_date: string;    
  available_time: string;    
  is_booked?: boolean;      
  created_at?: string;       
}



export interface QueueBookingRequest {
    id?: number;
    farmer_id: number;           
    vet_expert_id: number;       
    booking_date: string;        
    preferred_date: string;      
    preferred_time?: string;            
    detailBull: string;            
    status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
    vet_notes?: string;          
    created_at?: string;
    updated_at?: string;
}

export interface QueueBookingResponse {
    id: number;
    farmer: {
        id: number;
        farm_name: string;
        phonenumber: number;
        farmer_email: string;
        farm_address: string;
        province: string;
        district: string;
        locality: string;
    };
    vet_expert: {
        id: number;
        VetExpert_name: string;
        phonenumber: number;
        VetExpert_email: string;
        VetExpert_address: string;
        province: string;
        district: string;
        locality: string;
    };
    booking_date: string;
    preferred_date: string;
    service_type: string;
    animal_type: string;
    symptoms: string;
    urgency_level: string;
    status: string;
    vet_notes?: string;
}


export interface Adminsrequest {
  id : number;				
  admin_username : string;
  email : string;
  admin_password : string;	
  phone : string;
  address : string;
  profile_image	: string;		
  user_type : string;
  must_change_password : boolean;					
  created_at : string;
  updated_at : string;
}



export interface BookingResult {
  id: number;
  status: string;
  vet_notes: string;
  updated_at: string;
}