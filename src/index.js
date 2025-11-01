// require('dotenv').config()

import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";


dotenv.config({
    path: './.env',
    quiet: true
});

connectDB()
.then(()=> {
    app.listen(process.env.PORT || 8000 , () => {
        console.log(`server is running at port: ${process.env.PORT || 8000}`);
    })
})
.catch((err) => {
    console.log("MONGODB connection failed !!!" , err);
})
















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