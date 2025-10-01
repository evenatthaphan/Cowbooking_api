"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const index_1 = require("./api/index");
const farmers_1 = require("./api/farmers");
const VetExpert_1 = require("./api/VetExpert");
const usedTogether_1 = require("./api/usedTogether");
const recaptcha_1 = require("./api/recaptcha");
const cors_1 = __importDefault(require("cors"));
// Object app => webApi
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)({
    origin: "*",
}));
exports.app.use(body_parser_1.default.text());
exports.app.use(body_parser_1.default.json());
// app.use("/", (req, res) => {
//   res.send("Hello World!!!");
// });
exports.app.use(express_1.default.json());
exports.app.use(express_1.default.urlencoded({ extended: true }));
exports.app.use("/", index_1.router);
exports.app.use("/farmer", farmers_1.router);
exports.app.use("/vet", VetExpert_1.router);
exports.app.use("/together", usedTogether_1.router);
exports.app.use("/", recaptcha_1.router); ///**** */
