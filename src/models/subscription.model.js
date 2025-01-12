import mongoose, {Schema} from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    channel: {
        type: Schema.Types.ObjectId,    //channel is the user who is being subscribed to
        ref: "User"
    }
}, {timestamps: true})

export const Subscription = mongoose.model(("Subscription", subscriptionSchema))