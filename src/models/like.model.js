import mongoose , {Schema} from "mongoose";
import { Video } from "./video.model.js";
import { Comment } from "./comment.model.js";

const likeschema = new Schema ({
    
    video: {
        type: Schema.Types.ObjectId,
        ref: "video"
    },
       comment: {
             type: Schema.Types.ObjectId,
              ref: "comment"
       },

       tweet: {
        type: Schema.Types.ObjectId,
        ref: "Tweet"
       },

       likedby : {
        type: Schema.Types.ObjectId,
        ref: "likedby"
       }
} , 

  {
    
    timestamps: true
  
})


export const Like = mongoose.model("like" , likeschema)