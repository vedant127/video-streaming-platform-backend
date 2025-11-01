import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { user, user } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { verify } from "jsonwebtoken";
import { verifyJwt } from "../middlewares/auth.middlewares.js";


const registerUser = asyncHandler(async (req, res) => {
  // Check if request body exists (multer puts form-data in req.body)
  if (!req.body || Object.keys(req.body).length === 0) {
    throw new ApiError(
      400,
      "Invalid request format. Please use 'form-data' in Postman (not raw JSON). Required fields: fullname, email, username, password, and avatar file."
    );
  }

  const { fullname, email, username, password } = req.body;

  // Validate required fields with specific error messages
  const missingFields = [];
  if (!fullname || (typeof fullname === 'string' && !fullname.trim())) missingFields.push("fullname");
  if (!email || (typeof email === 'string' && !email.trim())) missingFields.push("email");
  if (!username || (typeof username === 'string' && !username.trim())) missingFields.push("username");
  if (!password || (typeof password === 'string' && !password.trim())) missingFields.push("password");

  if (missingFields.length > 0) {
    throw new ApiError(
      400, 
      `Missing required fields: ${missingFields.join(", ")}. Please use 'form-data' format in Postman with all fields.`
    );
  }

  // Ensure all values are strings before processing
  const fullnameStr = String(fullname || '').trim();
  const emailStr = String(email || '').trim();
  const usernameStr = String(username || '').trim();
  const passwordStr = String(password || '').trim();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailStr)) {
    throw new ApiError(400, "Invalid email format");
  }

  // Validate password strength
  if (passwordStr.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long");
  }

  // Normalize inputs
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedFullname = fullname.trim();

  // Check if user already exists
  const existingUserByEmail = await user.findOne({ email: normalizedEmail });
  const existingUserByUsername = await user.findOne({ username: normalizedUsername });

  if (existingUserByEmail) {
    throw new ApiError(409, `Email "${emailStr}" is already registered. Please use a different email or try logging in instead.`);
  }

  if (existingUserByUsername) {
    throw new ApiError(409, `Username "${usernameStr}" is already taken. Please choose a different username.`);
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverimage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required. Please upload an image file.");
  }

  // Upload avatar to Cloudinary
  console.log('Uploading avatar from path:', avatarLocalPath);
  const avatarUpload = await uploadOnCloudinary(avatarLocalPath);
  
  if (!avatarUpload || !avatarUpload.url) {
    console.error('Avatar upload failed. Check Cloudinary configuration and file path.');
    throw new ApiError(500, "Avatar upload failed. Please check Cloudinary configuration or try again with a different image.");
  }

  // Upload cover image if provided
  const coverImageUpload = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : null;

  const newUser = await user.create({
    fullname: normalizedFullname,
    avatar: avatarUpload.url,
    coverImage: coverImageUpload?.url || "",
    email: normalizedEmail,
    password: passwordStr,
    username: normalizedUsername,
  });

  const createdUser = await user.findById(newUser._id).select("-password -refreshToken");
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }
  return res.status(201).json(
    new ApiResponse(201, createdUser, "User registered successfully")
  );
});


const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  
  // Validation
  if ((!email && !username) || !password) {
    throw new ApiError(400, "Email/username and password are required");
  }

  // Find user by email or username (case-insensitive)
  const query = { $or: [] };
  if (email) query.$or.push({ email: email.toLowerCase() });
  if (username) query.$or.push({ username: username.toLowerCase() });
  
  const foundUser = await user.findOne(query);

  if (!foundUser) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Verify password
  const isPasswordCorrect = await foundUser.ispasswordcorrect(password);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Generate tokens
  const genrateAccessRefreshToken = async (userId) => {
    try {
      const userDoc = await user.findById(userId);
      if (!userDoc) {
        throw new ApiError(404, "User not found");
      }
      
      const accessToken = userDoc.genrateAccessToken();
      const refreshToken = userDoc.genrateRefreshToken();

      userDoc.refreshToken = refreshToken;
      await userDoc.save({ validateBeforeSave: false });
      
      return { accessToken, refreshToken };
    } catch (error) {
      throw new ApiError(500, "Something went wrong while generating access and refresh token");
    }
  };

  const { accessToken, refreshToken } = await genrateAccessRefreshToken(foundUser._id);
  
  // Get logged in user without sensitive data
  const loggedInUser = await user.findById(foundUser._id).select("-password -refreshToken");
  
  if (!loggedInUser) {
    throw new ApiError(500, "Something went wrong while fetching user data");
  }

  // Cookie options
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken
        },
        "User logged in successfully"
      )
    );
});

