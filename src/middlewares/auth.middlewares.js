import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { user } from "../models/user.model.js";

export const verifyJwt = asyncHandler(async(req , _, next) => {
   try {
     const token = req.cookies?.accessToken ||
      req.header("authorization")?.replace("Bearer ", "")
      
      if(!token) {
         throw new ApiError(401 , "unauthorized request")
      }
 
      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
 
 
     const foundUser = await user.findById(decodedToken?._id)
      .select("-password -refreshToken")
 
      if (!foundUser) {
         throw new ApiError(401 , "invalid acceess token")
      }
   
       req.user = foundUser;
       next()
   } catch (error) {
    throw new ApiError(401 , error?.message ||
        "invalid message"
    )
   }

})

