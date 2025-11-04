import mongoose , {Schema} from "mongoose";
import { video } from "./video.model";
import { comment } from "./comment.model";

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


export const like = mongoose.model("like" , likeschema)