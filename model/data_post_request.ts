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






