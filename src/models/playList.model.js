import mongoose , {Schema} from "mongoose";
import { Video } from "./video.model.js";

const playlistSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    videos: [
      {
        type: Schema.Types.ObjectId,
        ref: "video"
      }
    ],
    owner: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true
    }
  },
  { timestamps: true }
)


export const Playlist = mongoose.model("playlist" , playlistSchema)

