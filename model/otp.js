const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const otpLimitSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    attempts: { type: Number, default: 0 },
    lastRequest: { type: Date, default: Date.now },
    // This document will automatically delete itself after 24 hours
    createdAt: { type: Date, expires: '24h', default: Date.now } 
});

const OtpLimit = mongoose.model('OtpLimit', otpLimitSchema);

module.exports = OtpLimit;