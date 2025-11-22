import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { TRANSCODE_PROFILES } from "../constant.js"
import { EncodingJob } from "../models/encodingJob.model.js"
import { VideoMetric } from "../models/videoMetric.model.js"
import { StreamingSession } from "../models/streamingSession.model.js"

const buildInitialVariants = () => {
    const variants = []
    TRANSCODE_PROFILES.forEach((profile) => {
        const containers = profile.containers?.length ? profile.containers : ["hls"]
        containers.forEach((container) => {
            variants.push({
                profile: profile.id,
                label: `${profile.id}-${container}`,
                container,
                bandwidthKbps: profile.bitrateKbps,
                resolution: {
                    width: profile.width,
                    height: profile.height
                },
                codec: profile.codec,
                segmentDurationSeconds:
                    container === "dash" ? profile.dashSegmentDuration : profile.hlsSegmentDuration,
                status: "pending"
            })
        })
    })
    return variants
}


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
    const { title, description } = req.body

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

    const variants = buildInitialVariants()
    const created = await Video.create({
        videofile: uploadedVideo.url,
        thumbnail: uploadedThumb.url,
        tittle: String(title || "").trim(),
        description: String(description || "").trim(),
        duration: Number(uploadedVideo?.duration || 0),
        owner: req.user?._id,
        isPublish: true,
        storage: {
            ingestionOrigin: uploadedVideo.url,
            cdnPlaybackBaseUrl: process.env.CDN_PLAYBACK_BASE_URL || "",
            defaultCdn: process.env.CDN_PROVIDER || "cloudinary"
        },
        playback: {
            defaultFormat: "hls"
        },
        variants
    })

    const encodingJob = await EncodingJob.create({
        video: created._id,
        sourceUrl: uploadedVideo.url,
        thumbnailUrl: uploadedThumb.url,
        priority: "normal",
        variantsRequested: variants.map((variant) => ({
            profile: variant.profile,
            container: variant.container,
            bandwidthKbps: variant.bandwidthKbps,
            resolution: variant.resolution,
            codec: variant.codec,
            segmentDurationSeconds: variant.segmentDurationSeconds
        }))
    })

    return res.status(201).json(
        new ApiResponse(
            201,
            {
                video: created,
                encodingJobId: encodingJob._id
            },
            "Video published and encoding job queued"
        )
    )
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

const getVideoManifest = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const requestedFormat = String(req.query.format || "hls").toLowerCase()

    if (!["hls", "dash"].includes(requestedFormat)) {
        throw new ApiError(400, "Unsupported manifest format")
    }

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const manifestData = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId),
                isPublish: true
            }
        },
        {
            $project: {
                playback: 1,
                storage: 1,
                variants: {
                    $filter: {
                        input: "$variants",
                        as: "variant",
                        cond: {
                            $and: [
                                { $eq: ["$$variant.container", requestedFormat] }
                            ]
                        }
                    }
                }
            }
        }
    ])

    if (!manifestData.length) {
        throw new ApiError(404, "Video not found or not published")
    }

    const video = manifestData[0]
    const readyVariants = video.variants?.filter((v) => v.status === "ready") || []
    const manifestMeta =
        requestedFormat === "hls"
            ? video.playback?.manifests?.hls
            : video.playback?.manifests?.dash

    const playbackBaseUrl =
        video.storage?.cdnPlaybackBaseUrl || process.env.CDN_PLAYBACK_BASE_URL || ""

    // If manifest path exists, return it
    if (manifestMeta?.path) {
        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    format: requestedFormat,
                    masterManifest: {
                        path: manifestMeta.path,
                        version: manifestMeta.version || 0,
                        url: playbackBaseUrl
                            ? `${playbackBaseUrl}/${manifestMeta.path}`
                            : manifestMeta.path
                    },
                    variants: readyVariants,
                    playbackBaseUrl,
                    encodingStatus: "completed"
                },
                "Manifest fetched successfully"
            )
        )
    }

    // If no manifest path but variants exist, check encoding status
    if (video.variants && video.variants.length > 0) {
        const encodingJob = await EncodingJob.findOne({
            video: new mongoose.Types.ObjectId(videoId)
        }).sort({ createdAt: -1 })

        const encodingStatus = encodingJob?.status || "unknown"
        const hasReadyVariants = readyVariants.length > 0

        if (hasReadyVariants) {
            // Generate default manifest path if variants are ready but manifest not set
            const defaultManifestPath = `videos/${videoId}/master.${requestedFormat === "hls" ? "m3u8" : "mpd"}`
            
            return res.status(200).json(
                new ApiResponse(
                    200,
                    {
                        format: requestedFormat,
                        masterManifest: {
                            path: defaultManifestPath,
                            version: 0,
                            url: playbackBaseUrl
                                ? `${playbackBaseUrl}/${defaultManifestPath}`
                                : defaultManifestPath
                        },
                        variants: readyVariants,
                        playbackBaseUrl,
                        encodingStatus: "ready",
                        warning: "Manifest path not set by encoding worker. Using default path."
                    },
                    "Manifest fetched successfully (using default path)"
                )
            )
        }

        // Variants exist but not ready yet
        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    format: requestedFormat,
                    variants: video.variants,
                    encodingStatus,
                    progressPercent: encodingJob?.progressPercent || 0,
                    message: "Video is still being encoded. Variants will be available once encoding completes."
                },
                "Video encoding in progress"
            )
        )
    }

    // No variants at all
    throw new ApiError(409, "Video encoding not started. Please wait for encoding job to be created.")
})

