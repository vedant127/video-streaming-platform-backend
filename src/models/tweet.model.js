import mongoose , {Schema} from "mongoose";


const tweerSchema = new Schema (
    
    {
    
    content: {
        type: String,
        require: true
    },

    owner: {
        type: Schema.Types.ObjectId,
        ref: "users"
    },
    
    timestamps: true
   }
)



export const Tweet = mongoose.model("Tweet" , tweerSchema)