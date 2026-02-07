import http from "http";
import { app } from "./app";
import { cleanupCaptchas } from "./api/api_recaptcha";

const port = process.env.PORT || 3000;

const server = http.createServer(app);

//start server at port number
server.listen(port, () => {
    console.log(`Server is Started on port ${port}`);
});

// cleanup ทุก 1 ชั่วโมง
//setInterval(cleanupCaptchas, 60 * 60 * 1000);