const getSegmentSignedUrl = asyncHandler(async (req, res) => {
    const { videoId, variantLabel, segmentName } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findOne(
        { _id: videoId, isPublish: true },
        { variants: 1, storage: 1 }
    ).lean()

    if (!video) {
        throw new ApiError(404, "Video not found or not published")
    }

    if (!video.variants || video.variants.length === 0) {
        throw new ApiError(404, "No variants found for this video")
    }

    const variant = video.variants.find(
        (item) =>
            item.label === variantLabel ||
            item.profile === variantLabel ||
            item.label === `${variantLabel}-hls` ||
            item.label === `${variantLabel}-dash`
    )

    if (!variant) {
        const availableVariants = video.variants.map((v) => v.label).join(", ")
        throw new ApiError(
            404,
            `Variant "${variantLabel}" not found. Available variants: ${availableVariants}`
        )
    }

    if (variant.status !== "ready") {
        const encodingJob = await EncodingJob.findOne({
            video: new mongoose.Types.ObjectId(videoId)
        })
            .sort({ createdAt: -1 })
            .lean()

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    variant: variant.label,
                    status: variant.status,
                    encodingStatus: encodingJob?.status || "unknown",
                    progressPercent: encodingJob?.progressPercent || 0,
                    message: `Variant "${variant.label}" is not ready yet. Encoding status: ${encodingJob?.status || "unknown"}. Please wait for encoding to complete.`,
                    availableVariants: video.variants
                        .filter((v) => v.status === "ready")
                        .map((v) => v.label),
                    segmentName: segmentName || "N/A"
                },
                "Variant encoding in progress"
            )
        )
    }

    // Validate segment name format
    if (!segmentName || segmentName.trim() === "") {
        throw new ApiError(400, "Segment name is required")
    }

    // Build segment path
    const segmentsPath = variant.segmentsPath || `videos/${videoId}/${variant.container}/${variant.profile}/`
    const segmentPath = `${segmentsPath}${segmentName}`

    const playbackBaseUrl =
        variant.storage?.cdnBaseUrl ||
        video.storage?.cdnPlaybackBaseUrl ||
        process.env.CDN_PLAYBACK_BASE_URL ||
        ""

    const segmentUrl = playbackBaseUrl
        ? `${playbackBaseUrl}/${segmentPath}`.replace(/\/+/g, "/")
        : segmentPath

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                variant: variant.label,
                segmentName,
                segmentPath,
                segmentUrl,
                playbackBaseUrl: playbackBaseUrl || "Not configured"
            },
            "Segment URL issued successfully"
        )
    )
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

