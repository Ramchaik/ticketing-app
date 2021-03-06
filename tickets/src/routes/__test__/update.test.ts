import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../app';
import { Ticket } from '../../models/ticket';
import { natsWrapper } from '../../nats-wrapper';
import { getRandomIdHexString } from './utils/genericUtils';

it('returns a 404 if provided id does not exits', async () => {
  const id = getRandomIdHexString();
  await request(app)
    .put(`/api/tickets/${id}`)
    .set('Cookie', global.signin())
    .send({
      title: 'alskdf',
      price: 32,
    })
    .expect(404);
});

it('returns a 401 if user is not authenticated', async () => {
  const id = getRandomIdHexString();
  await request(app)
    .put(`/api/tickets/${id}`)
    .send({
      title: 'alskdf',
      price: 32,
    })
    .expect(401);
});

it('returns a 401 if user does not own the ticket', async () => {
  const response = await request(app)
    .post(`/api/tickets`)
    .set('Cookie', global.signin())
    .send({
      title: 'alskdf',
      price: 32,
    });

  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set('Cookie', global.signin())
    .send({
      title: 'Hello',
      price: 30,
    })
    .expect(401);
});

it('returns a 400 if user provides invalid title or price', async () => {
  const cookie = global.signin();

  const response = await request(app)
    .post(`/api/tickets`)
    .set('Cookie', cookie)
    .send({
      title: 'alskdf',
      price: 32,
    });

  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set('Cookie', cookie)
    .send({
      title: '',
      price: 30,
    })
    .expect(400);

  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set('Cookie', cookie)
    .send({
      title: 'Hello',
      price: -30,
    })
    .expect(400);
});

it('updates the ticket provided valid inputs', async () => {
  const cookie = global.signin();

  const response = await request(app)
    .post(`/api/tickets`)
    .set('Cookie', cookie)
    .send({
      title: 'alskdf',
      price: 32,
    });

  const updatedTicket = {
    title: 'Hello',
    price: 30,
  };

  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set('Cookie', cookie)
    .send(updatedTicket)
    .expect(200);

  const ticketResponse = await request(app)
    .get(`/api/tickets/${response.body.id}`)
    .send({});

  expect(ticketResponse.body.title).toEqual(updatedTicket.title);
  expect(ticketResponse.body.price).toEqual(updatedTicket.price);
});

it('publish an event', async () => {
  const cookie = global.signin();

  const response = await request(app)
    .post(`/api/tickets`)
    .set('Cookie', cookie)
    .send({
      title: 'alskdf',
      price: 32,
    });

  const updatedTicket = {
    title: 'Hello',
    price: 30,
  };

  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set('Cookie', cookie)
    .send(updatedTicket)
    .expect(200);

  expect(natsWrapper.client.publish).toHaveBeenCalled();
});

it('rejects update if ticket is reserved ', async () => {
  const cookie = global.signin();

  const response = await request(app)
    .post(`/api/tickets`)
    .set('Cookie', cookie)
    .send({
      title: 'alskdf',
      price: 32,
    });

  const ticket = await Ticket.findById(response.body.id);

  ticket!.set({ orderId: mongoose.Types.ObjectId().toHexString() });
  ticket!.save();

  const updatedTicket = {
    title: 'Hello',
    price: 30,
  };

  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set('Cookie', cookie)
    .send(updatedTicket)
    .expect(400);
});
