import { Router } from "express";
import { 
    loginUser,
     logoutuser, 
     registerUser ,
      refreshAccessToken,
       changeCurrentPassword, 
       getCurrentUser,
        updateAccountDetails,
         updateUseravatar,
          updateUserCoverImage, 
          getUserChannelProfile,
           getWatchHistory 
        } from "../controllers/user.controller.js";

import {upload} from "../middlewares/multer.middleware.js";
import { verifyJwt } from "../middlewares/auth.middlewares.js";
import multer from "multer";


const router = Router()
router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverimage",
            maxCount: 1
        }
    ]),
    registerUser
);

router.route("/login").post(loginUser)

//secured routes
router.route("/logout").post(verifyJwt , logoutuser)
router.route("/refesh-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJwt , changeCurrentPassword)
router.route("/current-user").get(verifyJwt , getCurrentUser)
router.route("/update-account").patch(verifyJwt , updateAccountDetails)
router.route("/avatar").patch(verifyJwt , upload.single("avatar") , updateUseravatar)
router.route("/cover-image").patch(verifyJwt , upload.single("coverimage") , updateUserCoverImage)
router.route("/c/:username").get(verifyJwt , getUserChannelProfile)
router.route("/history").get(verifyJwt , getWatchHistory)



export default router