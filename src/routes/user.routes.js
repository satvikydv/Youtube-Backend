import { Router } from "express";
import { 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    registerUser, 
    updateUserAvatar, 
    changeCurrentPassword, 
    getCurrentUser, 
    changeAccountDetails, 
    updateUserCoverImage, 
    getUserChannelProfile, 
    getWatchHistory 
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

router.route("/login").post(loginUser)

//secured routes -> only accessible if the user is logged in
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/update-avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
router.route("/change-password").post(verifyJWT, changeCurrentPassword)
router.route("current-user").get(verifyJWT, getCurrentUser)
router.route("/update-account").patch(verifyJWT, changeAccountDetails)
router.route("/update-cover").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)
router.route("/c/:username").get(getUserChannelProfile) //params: username
router.route("/history").get(verifyJWT, getWatchHistory)

export default router;