const logoutuser = asyncHandler(async(req , res) => {
   await user.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined
      }
    },
    {
      new: true
    }
   )

   const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
   }

   return res
   .status(200)
   .clearCookie("accessToken", options)
   .clearCookie("refreshToken", options)
   .json(new ApiResponse(200, {}, "User logged out successfully"))
})

const refreshAccessToken = asyncHandler(async (req , res) => {
     const incomingefreshToken = req.cookie.refreshToken || req.body.refreshToken
  
     if(!incomingefreshToken) {
      throw new ApiError(401 , "unauthorized request")
     }

    try {
       const decodedToken = Jwt.verify(
        incomingefreshToken,
        process.env.REFRESH_TOKEN_SECRET
       )
  
       const user =await user.findById(decodedToken?._id)
       if(!user) {
        throw new ApiError(401 , "invalid refresh token")
       }
  
       if (incomingefreshToken !== user ?.refreshToken) {
        throw new ApiError(401 , "refesh token is expired or used")
  
        }
  
        const options = {
          httpOnly: true,
          secure: true
        }
       const {accessToken , newrefreshToken} =await genrateAccessRefreshToken(user._id)
       return res
       .status(200)
       .cookie("accessToken" , accessToken , options)
       .cookie("refreshToken" , newrefreshToken , options)
       .json(
        new ApiResponse(200),
        {
          accessToken , refreshToken: newrefreshToken 
        },
        "access token refreshed"
       )
    } catch (error) {
      throw new ApiError(401 , error?.message ||
        "invalid refresh token"
      )
      
    }
}) 

const changeCurrentPassword = asyncHandler(async(req , res) => {
    const {oldPassword , newPassword} = req.body
 
    const user = await user.findById(req.user?._id)
    const ispasswordcorrect =await user.ispasswordcorrect(oldPassword)

    if (!ispasswordcorrect) {
      throw new ApiError(400 , "invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200 , {} , "password changed successfully"))
    
})


const getCurrentUser = asyncHandler(async(req , res) => {
  return res
  .status(200)
  .json(200 , req.user , "current user fetch succsfully")
})

const updateAccountDetails = asyncHandler(async(req , res) =>{
    const {fullname , email} = req.body

    if (!fullname || !email) {
      throw new ApiError(400 , "all fields are required")
     }

    
     const user = user.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          fullname: fullname,
          email: email
        }
      },
      {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200 , user , "account details updated succesffully"))
})

const updateUseravatar = asyncHandler(async(req , res) =>{
   const avatarLocalPath =  req.file?.path

   if (!avatarLocalPath) {
    throw new ApiError(400 , "avatar file is missing")
   }

   const avatar = await uploadOnCloudinary
    (coverImageLocalPath)

    if (!avatar.url) {
      throw new ApiError(400 , "error while uploading")
    }

    const user = await user.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          avatar: avatar.url
        }
      }, 
      {new: true}
    ).select("-password")

    return res
   .status(200)
   .join(new ApiResponse
    (200 , user , "avatar iamage image updated succsfully")
   )
})

const updateUserCoverImage = asyncHandler(async(req , res) =>{
  const CoverImage =  req.file?.path

  if (!CoverImageLocalPath) {
   throw new ApiError(400 , "Cover Image file is missing")
  }

  const coverImage = await uploadOnCloudinary
   (CoverImageLocalPath)

   if (!CoverImage.url) {
     throw new ApiError(400 , "error while uploading")
   }

  const user = await user.findByIdAndUpdate(
     req.user?._id,
     {
       $set: {
        coverImage: coverImage.url
       }
     }, 
     {new: true}
   ).select("-password")

   return res
   .status(200)
   .join(new ApiResponse
    (200 , user , "cover iamage image updated succsfully")
   )
})

export { 
  registerUser ,
  loginUser ,
  logoutuser,
  refreshAccessToken , 
  changeCurrentPassword , 
  getCurrentUser, 
  updateAccountDetails,
  updateUseravatar,
  updateUserCoverImage
}  