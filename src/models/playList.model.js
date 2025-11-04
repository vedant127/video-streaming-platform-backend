import mongoose , {Schema} from "mongoose";
import { video } from "./video.model";

const playlistSchema = new Schema ({
    
    name: {
        type: String,
        required: true
    },

    description: {
        type: true , 
        require: true
    },

    videos: [{
        type: Schema.Types.ObjectId,
        ref: "video"
    }

],

   owner : {
     type: Schema.Types.ObjectId,
     ref: "users"
     
   },

    
    
    timestamps: true

   }
)


export const playlist = mongoose.model("playlist" , playlistSchema)

