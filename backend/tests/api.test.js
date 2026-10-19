process.env.NODE_ENV = 'test';
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
let mongod, app, admin, user;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = require('../src/app');
  await require('../src/models').Ticket.init();
  await require('../src/models').KBArticle.init();
});
afterAll(async () => { await mongoose.disconnect(); if (mongod) await mongod.stop(); });

test('register org admin + join as user', async () => {
  const a = await request(app).post('/api/auth/register').send({ name: 'Boss', email: 'boss@x.com', password: 'Password123!', orgName: 'Acme' });
  expect(a.status).toBe(201); expect(a.body.user.role).toBe('admin');
  admin = a.body.token;
  const org = await mongoose.model('Organization').findOne();
  const u = await request(app).post('/api/auth/register').send({ name: 'Sam', email: 'sam@x.com', password: 'Password123!', orgSlug: org.slug });
  expect(u.body.user.role).toBe('user'); user = u.body.token;
  expect((await request(app).post('/api/auth/login').send({ email: 'sam@x.com', password: 'wrong' })).status).toBe(401);
});
test('ticket lifecycle + role rules', async () => {
  const c = await request(app).post('/api/tickets').set('Authorization', 'Bearer ' + user).field('title', 'mera login nahi ho raha').field('description', 'password bhool gaya');
  expect(c.status).toBe(201); expect(c.body.category).toBe('Account'); expect(c.body.code).toMatch(/^TKT-0001$/);
  const id = c.body._id;
  expect((await request(app).post(`/api/tickets/${id}/status`).set('Authorization', 'Bearer ' + user).send({ status: 'resolved' })).status).toBe(403);
  expect((await request(app).post(`/api/tickets/${id}/status`).set('Authorization', 'Bearer ' + admin).send({ status: 'resolved' })).status).toBe(200);
  expect((await request(app).post(`/api/tickets/${id}/feedback`).set('Authorization', 'Bearer ' + user).send({ rating: 5 })).status).toBe(200);
  await request(app).post(`/api/tickets/${id}/comments`).set('Authorization', 'Bearer ' + admin).send({ body: 'secret', internal: true });
  const d = await request(app).get(`/api/tickets/${id}`).set('Authorization', 'Bearer ' + user);
  expect(d.body.comments.length).toBe(0); // internal note hidden from customer
  expect((await request(app).get('/api/analytics/agents').set('Authorization', 'Bearer ' + user)).status).toBe(403);
  const ov = await request(app).get('/api/analytics/overview').set('Authorization', 'Bearer ' + admin);
  expect(ov.body.total).toBe(1); expect(ov.body.csat.percent).toBe(100);
});
test('public tracking exposes only limited data', async () => {
  const r = await request(app).get('/api/public/track/tkt-0001');
  expect(r.status).toBe(200); expect(r.body.description).toBeUndefined(); expect(r.body.status).toBe('resolved');
});
test('NoSQL injection in query is ignored', async () => {
  const r = await request(app).get('/api/tickets?status[$ne]=x').set('Authorization', 'Bearer ' + admin);
  expect(r.status).toBe(200);
});
