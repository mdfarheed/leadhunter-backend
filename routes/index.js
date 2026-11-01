const express = require('express');
const rateLimit = require('express-rate-limit');
const v = require('../validators');
const { protect } = require('../middleware/auth');
const auth = require('../controllers/authController');
const dash = require('../controllers/dashboardController');
const places = require('../controllers/placesController');
const leads = require('../controllers/leadController');
const tpl = require('../controllers/templateController');
const act = require('../controllers/activityController');
const hist = require('../controllers/searchHistoryController');
const exp = require('../controllers/exportController');
const settings = require('../controllers/settingsController');
const cats = require('../controllers/categoryController');

const r = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many login attempts. Try again in 15 minutes.' } });
const placesLimiter = rateLimit({ windowMs: 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many Google searches. Slow down for a minute.' } });

// public
r.post('/auth/login', loginLimiter, v.login, auth.login);

// everything below requires a valid JWT
r.use(protect);
r.post('/auth/logout', auth.logout);
r.get('/auth/me', auth.me);
r.post('/auth/change-password', v.changePassword, auth.changePassword);

r.get('/dashboard/stats', dash.stats);
r.get('/dashboard/charts', dash.charts);
r.get('/dashboard/recent-activity', dash.recentActivity);

r.post('/places/text-search', placesLimiter, v.textSearch, places.textSearch);
r.post('/places/nearby-search', placesLimiter, v.nearbySearch, places.nearbySearch);
r.post('/places/resolve-city', placesLimiter, places.resolveCity);
r.get('/places/details/:placeId', placesLimiter, v.placeDetails, places.details);
r.get('/places/usage', places.usage);
r.get('/places/test', placesLimiter, places.test);

r.get('/leads', leads.list);
r.get('/leads/meta', leads.meta);
r.post('/leads', v.leadCreate, leads.create);
r.post('/leads/bulk-update', v.leadBulk, leads.bulkUpdate);
r.get('/leads/:id', v.idParam, leads.get);
r.put('/leads/:id', v.leadUpdate, leads.update);
r.delete('/leads/:id', v.idParam, leads.remove);
r.patch('/leads/:id/status', v.leadStatus, leads.setStatus);

r.get('/templates', tpl.list);
r.post('/templates', v.templateCreate, tpl.create);
r.put('/templates/:id', v.templateUpdate, tpl.update);
r.delete('/templates/:id', v.idParam, tpl.remove);
r.patch('/templates/:id/default', v.idParam, tpl.setDefault);

r.get('/activities', act.list);
r.post('/activities', v.activityCreate, act.create);
r.get('/activities/:leadId', act.byLead);

r.get('/search-history', hist.list);
r.post('/search-history', v.searchHistoryCreate, hist.create);
r.delete('/search-history/:id', v.idParam, hist.remove);
r.delete('/search-history', hist.clear);

r.get('/categories', cats.list);
r.post('/categories', v.category, cats.create);
r.put('/categories/:id', v.categoryUpdate, cats.update);
r.delete('/categories/:id', v.idParam, cats.remove);

r.get('/export/leads', exp.json);
r.get('/export/leads/csv', exp.csv);
r.get('/export/leads/excel', exp.excel);

r.get('/settings', settings.get);
r.put('/settings', v.settingsUpdate, settings.update);

module.exports = r;