const recordVideoMetrics = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const {
        sessionId,
        playback = {},
        network = {},
        segments = [],
        switches = []
    } = req.body

    if (!sessionId || typeof sessionId !== "string") {
        throw new ApiError(400, "sessionId is required")
    }

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const videoObjectId = new mongoose.Types.ObjectId(videoId)
    const samplePayload = {
        timestamp: new Date(),
        bitrateKbps: Number(playback?.bitrateKbps || playback?.targetBitrateKbps || 0),
        throughputKbps: Number(network?.avgThroughputKbps || playback?.averageThroughputKbps || 0),
        bufferMs: Number(playback?.bufferMs || 0)
    }
    const switchEvents = (switches || []).map((item) => ({
        timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
        fromProfile: item.fromProfile,
        toProfile: item.toProfile,
        reason: item.reason,
        throughputKbps: Number(item.throughputKbps || 0)
    }))
    const segmentMetrics = (segments || []).map((segment) => ({
        variantProfile: segment.variantProfile,
        segmentIndex: segment.segmentIndex,
        downloadDurationMs: Number(segment.downloadDurationMs || 0),
        sizeBytes: Number(segment.sizeBytes || 0),
        transferRateKbps: Number(segment.transferRateKbps || 0)
    }))

    const metricUpdate = {
        $setOnInsert: {
            video: videoObjectId,
            sessionId,
            user: req.user?._id
        },
        $inc: {
            "totals.watchTimeMs": Number(playback?.watchTimeMs || 0),
            "totals.downloadedBytes": Number(playback?.downloadedBytes || 0),
            "totals.rebufferMs": Number(playback?.rebufferMs || 0)
        },
        $push: {
            samples: samplePayload
        }
    }

    if (switchEvents.length) {
        metricUpdate.$push.switchEvents = { $each: switchEvents }
    }
    if (segmentMetrics.length) {
        metricUpdate.$push.segmentMetrics = { $each: segmentMetrics }
    }

    const metric = await VideoMetric.findOneAndUpdate(
        { video: videoObjectId, sessionId },
        metricUpdate,
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    )

    await StreamingSession.updateOne(
        { sessionId },
        {
            $set: {
                video: videoObjectId,
                user: req.user?._id,
                avgThroughputKbps: Number(
                    network?.avgThroughputKbps || playback?.averageThroughputKbps || 0
                ),
                lastVariantProfile: playback?.variantProfile,
                lastBitrateKbps: Number(playback?.bitrateKbps || playback?.targetBitrateKbps || 0),
                lastClientMeta: network?.clientMeta || {}
            },
            $push: {
                switchHistory: { $each: switchEvents },
                networkSamples: {
                    $each: [
                        {
                            throughputKbps: Number(
                                network?.avgThroughputKbps || playback?.averageThroughputKbps || 0
                            ),
                            latencyMs: Number(network?.latencyMs || 0),
                            downloadedBytes: Number(playback?.downloadedBytes || 0)
                        }
                    ]
                }
            },
            $inc: {
                rebufferEvents: Number(playback?.rebufferEvents || 0)
            }
        },
        { upsert: true }
    )

    await Video.updateOne(
        { _id: videoObjectId },
        {
            $inc: {
                "analytics.totalWatchTimeMs": Number(playback?.watchTimeMs || 0),
                "analytics.totalBytesDelivered": Number(playback?.downloadedBytes || 0),
                "analytics.totalRebufferMs": Number(playback?.rebufferMs || 0),
                "analytics.sessions": 1
            },
            $max: {
                "analytics.peakThroughputKbps": Number(
                    network?.avgThroughputKbps || playback?.averageThroughputKbps || 0
                )
            },
            $set: {
                "analytics.lastSessionId": sessionId,
                "analytics.lastVariantProfile": playback?.variantProfile
            }
        }
    )

    return res
        .status(200)
        .json(new ApiResponse(200, { sessionId, metricsId: metric?._id }, "Metrics recorded"))
})

