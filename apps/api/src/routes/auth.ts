import { IdentityError, type TenantId } from '@saas/contracts';
import { loginUser } from '@saas/identity';
import type { FastifyInstance } from 'fastify';

export function authRoutes(app: FastifyInstance): void {
  app.post(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'tenantId'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
            tenantId: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const { email, password, tenantId } = req.body as {
        email: string;
        password: string;
        tenantId: string;
      };
      const db = req.server.db;
      if (db === undefined) {
        return reply.code(503).send({ error: 'Service unavailable' });
      }
      try {
        const token = await loginUser(
          email,
          password,
          tenantId as TenantId,
          db,
        );
        return reply.send({ token });
      } catch (err) {
        if (err instanceof IdentityError) {
          return reply.code(401).send({ error: 'Invalid credentials' });
        }
        throw err;
      }
    },
  );
}
