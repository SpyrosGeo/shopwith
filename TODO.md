# TODO

## Auth
- [ ] Rate-limit `POST /api/auth/login` with `@fastify/rate-limit` before deploying (password guessing is unlimited now)
- [ ] Password reset
- [ ] Email verification on register
- [ ] Delete expired sessions (rows stay in `Session` after `expiresAt`)
