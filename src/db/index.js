import mongoose from "mongoose";
import { DB_NAME } from "../constant.js";

const connectDB = async () => {
   try {
       // Use fallback if MONGODB_URL is not loaded
       const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
       console.log('Attempting to connect with URL:', mongoUrl);
       
       const connectioninstance = await mongoose.connect(
           `${mongoUrl}/${DB_NAME}`
       )
       console.log(`\n mongodb connected !! DB HOST: ${connectioninstance.connection.host}`)
   }catch (error) {

    console.log("MONGODB connection error" , error);
    process.exit(1);
   }
}

export default connectDB