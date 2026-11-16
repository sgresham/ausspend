import mongoose, { Schema } from 'mongoose';

export interface FunctionDocument {
  code: string;
  name: string;
  level: 'division' | 'subdivision';
  parent_code?: string;
}

const FunctionMongooseSchema = new Schema<FunctionDocument>(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    level: {
      type: String,
      required: true,
      enum: ['division', 'subdivision'],
      index: true,
    },
    parent_code: { type: String, index: true },
  },
  { collection: 'functions', versionKey: false },
);

export const FunctionModel = mongoose.model<FunctionDocument>('Function', FunctionMongooseSchema);
