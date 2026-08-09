# Third-Party Notices

Last reviewed: 2026-08-09

The application code, prompts, schemas, tests, UI, and assets in this repository are an independent implementation. No source code or distinctive assets were copied from the reference projects named in the product brief.

The following direct runtime and development dependencies are installed from their official package registries without source modifications. Exact resolved JavaScript versions and transitive dependencies are recorded in `package-lock.json`; exact Python versions are recorded in the requirements files.

| Component | Source | Version | License | Affected area | Modifications |
| --- | --- | --- | --- | --- | --- |
| Fastify and official plugins | https://github.com/fastify | 5.x / lockfile versions | MIT | `apps/product-api` | None |
| Prisma Client and CLI | https://github.com/prisma/prisma | 6.16.2 | Apache-2.0 | PostgreSQL access and migrations | None |
| `@node-rs/argon2` | https://github.com/napi-rs/node-rs | 2.0.2 | MIT | Password hashing | None |
| Zod | https://github.com/colinhacks/zod | 4.x | MIT | API input validation | None |
| Vue | https://github.com/vuejs/core | 3.x | MIT | `apps/web` | None |
| Vue Router | https://github.com/vuejs/router | 4.x | MIT | Web routing | None |
| Pinia | https://github.com/vuejs/pinia | 3.x | MIT | Web state management | None |
| Apache ECharts | https://github.com/apache/echarts | 6.x | Apache-2.0 | Research chart | None |
| Vite / Vitest / TypeScript | Official npm packages | lockfile versions | MIT / Apache-2.0 | Build and tests | None |
| FastAPI | https://github.com/fastapi/fastapi | 0.141.1 | MIT | `apps/research-engine` | None |
| Pydantic | https://github.com/pydantic/pydantic | 2.13.4 | MIT | Python validation | None |
| Uvicorn | https://github.com/encode/uvicorn | 0.35.0 | BSD-3-Clause | Python ASGI runtime | None |
| HTTPX | https://github.com/encode/httpx | 0.28.1 | BSD-3-Clause | Python API tests | None |
| pytest | https://github.com/pytest-dev/pytest | 8.4.1 | MIT | Python tests | None |
| tzdata | https://github.com/python/tzdata | 2026.3 | Apache-2.0 | IANA timezone data on Windows | None |
| PostgreSQL container image | https://hub.docker.com/_/postgres | 16.6-alpine | PostgreSQL License | Docker Compose | None |
| Nginx container image | https://hub.docker.com/_/nginx | 1.28.0-alpine | BSD-2-Clause | Static Web runtime | Configuration only |

Required upstream license and NOTICE texts must be included in release artifacts. A generated SBOM and automated license policy check remain a release requirement; this human-maintained summary is not a substitute for the complete transitive inventory.
