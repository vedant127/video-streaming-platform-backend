import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from  "mongoose-aggregate-paginate-v2";


const videoSchema = new Schema(
    {
        videofile: {
            type: String,
            required: true
        },
        thumbnail: {
            type: String,
            required: true
        },
        tittle: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        duration: {
            type: Number,
            required: true
        },
        views: {
            type: Number,
            default: 0
        },
        isPublish: {
            type: Boolean,
            default: true
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "user",
            required: true
        },
        storage: {
            ingestionOrigin: String,
            cdnPlaybackBaseUrl: String,
            defaultCdn: String
        },
        playback: {
            defaultFormat: {
                type: String,
                enum: ["hls", "dash"],
                default: "hls"
            },
            manifests: {
                hls: {
                    path: String,
                    version: {
                        type: Number,
                        default: 0
                    }
                },
                dash: {
                    path: String,
                    version: {
                        type: Number,
                        default: 0
                    }
                }
            }
        },
        variants: [
            {
                profile: String,
                label: String,
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
                segmentDurationSeconds: Number,
                manifestPath: String,
                segmentsPath: String,
                storage: {
                    bucket: String,
                    playlistKey: String,
                    segmentPrefix: String,
                    cdnBaseUrl: String
                },
                status: {
                    type: String,
                    enum: ["pending", "processing", "ready", "failed"],
                    default: "pending"
                },
                avgBitrateKbps: {
                    type: Number,
                    default: 0
                },
                switchCount: {
                    type: Number,
                    default: 0
                },
                lastPublishedAt: Date
            }
        ],
        analytics: {
            totalWatchTimeMs: {
                type: Number,
                default: 0
            },
            totalBytesDelivered: {
                type: Number,
                default: 0
            },
            totalRebufferMs: {
                type: Number,
                default: 0
            },
            peakThroughputKbps: {
                type: Number,
                default: 0
            },
            lastSessionId: {
                type: String,
                default: null
            },
            lastVariantProfile: {
                type: String,
                default: null
            },
            sessions: {
                type: Number,
                default: 0
            }
        }
    },
    {
        timestamps: true
    }
)

videoSchema.plugin(mongooseAggregatePaginate)

export const Video = mongoose.model("video", videoSchema)
