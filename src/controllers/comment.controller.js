import mongoose from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const aggregatePipeline = [
        {
            $match: { video: new mongoose.Types.ObjectId(videoId) }
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        {
            $addFields: {
                owner: { $first: "$owner" }
            }
        },
        {
            $project: {
                content: 1,
                video: 1,
                owner: {
                    _id: 1,
                    fullname: 1,
                    username: 1,
                    avatar: 1
                },
                createdAt: 1,
                updatedAt: 1
            }
        }
    ]

    const options = {
        page: Number(page) || 1,
        limit: Number(limit) || 10
    }

    const result = await Comment.aggregatePaginate(
        Comment.aggregate(aggregatePipeline),
        options
    )

    return res
        .status(200)
        .json(new ApiResponse(200, result, "Comments fetched successfully"))
})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const { videoId } = req.params
    const { content } = req.body

    if (!content || !String(content).trim()) {
        throw new ApiError(400, "Content is required")
    }
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const created = await Comment.create({
        content: String(content).trim(),
        video: new mongoose.Types.ObjectId(videoId),
        owner: req.user?._id
    })

    return res
        .status(201)
        .json(new ApiResponse(201, created, "Comment added successfully"))
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const { commentId } = req.params
    const { content } = req.body

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment id")
    }
    if (!content || !String(content).trim()) {
        throw new ApiError(400, "Content is required")
    }

    const existing = await Comment.findById(commentId)
    if (!existing) {
        throw new ApiError(404, "Comment not found")
    }
    if (String(existing.owner) !== String(req.user?._id)) {
        throw new ApiError(403, "Not authorized to update this comment")
    }

    existing.content = String(content).trim()
    await existing.save()

    return res
        .status(200)
        .json(new ApiResponse(200, existing, "Comment updated successfully"))
})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const { commentId } = req.params

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment id")
    }

    const existing = await Comment.findById(commentId)
    if (!existing) {
        throw new ApiError(404, "Comment not found")
    }
    if (String(existing.owner) !== String(req.user?._id)) {
        throw new ApiError(403, "Not authorized to delete this comment")
    }

    await Comment.deleteOne({ _id: commentId })

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Comment deleted successfully"))
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }