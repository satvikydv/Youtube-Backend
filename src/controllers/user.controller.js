import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from '../utils/ApiResponse.js'


const registerUser = asyncHandler( async (req, res) => {
    //Steps:
    // 1. Get the user data from frontend
    // 2. validation - not empty fields, email validation, password validation
    // 3. check if user already exists - username, email
    // 4. check for images, check for avatar
    // 5. upload them to cloudinary, avatar
    // 6. create user object - create entry in db
    // 7. remove password and refresh token field from response
    // 8. check if user is created
    // 9. send response

    const {fullName, email, username, password} = req.body

    //validation
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "Please fill in all fields")
    }

    //check if user already exists - by checking if either one of email or username already exists
    const existedUser = await User.findOne(
        {
            $or: [
                { email }, { username }
            ]
        }
    )

    if(existedUser){
        throw new ApiError(409, "User already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Please upload an avatar")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(500, "Error uploading avatar")
    }


    //now adding to database
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        username: username.toLowerCase(),
        password
    })

    const userCreated = await User.findById(user._id).select("-password -refreshToken")

    if(!userCreated){
        throw new ApiError(500, "Error creating user")
    }

    return res.status(201).json(
        new ApiResponse(200, userCreated,"User created successfully")
    )
})

export { registerUser }