export const DB_NAME = "videotube"

export const TRANSCODE_PROFILES = [
    {
        id: "240p",
        width: 426,
        height: 240,
        bitrateKbps: 400,
        codec: "h264",
        containers: ["hls", "dash"],
        hlsSegmentDuration: 6,
        dashSegmentDuration: 4
    },
    {
        id: "360p",
        width: 640,
        height: 360,
        bitrateKbps: 800,
        codec: "h264",
        containers: ["hls", "dash"],
        hlsSegmentDuration: 6,
        dashSegmentDuration: 4
    },
    {
        id: "480p",
        width: 854,
        height: 480,
        bitrateKbps: 1400,
        codec: "h264",
        containers: ["hls", "dash"],
        hlsSegmentDuration: 6,
        dashSegmentDuration: 4
    },
    {
        id: "720p",
        width: 1280,
        height: 720,
        bitrateKbps: 2800,
        codec: "h264",
        containers: ["hls", "dash"],
        hlsSegmentDuration: 6,
        dashSegmentDuration: 4
    },
    {
        id: "1080p",
        width: 1920,
        height: 1080,
        bitrateKbps: 5200,
        codec: "h264",
        containers: ["hls", "dash"],
        hlsSegmentDuration: 6,
        dashSegmentDuration: 4
    }
]

export const DEFAULT_MANIFEST_FORMATS = ["hls", "dash"]
export const DEFAULT_SEGMENT_LENGTH_SECONDS = 6
export const SIGNED_URL_TTL_SECONDS = Number(process.env.SIGNED_URL_TTL_SECONDS || 900)