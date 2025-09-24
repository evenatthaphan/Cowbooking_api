import express from "express";
import { FarmerPostRequest } from "../model/data_post_request";
import { conn, queryAsync } from "../dbconnect";
import mysql from "mysql";
import bcrypt from "bcrypt";

export const router = express.Router();



// get Vetexpert request for register*****

router.get("/getVet", req, res => {
   

});