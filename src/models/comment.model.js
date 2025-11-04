import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from  "mongoose-aggregate-paginate-v2";
import { Video } from "./video.model.js";

const commentSchema = new Schema(
    {
       content: {
          type: String , 
          required: true,
          trim: true
       }, 
       video :{
            type: Schema.Types.ObjectId,
            ref: "video",
            required: true
       },
         owner: {
            type: Schema.Types.ObjectId,
            ref: "user",
            required: true
         }
         
        } , 
         
        {
            timestamps: true
        }
)



commentSchema.plugin(mongooseAggregatePaginate)

export const Comment = mongoose.model("comment" , commentSchema)