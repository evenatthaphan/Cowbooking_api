import http from "http";
import { app } from "./app";

const port = process.env.port || 3000;
const server = http.createServer(app);

//start server at port number
server.listen(port,()=>{
    console.log("Server is Started");
});