import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IFavorite extends Document<Types.ObjectId> {
  customerId: Types.ObjectId;
  workerId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const favoriteSchema = new Schema<IFavorite>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

favoriteSchema.index({ customerId: 1, workerId: 1 }, { unique: true });

export const Favorite: Model<IFavorite> =
  (mongoose.models.Favorite as Model<IFavorite>) || mongoose.model<IFavorite>("Favorite", favoriteSchema);

export default Favorite;
