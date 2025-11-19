import mongoose, { Schema } from "mongoose"

const streamingSessionSchema = new Schema(
    {
        video: {
            type: Schema.Types.ObjectId,
            ref: "video",
            required: true,
            index: true
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: "user"
        },
        sessionId: {
            type: String,
            required: true,
            unique: true
        },
        avgThroughputKbps: {
            type: Number,
            default: 0
        },
        lastVariantProfile: String,
        lastBitrateKbps: Number,
        switchHistory: [
            {
                fromProfile: String,
                toProfile: String,
                throughputKbps: Number,
                reason: String,
                timestamp: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        rebufferEvents: {
            type: Number,
            default: 0
        },
        networkSamples: [
            {
                throughputKbps: Number,
                latencyMs: Number,
                downloadedBytes: Number,
                timestamp: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        startedAt: {
            type: Date,
            default: Date.now
        },
        terminatedAt: Date,
        lastClientMeta: {
            device: String,
            playerVersion: String,
            cdnEdge: String
        }
    },
    {
        timestamps: true
    }
)

streamingSessionSchema.index({ video: 1, sessionId: 1 })

export const StreamingSession = mongoose.model("streamingSession", streamingSessionSchema)

