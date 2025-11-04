import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
   
    const match = {}
    if (query && String(query).trim()) {
        const q = String(query).trim()
        match.$or = [
            { tittle: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } }
        ]
    }
    if (userId && isValidObjectId(userId)) {
        match.owner = new mongoose.Types.ObjectId(userId)
    }
    
    match.isPublish = true

    const sort = {}
    if (sortBy) {
        const dir = String(sortType).toLowerCase() === "asc" ? 1 : -1
        sort[sortBy] = dir
    } else {
        sort.createdAt = -1
    }

    const skip = (Number(page) - 1) * Number(limit)
    const videos = await Video.aggregate([
        { $match: match },
        { $sort: sort },
        { $skip: skip },
        { $limit: Number(limit) },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        { $addFields: { owner: { $first: "$owner" } } },
        {
            $project: {
                videofile: 1,
                thumbnail: 1,
                tittle: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublish: 1,
                createdAt: 1,
                owner: { _id: 1, username: 1, fullname: 1, avatar: 1 }
            }
        }
    ])

    return res
        .status(200)
        .json(new ApiResponse(200, { page: Number(page), limit: Number(limit), videos }, "Videos fetched successfully"))
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    
    const videoLocalPath = req.files?.videoFile?.[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path

    if (!videoLocalPath || !thumbnailLocalPath) {
        throw new ApiError(400, "Video file and thumbnail are required")
    }

    const uploadedVideo = await uploadOnCloudinary(videoLocalPath)
    const uploadedThumb = await uploadOnCloudinary(thumbnailLocalPath)

    if (!uploadedVideo?.url || !uploadedThumb?.url) {
        throw new ApiError(500, "Failed to upload media to cloud")
    }

    const created = await Video.create({
        videofile: uploadedVideo.url,
        thumbnail: uploadedThumb.url,
        tittle: String(title || "").trim(),
        description: String(description || "").trim(),
        duration: Number(uploadedVideo?.duration || 0),
        owner: req.user?._id,
        isPublish: true
    })

    return res
        .status(201)
        .json(new ApiResponse(201, created, "Video published successfully"))
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
   
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

   
    await Video.updateOne({ _id: videoId }, { $inc: { views: 1 } })

    const result = await Video.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(videoId) } },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        { $addFields: { owner: { $first: "$owner" } } }
    ])

    if (!result?.length) {
        throw new ApiError(404, "Video not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, result[0], "Video fetched successfully"))
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
  
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const { title, description } = req.body
    const update = {}
    if (title !== undefined) update.tittle = String(title || "").trim()
    if (description !== undefined) update.description = String(description || "").trim()

    if (req.file?.path) {
        const uploadedThumb = await uploadOnCloudinary(req.file.path)
        if (!uploadedThumb?.url) {
            throw new ApiError(500, "Failed to upload thumbnail")
        }
        update.thumbnail = uploadedThumb.url
    }

    const updated = await Video.findOneAndUpdate(
        { _id: videoId, owner: req.user?._id },
        { $set: update },
        { new: true }
    )

    if (!updated) {
        throw new ApiError(404, "Video not found or not authorized")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updated, "Video updated successfully"))
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
   
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const deleted = await Video.findOneAndDelete({ _id: videoId, owner: req.user?._id })
    if (!deleted) {
        throw new ApiError(404, "Video not found or not authorized")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const existing = await Video.findOne({ _id: videoId, owner: req.user?._id })
    if (!existing) {
        throw new ApiError(404, "Video not found or not authorized")
    }

    existing.isPublish = !existing.isPublish
    await existing.save()

    return res
        .status(200)
        .json(new ApiResponse(200, { isPublish: existing.isPublish }, "Publish status toggled"))
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}