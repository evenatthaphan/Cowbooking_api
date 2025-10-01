"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryAsync = exports.conn = void 0;
const mysql_1 = __importDefault(require("mysql"));
const util_1 = __importDefault(require("util"));
exports.conn = mysql_1.default.createPool({
    connectionLimit: 10,
    host: "mysql-cowbooking.alwaysdata.net",
    user: "427073",
    password: "Natthaphan2246@",
    database: "cowbooking_db1",
    port: 3306
});
//get original data first 
exports.queryAsync = util_1.default.promisify(exports.conn.query).bind(exports.conn);