const getVideoMetrics = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const bucketMinutes = Number(req.query.bucketMinutes || 60)

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const bucketStart = new Date(Date.now() - bucketMinutes * 60 * 1000)

    const summary = await VideoMetric.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId),
                updatedAt: { $gte: bucketStart }
            }
        },
        {
            $project: {
                totals: 1,
                avgSampleBitrate: { $avg: "$samples.bitrateKbps" },
                avgSampleThroughput: { $avg: "$samples.throughputKbps" },
                switchCount: { $size: "$switchEvents" }
            }
        },
        {
            $group: {
                _id: "$video",
                watchTimeMs: { $sum: "$totals.watchTimeMs" },
                downloadedBytes: { $sum: "$totals.downloadedBytes" },
                rebufferMs: { $sum: "$totals.rebufferMs" },
                avgBitrateKbps: { $avg: "$avgSampleBitrate" },
                avgThroughputKbps: { $avg: "$avgSampleThroughput" },
                switchEvents: { $sum: "$switchCount" }
            }
        }
    ])

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    windowMinutes: bucketMinutes,
                    summary: summary[0] || null
                },
                "Metrics fetched"
            )
        )
})

const handleEncodingCallback = asyncHandler(async (req, res) => {
    const { jobId } = req.params
    
    // Handle undefined req.body
    const body = req.body || {}
    const {
        status,
        progressPercent,
        workerNode,
        variants = [],
        masterManifests = {},
        error
    } = body

    if (!isValidObjectId(jobId)) {
        throw new ApiError(400, "Invalid job id")
    }

    const job = await EncodingJob.findById(jobId)
    if (!job) {
        throw new ApiError(404, "Encoding job not found")
    }

    // Update job status
    if (status) {
        job.status = status
    }
    if (typeof progressPercent === "number") {
        job.progressPercent = Math.max(0, Math.min(100, progressPercent))
    }
    if (workerNode) {
        job.workerNode = workerNode
    }
    if (error) {
        job.error = error
        job.status = "failed"
    }
    if (masterManifests && Object.keys(masterManifests).length) {
        job.masterManifests = masterManifests
    }
    job.lastHeartbeatAt = new Date()
    await job.save()

    // If encoding completed, update video variants
    if (status === "completed" && Array.isArray(variants) && variants.length > 0) {
        const bulkOps = variants.map((variant) => ({
            updateOne: {
                filter: {
                    _id: job.video,
                    "variants.label": variant.label || `${variant.profile}-${variant.container}`
                },
                update: {
                    $set: {
                        "variants.$.status": "ready",
                        "variants.$.manifestPath": variant.manifestPath || "",
                        "variants.$.segmentsPath": variant.segmentsPath || "",
                        "variants.$.storage": variant.storage || {},
                        "variants.$.avgBitrateKbps":
                            Number(variant.avgBitrateKbps || variant.bandwidthKbps || 0),
                        "variants.$.lastPublishedAt": new Date()
                    }
                }
            }
        }))

        if (bulkOps.length) {
            await Video.bulkWrite(bulkOps)
        }

        // Update master manifests
        if (masterManifests && Object.keys(masterManifests).length) {
            await Video.updateOne(
                { _id: job.video },
                {
                    $set: {
                        "playback.manifests": masterManifests,
                        "playback.defaultFormat": masterManifests?.hls?.path ? "hls" : "dash"
                    }
                }
            )
        }
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                jobId,
                status: job.status,
                progressPercent: job.progressPercent,
                videoId: job.video,
                message: status === "completed" ? "Encoding completed and variants updated" : "Encoding job updated"
            },
            "Encoding job updated successfully"
        )
    )
})

const getEncodingJobByVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const job = await EncodingJob.findOne({
        video: new mongoose.Types.ObjectId(videoId)
    })
        .sort({ createdAt: -1 })
        .lean()

    if (!job) {
        throw new ApiError(404, "Encoding job not found for this video")
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                jobId: job._id,
                videoId: job.video,
                status: job.status,
                progressPercent: job.progressPercent || 0,
                workerNode: job.workerNode,
                variantsRequested: job.variantsRequested?.length || 0,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt
            },
            "Encoding job fetched successfully"
        )
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    getVideoManifest,
    getSegmentSignedUrl,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
    recordVideoMetrics,
    getVideoMetrics,
    handleEncodingCallback,
    getEncodingJobByVideo
}