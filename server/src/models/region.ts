import mongoose, { Schema } from 'mongoose';

export interface RegionDocument {
  code: string;
  name: string;
  level: 'national' | 'state' | 'region';
  parent_code?: string;
}

const RegionMongooseSchema = new Schema<RegionDocument>(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    level: {
      type: String,
      required: true,
      enum: ['national', 'state', 'region'],
      index: true,
    },
    parent_code: { type: String },
  },
  { collection: 'regions', versionKey: false },
);

export const RegionModel = mongoose.model<RegionDocument>('Region', RegionMongooseSchema);
