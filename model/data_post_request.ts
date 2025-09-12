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
    added_by: number;  //reference 
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








