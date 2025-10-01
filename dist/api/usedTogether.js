"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const dbconnect_1 = require("../dbconnect");
const bcrypt_1 = __importDefault(require("bcrypt"));
exports.router = express_1.default.Router();
// login for 3 type ****
exports.router.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { loginId, password } = req.body;
    if (!loginId || !password) {
        return res.status(400).json({ error: "loginId and password are required" });
    }
    // check Farmers
    const farmerSql = "SELECT * FROM Farmers WHERE farm_name = ? OR phonenumber = ? OR farmer_email = ?";
    dbconnect_1.conn.query(farmerSql, [loginId, loginId, loginId], (err, result) => __awaiter(void 0, void 0, void 0, function* () {
        if (err)
            return res.status(500).json({ error: err.message });
        if (result.length > 0) {
            const user = result[0];
            const isMatch = yield bcrypt_1.default.compare(password, user.farm_password);
            if (isMatch) {
                return res.json({ role: "farmer", message: "Login success", user });
            }
            else {
                return res.status(400).json({ error: "Not found this Farmer" });
            }
        }
        // check VetExperts
        const vetSql = "SELECT * FROM VetExperts WHERE VetExpert_name = ? OR phonenumber = ? OR VetExpert_email = ?";
        dbconnect_1.conn.query(vetSql, [loginId, loginId, loginId], (err2, result2) => __awaiter(void 0, void 0, void 0, function* () {
            if (err2)
                return res.status(500).json({ error: err2.message });
            if (result2.length > 0) {
                const vet = result2[0];
                const isMatch2 = yield bcrypt_1.default.compare(password, vet.VetExpert_password);
                if (isMatch2) {
                    return res.json({ role: "vet", message: "Login success", user: vet });
                }
                else {
                    return res.status(400).json({ error: "Not found this VetExpert" });
                }
            }
            // check Admins
            const adminSql = "SELECT * FROM Admins WHERE admin_name = ? OR phonenumber = ? OR admin_email = ?";
            dbconnect_1.conn.query(adminSql, [loginId, loginId, loginId], (err3, result3) => __awaiter(void 0, void 0, void 0, function* () {
                if (err3)
                    return res.status(500).json({ error: err3.message });
                if (result3.length > 0) {
                    const admin = result3[0];
                    const isMatch3 = yield bcrypt_1.default.compare(password, admin.admin_password);
                    if (isMatch3) {
                        return res.json({
                            role: "admin",
                            message: "Login success",
                            user: admin,
                        });
                    }
                    else {
                        return res.status(400).json({ error: "Not found this Admin" });
                    }
                }
                // ถ้าไม่เจอในทั้งสาม table
                return res.status(400).json({ error: "Invalid Users" });
            }));
        }));
    }));
}));
// Search *****
exports.router.post("/search", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { keyword, province, district, locality } = req.body;
    let sql = `
    SELECT 
      b.id AS bull_id,
      b.Bullname,
      b.Bullbreed,
      b.Bullage,
      b.characteristics,
      b.price_per_dose,
      b.semen_stock,
      b.contest_records,
      f.id AS farm_id,
      f.name AS farm_name,
      f.province,
      f.district,
      f.locality,
      f.address
    FROM BullSires b
    JOIN Farms f ON b.farm_id = f.id
    WHERE 1=1
  `;
    let params = [];
    // search by keyword
    if (keyword && keyword.trim() !== "") {
        sql += " AND (b.Bullname LIKE ? OR f.name LIKE ? OR b.Bullbreed LIKE ?)";
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
        console.log(" search keyword : ", keyword);
    }
    else {
        console.log(" no search only used filter ");
    }
    // filter
    if (province) {
        sql += " AND f.province = ?";
        params.push(province);
    }
    if (district) {
        sql += " AND f.district = ?";
        params.push(district);
    }
    if (locality) {
        sql += " AND f.locality = ?";
        params.push(locality);
    }
    try {
        dbconnect_1.conn.query(sql, params, (err, results) => {
            if (err) {
                console.error("Search error:", err);
                return res.status(500).json({ error: "Database query failed" });
            }
            res.json(results);
        });
    }
    catch (error) {
        res.status(500).json({ error: "Server error" });
    }
}));
// get bull data *****
exports.router.get("/bullData", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sql = `
      SELECT 
        b.id AS bull_id,
        b.Bullname,
        b.Bullbreed,
        b.Bullage,
        b.characteristics,
        b.farm_id,
        f.name AS farm_name,
        f.province,
        f.district,
        f.locality,
        f.address,
        b.price_per_dose,
        b.semen_stock,
        b.contest_records,
        b.added_by,
        i.id AS image_id,
        i.image1,
        i.image2,
        i.image3,
        i.image4,
        i.image5
      FROM BullSires b
      JOIN Farms f ON b.farm_id = f.id
      LEFT JOIN BullImages i ON b.id = i.bull_id
    `;
        dbconnect_1.conn.query(sql, (err, result) => {
            if (err) {
                console.error("Error fetching bulls:", err);
                return res.status(500).json({ error: "Database error" });
            }
            const bullsMap = {};
            result.forEach((row) => {
                if (!bullsMap[row.bull_id]) {
                    bullsMap[row.bull_id] = {
                        bull_id: row.bull_id,
                        Bullname: row.Bullname,
                        Bullbreed: row.Bullbreed,
                        Bullage: row.Bullage,
                        characteristics: row.characteristics,
                        price_per_dose: row.price_per_dose,
                        semen_stock: row.semen_stock,
                        contest_records: row.contest_records,
                        added_by: row.added_by,
                        farm: {
                            id: row.farm_id,
                            name: row.farm_name,
                            province: row.province,
                            district: row.district,
                            locality: row.locality,
                            address: row.address,
                        },
                        images: [],
                    };
                }
                if (row.image_id) {
                    bullsMap[row.bull_id].images.push({
                        id: row.image_id,
                        image1: row.image1,
                        image2: row.image2,
                        image3: row.image3,
                        image4: row.image4,
                        image5: row.image5,
                    });
                }
            });
            res.json(Object.values(bullsMap));
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
}));
