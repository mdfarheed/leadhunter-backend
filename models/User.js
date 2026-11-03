const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8, select: false },
  developerName: { type: String, trim: true, maxlength: 100, default: '' },
  // Accounts created before multi-user support have no role stored and are therefore admins. Users created from the Users page
  // always get role "user" explicitly.
  role: { type: String, enum: ['admin', 'user'], default: 'admin' },
  active: { type: Boolean, default: true },                // a disabled account cannot sign in and its tokens stop working
  city: { type: String, trim: true, maxlength: 100, default: 'Etah' }, // sender's own city, used as {{myCity}} in message templates
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tokenVersion: { type: Number, default: 0 }, // bump to invalidate every issued JWT (logout / password change)
}, { timestamps: true });

userSchema.pre('save', async function hash(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.methods.comparePassword = function compare(plain) { return bcrypt.compare(plain, this.password); };
userSchema.methods.toPublic = function toPublic() {
  return { id: this._id, name: this.name, email: this.email, developerName: this.developerName || this.name, city: this.city, role: this.role, active: this.active !== false };
};

module.exports = mongoose.model('User', userSchema);
