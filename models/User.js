const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8, select: false },
  developerName: { type: String, trim: true, maxlength: 100, default: '' },
  role: { type: String, enum: ['admin'], default: 'admin' },
  tokenVersion: { type: Number, default: 0 }, // bump to invalidate every issued JWT (logout / password change)
}, { timestamps: true });

userSchema.pre('save', async function hash(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.methods.comparePassword = function compare(plain) { return bcrypt.compare(plain, this.password); };
userSchema.methods.toPublic = function toPublic() {
  return { id: this._id, name: this.name, email: this.email, developerName: this.developerName, role: this.role };
};

module.exports = mongoose.model('User', userSchema);
