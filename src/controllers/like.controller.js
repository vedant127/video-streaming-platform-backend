import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    //TODO: toggle like on video
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const existing = await Like.findOne({
        video: new mongoose.Types.ObjectId(videoId),
        likedby: req.user?._id
    })

    if (existing) {
        await Like.deleteOne({ _id: existing._id })
        return res
            .status(200)
            .json(new ApiResponse(200, { liked: false }, "Like removed"))
    }

    const created = await Like.create({
        video: new mongoose.Types.ObjectId(videoId),
        likedby: req.user?._id
    })

    return res
        .status(201)
        .json(new ApiResponse(201, { liked: true, _id: created._id }, "Video liked"))
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    //TODO: toggle like on comment
    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment id")
    }

    const existing = await Like.findOne({
        comment: new mongoose.Types.ObjectId(commentId),
        likedby: req.user?._id
    })

    if (existing) {
        await Like.deleteOne({ _id: existing._id })
        return res
            .status(200)
            .json(new ApiResponse(200, { liked: false }, "Like removed"))
    }

    const created = await Like.create({
        comment: new mongoose.Types.ObjectId(commentId),
        likedby: req.user?._id
    })

    return res
        .status(201)
        .json(new ApiResponse(201, { liked: true, _id: created._id }, "Comment liked"))
})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    //TODO: toggle like on tweet
    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet id")
    }

    const existing = await Like.findOne({
        tweet: new mongoose.Types.ObjectId(tweetId),
        likedby: req.user?._id
    })

    if (existing) {
        await Like.deleteOne({ _id: existing._id })
        return res
            .status(200)
            .json(new ApiResponse(200, { liked: false }, "Like removed"))
    }

    const created = await Like.create({
        tweet: new mongoose.Types.ObjectId(tweetId),
        likedby: req.user?._id
    })

    return res
        .status(201)
        .json(new ApiResponse(201, { liked: true, _id: created._id }, "Tweet liked"))
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    const pipeline = [
        {
            $match: {
                likedby: new mongoose.Types.ObjectId(req.user?._id),
                video: { $exists: true, $ne: null }
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video"
            }
        },
        {
            $addFields: {
                video: { $first: "$video" }
            }
        }
    ]

    const liked = await Like.aggregate(pipeline)
    return res
        .status(200)
        .json(new ApiResponse(200, liked, "Liked videos fetched successfully"))
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}