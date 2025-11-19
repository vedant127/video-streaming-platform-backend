import mongoose, { Schema } from "mongoose"

const videoMetricSchema = new Schema(
    {
        video: {
            type: Schema.Types.ObjectId,
            ref: "video",
            required: true,
            index: true
        },
        sessionId: {
            type: String,
            required: true
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: "user"
        },
        samples: [
            {
                timestamp: {
                    type: Date,
                    default: Date.now
                },
                bitrateKbps: Number,
                throughputKbps: Number,
                bufferMs: Number
            }
        ],
        switchEvents: [
            {
                timestamp: {
                    type: Date,
                    default: Date.now
                },
                fromProfile: String,
                toProfile: String,
                reason: String,
                throughputKbps: Number
            }
        ],
        segmentMetrics: [
            {
                variantProfile: String,
                segmentIndex: Number,
                downloadDurationMs: Number,
                sizeBytes: Number,
                transferRateKbps: Number
            }
        ],
        totals: {
            watchTimeMs: {
                type: Number,
                default: 0
            },
            downloadedBytes: {
                type: Number,
                default: 0
            },
            rebufferMs: {
                type: Number,
                default: 0
            }
        }
    },
    {
        timestamps: true
    }
)

videoMetricSchema.index({ video: 1, sessionId: 1 }, { unique: true })

export const VideoMetric = mongoose.model("videoMetric", videoMetricSchema)

