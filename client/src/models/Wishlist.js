/*
 When a user wishlists an event:
    1. The event _id is pushed into savedEvents.
    2. A "wishlist" row is written to interactions.csv
 */

import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type    : String,
      required: true,
      unique  : true,
      index   : true,
    },
    savedEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref : 'Event',
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.Wishlist ||
  mongoose.model('Wishlist', wishlistSchema);