import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from  "mongoose-aggregate-paginate-v2";
import { video } from "./video.model";

const commentSchema = new Schema(
    {
       content: {
          type: String , 
          require: true
       }, 
       video :{
            type: Schema.Types.ObjectId,
            ref: "video"
       },
         owner: {
            type: Schema.Types.ObjectId,
            ref: "users"
         }
         
        } , 
         
        {
            timestamps: true
        }
)



commentSchema.plugin(mongooseAggregatePaginate)

export const comment = mongoose.model("comment" , commentSchema)