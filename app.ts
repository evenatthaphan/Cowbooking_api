import path from "path";
import express from "express";
import bodyParser from "body-parser";
import { router as index } from "./api/index";
import { router as farmers } from "./api/api_farmers";
import { router as vetexpert } from "./api/api_vetexpert";
import { router as usedtogether } from "./api/api_used_together";
import { router as recaptcha } from "./api/api_recaptcha";
import { router as queuebook} from "./api/api_queue_bookings";
import { router as bull } from "./api/api_bulls";
import { router as admin } from "./api/api_admin"
import cors from "cors";

// Object app => webApi
export const app = express();

app.use(
    cors({
      origin: "*",
    })
  );
app.use(bodyParser.text()); 
app.use(bodyParser.json()); 

// app.use("/", (req, res) => {
//   res.send("Hello World!!!");
// });

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.use("/", index);  
app.use("/farmer", farmers);
app.use("/vet", vetexpert);
app.use("/together", usedtogether);
app.use("/api", recaptcha);  ///**** */
app.use("/queuebook", queuebook)
app.use("/bull", bull)
app.use("/admin", admin)
