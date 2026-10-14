import mongoose from 'mongoose';

export class MongoLoginLimitStore {
  init(options) {
    this.windowMs = options.windowMs;
  }
  async increment(key) {
    const now = new Date();
    const collection = mongoose.connection.db.collection('login_limits');
    const expired = { $lte: [{ $ifNull: ['$resetTime', new Date(0)] }, now] };
    const update = [
      {
        $set: {
          hits: { $cond: [expired, 1, { $add: ['$hits', 1] }] },
          resetTime: { $cond: [expired, new Date(Date.now() + this.windowMs), '$resetTime'] },
        },
      },
    ];
    let record;
    try {
      record = await collection.findOneAndUpdate({ _id: key }, update, {
        upsert: true,
        returnDocument: 'after',
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      record = await collection.findOneAndUpdate({ _id: key }, update, { returnDocument: 'after' });
    }
    return { totalHits: record.hits, resetTime: record.resetTime };
  }
  async decrement(key) {
    await mongoose.connection.db
      .collection('login_limits')
      .updateOne({ _id: key, hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }
  async resetKey(key) {
    await mongoose.connection.db.collection('login_limits').deleteOne({ _id: key });
  }
}
