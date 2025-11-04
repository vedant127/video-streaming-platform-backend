import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body

    
    if (!name || !String(name).trim()) {
        throw new ApiError(400, "Playlist name is required")
    }

    const created = await Playlist.create({
        name: String(name).trim(),
        description: String(description || "").trim(),
        owner: req.user?._id,
        videos: []
    })

    return res
        .status(201)
        .json(new ApiResponse(201, created, "Playlist created successfully"))
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
   
    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user id")
    }

    const lists = await Playlist.find({ owner: userId }).sort({ createdAt: -1 })
    return res
        .status(200)
        .json(new ApiResponse(200, lists, "User playlists fetched successfully"))
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
   
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist id")
    }

    const pipeline = [
        { $match: { _id: new mongoose.Types.ObjectId(playlistId) } },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos"
            }
        }
    ]

    const result = await Playlist.aggregate(pipeline)
    if (!result?.length) {
        throw new ApiError(404, "Playlist not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, result[0], "Playlist fetched successfully"))
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist or video id")
    }

    const updated = await Playlist.findOneAndUpdate(
        { _id: playlistId, owner: req.user?._id },
        { $addToSet: { videos: new mongoose.Types.ObjectId(videoId) } },
        { new: true }
    )

    if (!updated) {
        throw new ApiError(404, "Playlist not found or not authorized")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updated, "Video added to playlist"))
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    // TODO: remove video from playlist
    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist or video id")
    }

    const updated = await Playlist.findOneAndUpdate(
        { _id: playlistId, owner: req.user?._id },
        { $pull: { videos: new mongoose.Types.ObjectId(videoId) } },
        { new: true }
    )

    if (!updated) {
        throw new ApiError(404, "Playlist not found or not authorized")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updated, "Video removed from playlist"))
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    // TODO: delete playlist
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist id")
    }

    const deleted = await Playlist.findOneAndDelete({ _id: playlistId, owner: req.user?._id })
    if (!deleted) {
        throw new ApiError(404, "Playlist not found or not authorized")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Playlist deleted successfully"))
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    //TODO: update playlist
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist id")
    }

    const update = {}
    if (name && String(name).trim()) update.name = String(name).trim()
    if (description !== undefined) update.description = String(description || "").trim()

    const updated = await Playlist.findOneAndUpdate(
        { _id: playlistId, owner: req.user?._id },
        { $set: update },
        { new: true }
    )

    if (!updated) {
        throw new ApiError(404, "Playlist not found or not authorized")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updated, "Playlist updated successfully"))
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}