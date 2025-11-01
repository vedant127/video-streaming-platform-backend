import mongoose , {Schema} from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId, //one who is subscribing
        ref: "user"
    } , 

    channel: {
        type: Schema.Types.ObjectId, //one whom to subscrber is subscribing
        ref: "user"
    } , 

    
} , {timestamps: true})


export const subscription = mongosse.model("subscription" , subscriptionSchema )