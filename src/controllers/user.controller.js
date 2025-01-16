import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from '../utils/ApiResponse.js'
import jwt from "jsonwebtoken"
import mongoose from 'mongoose'

// asyncHandler is a middleware that wraps around an async function and catches any errors that the async function throws. 
// It then passes the error to the next middleware in the chain. 
// This is useful because Express does not catch errors thrown in async functions by default.
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
    // console.log(req.body)
    //validation
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "Please fill in all fields")
    }

    //check if user already exists - by checking if either one of email or username already exists
    const existedUser = await User.findOne(
        {
            $or: [      //or operator
                { email }, { username }
            ]
        }
    )

    if(existedUser){
        throw new ApiError(409, "User already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;     //stored locally on the server, yet to be uploaded on cloudinary
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
        
    }

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
    // console.log(req.files);
    const userCreated = await User.findById(user._id).select("-password -refreshToken")

    if(!userCreated){
        throw new ApiError(500, "Error creating user")
    }

    return res.status(201).json(
        new ApiResponse(200, userCreated,"User created successfully")
    )
    
})

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        //we save the refresh token in the db so that we can use it to generate new access token without the need to login again
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access tokens")
    }
}

const loginUser = asyncHandler(async(req, res) => {
    // steps:
    // req.body - email, password
    // username or email
    // find user in db\
    // password check
    // generate access token and refresh token
    // send cookies

    const {email, username, password} = req.body

    if(!username && !email ){
        throw new ApiError(400, "Please provide username or email")
    }

    const user = await User.findOne({
        $or: [          //this is a mongoDB query
            {username},
            {email}
        ]
    })

    if(!user){
        throw new ApiError(404, "User not found")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)  //this was a custom method created in the user model

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user creds")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    //cookies
    const options = {
        httpOnly: true,
        secure: true,
    }

    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User logged in successfully"
            )
        )
})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(req.user._id,
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
        secure: true,
    }

    return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User logged out successfully")
        )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    //get the refresh token from the cookies
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if(user.refreshToken !== incomingRefreshToken){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)
    
        const options = {
            httpOnly: true,
            secure: true,
        }
    
        return res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200, 
                    {accessToken, refreshToken: newRefreshToken},
                    "Access token refreshed successfully"
                )
            )
    } catch (error) {
        throw new ApiError(401, "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(401, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})   

    return res.status(200).json(
        new ApiResponse(200, {}, "Password changed successfully")
    )
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res.status(200).json(
        new ApiResponse(200, req.user, "Current user fetched successfully")
    )
})

const changeAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body

    if(!fullName){
        throw new ApiError(400, "Please provide full name to update")
    }

    if(!email){
        throw new ApiError(400, "Please provide email to update")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "User details updated successfully")
    )
})

const updateUserAvatar = asyncHandler(async(req, res)=> {
    const avatarLocalPath = req.file?.path;     
    if(!avatarLocalPath){
        throw new ApiError(400, "Please upload an avatar")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar){
        throw new ApiError(400, "Error uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id, 
        {
            $set:{
                avatar: avatar.url
            }
        }, 
        {new: true})
        .select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req, res)=> {
    const coverImageLocalPath = req.file?.path;     
    if(!coverImageLocalPath){
        throw new ApiError(400, "Please upload the cover image")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage){
        throw new ApiError(400, "Error uploading cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id, 
        {
            $set:{
                coverImage: coverImage.url
            }
        }, 
        {new: true})
        .select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params

    if(!username) {
        throw new ApiError(400, "Please provide a username")
    }

    //aggregation pipeline
    const channel = await User.aggregate([
        //first stage
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        //second stage
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: { 
                    $size: "$subscribers"
                },
                subscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribedToCount: 1,
                subscriberCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel.length){
        throw new ApiError(404, "Channel not found")
    }

    console.log(channel)

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "Channel profile fetched successfully")
    )    
})

const getWatchHistory = asyncHandler(async(req, res)=> {
    const user = User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [ 
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200, user[0].watchHistory, "Watch history fetched successfully")
    )
})

export { 
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword,
    getCurrentUser, 
    changeAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
 }