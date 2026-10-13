# Deployment

Local orchestration for the **recreated** system. Nothing here touches the
legacy services.

## Host port map (all new; legacy ports are not reused)

| Service | Host port | Container port |
| --- | --- | --- |
| Backend (modular monolith) | 8100 | 8100 |
| App frontend | 8101 | 8101 |
| system_info API | 8810 | 8810 |
| system_info UI | 8820 | 8820 |
| MongoDB | 27018 | 27017 |

## Run

```bash
cd architecture_updated_system
export JWT_SECRET="$(openssl rand -hex 32)"
export MASTER_KEY="$(openssl rand -hex 32)"
docker compose -f deployment/docker-compose.yml up --build
```

- **App:**          http://127.0.0.1:8101
- **System info:**  http://127.0.0.1:8820
- **Backend docs:** http://127.0.0.1:8100/docs

The `system-info-backend` mounts the legacy tree **read-only** at `/legacy`
(override with `LEGACY_ROOT`). It can read source files but cannot write to them;
only environment **variable names** are exposed.

## Security notes

- Every published host port is bound to `127.0.0.1` only.
- `JWT_SECRET` / `MASTER_KEY` are required and have no defaults; the compose file
  fails fast if they are unset.
- The scanner container receives the legacy tree as a **read-only** mount.
