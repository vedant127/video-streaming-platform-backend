import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { user } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { response } from "express";


const registerUser = asyncHandler( async (req , res) =>{
   // get user detail from fronted
   // validation - not empty
   // check if user already exists: username , email 
   // check for images , check for avatar
   // upload them to cloaudinary 
   // create user object - creat entry in database
   // remove password and refresh token field from resposne
   // check for user creation
   // return response

const {fullname , email , username , password} = req.body
console.log("email:" , email);
console.log("password" , password);
console.log("username" , username);
console.log("fullname" , fullname);

if (
    [fullname , email , username , password].some((field)=>
    field?.trim () == "")
)  {
    throw new apiError(400 , "all field are required")
}

const existsUser = await user.findOne({
    $or: [{ username }, { email }],
  });
  
  if (existsUser) {
    if (existsUser.username === username) {
      console.log("Username already exists:", username);
    } else if (existsUser.email === email) {
      console.log("Email already exists:", email);
    }
  }
  

if (existsuser) {
    throw new apiError(409 , "user with email or username already exists")
}


const avatarlocalpath = req.files?.avatar[0]?.path;
const coverimagelocalpath = req.files?.coverimage[0]?.path;

if (!avatarlocalpath) {
    throw new apiError(400 , "avatar files is a required");
}

const avatar = await uploadOnCloudinary(avatarlocalpath);
const coverimage = await uploadOnCloudinary(coverimagelocalpath);

if (!avatar) {
    throw new apiError(409 , "user with email or username already exists")
}


const user = await user.create({
    fullname,
    avatar: avatar.url,
    coverimage: coverimage?.url || "",
    email,
    password,
    username: username.tolowercase()
})

const createduser = await user.findbyid(user._id).select(
   "-password -refreshToken" 
)

if (!createduser) {
    throw new apiError(500 , "something went wrong while registering the User")
}

return res.staus(201).json(
    new ApiResponse(200, createduser, "user registerd succsfully")
)





})



export { registerUser }