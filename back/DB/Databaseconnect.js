import mongoose from "mongoose"
require('dotenv').config();

try {
    mongoose.connect(process.env.mongourl)
    console.log("Connected to database");   
} catch (error) {
    console.log('error');
    
}