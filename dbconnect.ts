import mysql from "mysql";
import util from "util";

export const conn = mysql.createPool(
    {
        connectionLimit: 10,
        host: "mysql-cowbooking.alwaysdata.net",
        user: "427073",
        password: "Natthaphan2246@",
        database: "cowbooking_db1",
        port: 3306
    }
);

//get original data first 
export const queryAsync = util.promisify(conn.query).bind(conn);
