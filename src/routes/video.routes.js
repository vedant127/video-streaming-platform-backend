import { Router } from 'express';
import {
    deleteVideo,
    getAllVideos,
    getSegmentSignedUrl,
    getVideoById,
    getVideoManifest,
    getVideoMetrics,
    publishAVideo,
    recordVideoMetrics,
    togglePublishStatus,
    updateVideo,
    handleEncodingCallback
} from "../controllers/video.controller.js"
import { verifyJwt } from "../middlewares/auth.middlewares.js"
import {upload} from "../middlewares/multer.middleware.js"

const router = Router();
router.use(verifyJwt); // Apply verifyJWT middleware to all routes in this file

router
    .route("/")
    .get(getAllVideos)
    .post(
        upload.fields([
            {
                name: "videoFile",
                maxCount: 1,
            },
            {
                name: "thumbnail",
                maxCount: 1,
            },
            
        ]),
        publishAVideo
    );

router.get("/:videoId/manifest", getVideoManifest)
router.get("/:videoId/segments/:variantLabel/:segmentName", getSegmentSignedUrl)
router
    .route("/:videoId/metrics")
    .get(getVideoMetrics)
    .post(recordVideoMetrics)

router
    .route("/:videoId")
    .get(getVideoById)
    .delete(deleteVideo)
    .patch(upload.single("thumbnail"), updateVideo);

router.route("/toggle/publish/:videoId").patch(togglePublishStatus);
router.route("/encoding/callback/:jobId").post(handleEncodingCallback);

export default router