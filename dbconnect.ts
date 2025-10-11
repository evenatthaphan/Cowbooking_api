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
//export const queryAsync = util.promisify(conn.query).bind(conn);

export const queryAsync = (sql: string, params?: any[]) => {
  return new Promise((resolve, reject) => {
    conn.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

