import mongoose from "mongoose";

const eventRatingSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

eventRatingSchema.index({ userId: 1, eventId: 1 }, { unique: true });
eventRatingSchema.index({ eventId: 1, createdAt: -1 });

export default mongoose.models.EventRating ||
  mongoose.model("EventRating", eventRatingSchema);
