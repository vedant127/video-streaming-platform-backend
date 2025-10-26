// require('dotenv').config()

import dotenv from "dotenv";
import connectDB from "./db/index.js";


dotenv.config({
    path : './.env'
})






// Debug: Check if environment variables are loaded
console.log('MONGODB_URL:', process.env.MONGODB_URL);

connectDB();
















// import express  from "express";
// const app = express();


// ( async () => {
//     try {
//         mongoose.connect(`${process.env.MONGODB_URL}
//             /${DB_NAME}`);
//             app.on("error" , (error) => {
//                 console.log("ERROR:" , error);
//                 throw error;
//             })
        
//             app.listen(process.env.PORT , () => {
//                 console.log(`server is running on port ${process.env.PORT}`);
//             })

//     }catch(error){
//         console.error("ERROR:" , error)
//         throw err;
//     }
// })