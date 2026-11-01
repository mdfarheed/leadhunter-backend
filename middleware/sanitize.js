// Strips keys beginning with "$" or containing "." from body/query/params (NoSQL operator injection).
const clean = (o) => {
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) {
      if (k.startsWith('$') || k.includes('.')) delete o[k];
      else o[k] = clean(o[k]);
    }
  }
  return o;
};
module.exports = (req, res, next) => {
  ['body', 'params', 'query'].forEach((k) => req[k] && clean(req[k]));
  next();
};
