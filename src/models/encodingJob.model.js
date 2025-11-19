import mongoose, { Schema } from "mongoose"

const encodingJobSchema = new Schema(
    {
        video: {
            type: Schema.Types.ObjectId,
            ref: "video",
            required: true
        },
        status: {
            type: String,
            enum: ["queued", "processing", "completed", "failed"],
            default: "queued",
            index: true
        },
        priority: {
            type: String,
            enum: ["low", "normal", "high"],
            default: "normal"
        },
        sourceUrl: {
            type: String,
            required: true
        },
        thumbnailUrl: {
            type: String
        },
        variantsRequested: [
            {
                profile: String,
                container: {
                    type: String,
                    enum: ["hls", "dash"],
                    default: "hls"
                },
                bandwidthKbps: Number,
                resolution: {
                    width: Number,
                    height: Number
                },
                codec: String,
                segmentDurationSeconds: Number
            }
        ],
        workerNode: {
            type: String
        },
        progressPercent: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        error: {
            code: String,
            message: String,
            stack: String
        },
        callbacks: {
            successUrl: String,
            failureUrl: String
        },
        masterManifests: {
            hls: {
                path: String,
                version: Number
            },
            dash: {
                path: String,
                version: Number
            }
        },
        resultMetadata: {
            segmentsUploaded: Number,
            durationSeconds: Number
        },
        lastHeartbeatAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
)

encodingJobSchema.index({ video: 1, status: 1 })
encodingJobSchema.index({ updatedAt: -1 })

export const EncodingJob = mongoose.model("encodingJob", encodingJobSchema)

