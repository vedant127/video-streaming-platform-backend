import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { user, user } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";


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

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const foundUser = await user.findById(decodedToken?._id);
    if (!foundUser) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== foundUser?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    // Generate new tokens
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
        throw new ApiError(500, "Something went wrong while generating tokens");
      }
    };

    const { accessToken, refreshToken: newRefreshToken } = await genrateAccessRefreshToken(foundUser._id);

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken
          },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
}); 

const changeCurrentPassword = asyncHandler(async(req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Old password and new password are required");
  }

  if (newPassword.trim().length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters long");
  }

  const foundUser = await user.findById(req.user?._id);
  const isPasswordCorrect = await foundUser.ispasswordcorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  foundUser.password = newPassword;
  await foundUser.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});


const getCurrentUser = asyncHandler(async(req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async(req, res) => {
  const { fullname, email } = req.body;

  if (!fullname || !email) {
    throw new ApiError(400, "All fields are required");
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw new ApiError(400, "Invalid email format");
  }

  const updatedUser = await user.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname: fullname.trim(),
        email: email.trim().toLowerCase()
      }
    },
    { new: true }
  ).select("-password -refreshToken");

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Account details updated successfully"));
});

const updateUseravatar = asyncHandler(async(req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar || !avatar.url) {
    throw new ApiError(400, "Error while uploading avatar");
  }

  // Delete old avatar from Cloudinary if exists (optional - can be done later)
  const updatedUser = await user.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url
      }
    }, 
    { new: true }
  ).select("-password -refreshToken");

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Avatar image updated successfully"));
});

const updateUserCoverImage = asyncHandler(async(req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage || !coverImage.url) {
    throw new ApiError(400, "Error while uploading cover image");
  }

  const updatedUser = await user.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url
      }
    }, 
    { new: true }
  ).select("-password -refreshToken");

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async(req , res) => {
    const {username} =  req.params

    if (!username?.trim()) {
      throw new ApiError(400 , "username is missing")
      }

     const channel =  await user.aggregate([
      {
        $match:{
          username: username?.toLowerCase()
        }
      },
      {
        $lookup: {
          from: "subscription",
          localField: "_id",
          foreignField: "channel",
          as: "subscribers"
        }
      },
        {
          $lookup: {
            from: "subscription",
            localField: "_id",
            foreignField: "subscriber",
          as: "subscribedTo"
          }
        } , 
         {
          $addFields: {
            subscribersCount: {
               $size: "$subscribers"
            },
              channelsSubscribedToCount: {
                $size: "$subscribedTo"
              }, 
              isSubscribed: {
                $cond: {
                  if: {$in: [req.user?._id , "$subscribers.subscriber"]},
                  then: true,
                  else: false
                }
              }
          }
         }, 
           {
            $project: {
              fullname: 1,
              username: 1,
              subscribersCount: 1,
              channelsSubscribedToCount: 1,
              isSubscribed: 1,
              avatar: 1,
              coverImage: 1,
              email: 1
           }
        }
     ])

     if (!channel?.length) {
         throw new ApiError(404 , "channel does not exists")
      }

      return res
     .status(200)
     .json(new ApiResponse(200 , channel[0] , "user channel fatched succesfully"))

})

    
   const getWatchHistory = asyncHandler(async(req , res) => {
       const user = await user.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(req.user._id)
          }
        }, 
        {
          $lookup: {
            from: "videos",
            localField: "watchHistory",
            foreignField: _id,
            as: "watchHistory",
            pipline: [
              {
                $lookup: {
                  from: "users",
                  localField: "owner",
                  foreignField: _id,
                  as: "owner",
                  pipline: [
                    {
                      $project: {
                        fullname: 1,
                        username: 1,
                        avatar: 1
                      }
                    },
                     {
                      $addFields: {
                        owner:{
                          $first: "$owner"
                        }
                      }
                     }
                  ]
                }
              }
            ]
          }
        }
       ])
   
         return res
         .status(200)
         .json(new ApiResponse(200 , user[0].watchHistory, "watchHisotry fetched succesfully" ))

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
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory
}  