import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
    const channelId = req.user?._id

    const [videosCount, subscribersCount] = await Promise.all([
        Video.countDocuments({ owner: channelId }),
        Subscription.countDocuments({ channel: channelId })
    ])

    const viewsAgg = await Video.aggregate([
        { $match: { owner: new mongoose.Types.ObjectId(channelId) } },
        { $group: { _id: null, totalViews: { $sum: "$views" } } }
    ])

    const totalViews = viewsAgg?.[0]?.totalViews || 0

    const likesAgg = await Like.aggregate([
        { $match: { video: { $exists: true, $ne: null } } },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video"
            }
        },
        { $addFields: { video: { $first: "$video" } } },
        { $match: { "video.owner": new mongoose.Types.ObjectId(channelId) } },
        { $count: "totalLikes" }
    ])

    const totalLikes = likesAgg?.[0]?.totalLikes || 0

    return res
        .status(200)
        .json(new ApiResponse(200, {
            totalVideos: videosCount,
            totalSubscribers: subscribersCount,
            totalViews,
            totalLikes
        }, "Channel stats fetched successfully"))
})

const getChannelVideos = asyncHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel
    const channelId = req.user?._id
    const { page = 1, limit = 10 } = req.query

    const skip = (Number(page) - 1) * Number(limit)
    const videos = await Video.find({ owner: channelId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Channel videos fetched successfully"))
})

export {
    getChannelStats, 
    getChannelVideos
    }