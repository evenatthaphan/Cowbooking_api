import path from "path";
import express from "express";
import bodyParser from "body-parser";
import { router as index } from "./api/index";
import { router as farmers } from "./api/farmers";
import { router as vetexpert } from "./api/VetExpert";
import { router as usedtogether } from "./api/usedTogether";
//import cors from "cors";

// Object app => webApi
export const app = express();

// app.use(
//     cors({
//       origin: "*",
//     })
//   );
// app.use(bodyParser.text()); 
// app.use(bodyParser.json()); 

// app.use("/", (req, res) => {
//   res.send("Hello World!!!");
// });

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.use("/", index);
app.use("/farmer", farmers);
app.use("/vet", vetexpert);
app.use("/together", usedtogether);
