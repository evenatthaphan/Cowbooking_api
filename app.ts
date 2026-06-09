import path from "path";
import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import cors from "cors";

import { router as index } from "./api/index";
import { router as farmers } from "./api/api_farmers";
import { router as vetexpert } from "./api/api_vetexpert";
import { router as usedtogether } from "./api/api_used_together";
import { router as recaptcha } from "./api/api_recaptcha";
import { router as queuebook } from "./api/api_queue_bookings";
import { router as bull } from "./api/api_bulls";
import { router as admin } from "./api/api_admin";
import { router as stat } from "./api/api_stat";
import { router as resetPassword } from "./api/api_resetpassword";

// Object app => webApi
export const app = express();

app.use(
  cors({
    origin: "*",
  }),
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "keyboard cat",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
    },
  }),
);

// รองรับ Request Body ขนาดใหญ่ขึ้น
app.use((req, res, next) => {
  if (req.headers["content-type"]?.startsWith("multipart/form-data")) {
    return next();
  }
  express.json({ limit: "50mb" })(req, res, next);
});

app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
  }),
);

// ถ้ายังมี endpoint ที่รับ text
app.use(
  bodyParser.text({
    limit: "50mb",
  }),
);

app.use("/", index);
app.use("/farmer", farmers);
app.use("/vet", vetexpert);
app.use("/together", usedtogether);
app.use("/api", recaptcha);
app.use("/queuebook", queuebook);
app.use("/bull", bull);
app.use("/admin", admin);
app.use("/stats", stat);
app.use("/reset-password", resetPassword);
