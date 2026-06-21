# Skool MCP — Revisión, Roadmap y Estrategia de Descarga/Transcripción

Fecha: 2026-06-14  
Autor/contexto: Consolidado de análisis para un MCP personal/fork local orientado a Skool.

---

## 1. Objetivo del proyecto

El objetivo es evolucionar un MCP para Skool desde un prototipo básico hacia un sistema de:

- Administración autorizada de comunidades Skool.
- Extracción y backup de contenido.
- Sincronización de Community, Classroom, Members, Calendar y recursos.
- Descarga autorizada de vídeos cuando sea legal y técnicamente permitido.
- Transcripción automática de vídeos.
- Generación de resúmenes, capítulos, tareas y FAQs.
- Indexación en una Knowledge Base consultable por agentes.

El nombre recomendado para el proyecto sería:

**Skool Admin & Knowledge MCP**

No se recomienda plantearlo como “control total” agresivo, sino como **control operativo autorizado** sobre comunidades, cursos y contenido propio o con permiso.

---

## 2. Funcionalidades principales de Skool a cubrir

Skool agrupa funcionalidades en áreas como Community, Classroom, Calendar, Leaderboards, Discovery, Payments, Billing, Roles/Admins, Plugins y Affiliate.

### 2.1 Community

Funcionalidades deseables para MCP:

- Listar posts.
- Buscar posts.
- Leer post completo.
- Crear post.
- Editar post.
- Borrar post.
- Fijar/desfijar post.
- Mover post de categoría.
- Listar comentarios.
- Responder comentarios.
- Editar/borrar comentarios.
- Detectar preguntas sin responder.
- Exportar posts y comentarios.
- Crear resúmenes semanales.
- Detectar temas recurrentes.
- Crear FAQs desde discusiones.

Tools propuestas:

```text
skool.community.list_posts
skool.community.get_post
skool.community.search_posts
skool.community.create_post
skool.community.update_post
skool.community.delete_post
skool.community.pin_post
skool.community.move_post
skool.community.list_comments
skool.community.reply_to_post
skool.community.export_posts
skool.community.unanswered_questions
```

---

### 2.2 Classroom

Skool Classroom permite organizar cursos, guías, recursos, documentos, vídeos, plantillas, lecciones y transcripciones.

Funcionalidades deseables:

- Listar cursos.
- Obtener árbol de curso.
- Leer lecciones.
- Exportar páginas a Markdown/JSON.
- Descargar recursos autorizados.
- Detectar vídeos.
- Añadir transcripciones.
- Crear lecciones.
- Editar lecciones.
- Publicar/despublicar lecciones.
- Reordenar módulos.
- Backup completo de cursos.

Tools propuestas:

```text
skool.classroom.list_courses
skool.classroom.get_course_tree
skool.classroom.list_lessons
skool.classroom.get_lesson
skool.classroom.get_lesson_markdown
skool.classroom.create_lesson
skool.classroom.update_lesson
skool.classroom.publish_lesson
skool.classroom.unpublish_lesson
skool.classroom.list_resources
skool.classroom.download_resource
skool.classroom.export_course
skool.classroom.export_all
skool.classroom.add_transcript
```

---

### 2.3 Members / CRM

Funcionalidades deseables:

- Listar miembros.
- Buscar miembro.
- Ver perfil.
- Aprobar/rechazar solicitudes.
- Invitar miembros.
- Eliminar/banear miembros.
- Cambiar roles.
- Ver actividad.
- Ver progreso.
- Exportar miembros.
- Detectar inactivos.
- Segmentar miembros.
- Sincronizar con CRM externo.

Tools propuestas:

```text
skool.members.list
skool.members.search
skool.members.get_profile
skool.members.pending
skool.members.approve
skool.members.reject
skool.members.invite
skool.members.remove
skool.members.ban
skool.members.update_role
skool.members.get_activity
skool.members.get_course_access
skool.members.unlock_course
skool.members.revoke_course
skool.members.detect_inactive
skool.members.export
```

---

### 2.4 Calendar

Tools propuestas:

```text
skool.calendar.list_events
skool.calendar.get_event
skool.calendar.create_event
skool.calendar.update_event
skool.calendar.delete_event
skool.calendar.export_ics
skool.calendar.create_event_recap
```

---

### 2.5 Leaderboards / Gamificación

Tools propuestas:

```text
skool.leaderboard.get
skool.leaderboard.top_members
skool.leaderboard.member_rank
skool.leaderboard.level_unlocks
skool.analytics.engagement_by_member
```

---

### 2.6 Payments / Billing

Recomendación: empezar en modo **solo lectura**.

Tools propuestas:

```text
skool.payments.get_pricing
skool.payments.list_subscriptions
skool.payments.list_cancellations
skool.payments.list_failed_payments
skool.payments.list_payouts
skool.payments.revenue_snapshot
```

---

### 2.7 Plugins / Integrations

Tools propuestas:

```text
skool.plugins.list
skool.plugins.get_settings
skool.plugins.update_settings
skool.webhooks.list
skool.webhooks.create
skool.zapier.invite_member
skool.zapier.unlock_course
```

---

## 3. Revisión del MCP actual: `louiewoof2026/skool-mcp`

Repositorio revisado:

```text
https://github.com/louiewoof2026/skool-mcp
```

### 3.1 Qué hace actualmente

El MCP actual es un MVP funcional que:

- Está hecho en TypeScript.
- Usa MCP SDK.
- Funciona por transporte stdio.
- Usa cookies manuales de Skool desde un fichero local.
- Lee datos mediante rutas `/_next/data/{buildId}/...`.
- Escribe contra `https://api2.skool.com`.
- Expone herramientas para:
  - Community info.
  - Community labels.
  - Members list.
  - Pending members.
  - Approve/reject members.
  - Posts list.
  - Get post.
  - Create post.
  - Comment on post.
  - Courses list.
  - Lessons list.
  - Notifications.
  - Request genérico.

El README declara explícitamente que Skool no tiene API pública y que el MCP usa endpoints internos reverse-engineered.

### 3.2 Valoración

El proyecto es un buen punto de partida como **explorador inicial de Skool**, pero todavía no es suficiente para el objetivo de “Skool Admin & Knowledge MCP”.

Está bien para:

- Experimentar con rutas internas.
- Leer posts.
- Crear posts.
- Comentar.
- Listar miembros.
- Aprobar/rechazar miembros.
- Leer parte del Classroom.

No está bien todavía para:

- Control administrativo seguro.
- Exportación completa.
- Knowledge Base.
- Descarga de vídeos.
- Transcripción.
- Auditoría.
- Multi-comunidad robusto.
- Persistencia.
- Normalización de datos.

---

## 4. Problemas críticos detectados en el MCP actual

### 4.1 Riesgo de fuga de cookies en `skool_request`

El MCP tiene una herramienta genérica que permite hacer requests a cualquier URL e inyecta automáticamente cookies de Skool.

Riesgo:

```text
Si un agente o prompt injection manda una URL externa,
las cookies podrían salir fuera de Skool.
```

Modificación recomendada:

```ts
const ALLOWED_HOSTS = new Set([
  "www.skool.com",
  "api2.skool.com"
]);

function assertAllowedSkoolUrl(input: string) {
  const url = new URL(input);

  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed");
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`Blocked non-Skool host: ${url.hostname}`);
  }
}
```

Y aplicar esta validación dentro de `rawRequest` antes del `fetch`.

---

### 4.2 Acciones de escritura sin confirmación

Actualmente acciones como:

```text
skool_posts_create
skool_posts_comment
skool_members_approve
skool_members_reject
```

pueden ejecutarse directamente.

Recomendación:

- Añadir `dryRun`.
- Añadir `confirm`.
- Exigir confirmación explícita para cualquier acción que escriba o modifique.

Ejemplo:

```ts
inputSchema: {
  ...
  dryRun: z.boolean().default(true),
  confirm: z.boolean().default(false)
}
```

Regla:

```ts
if (!args.confirm) {
  return JSON.stringify({
    dryRun: true,
    action: "Would create post",
    payload
  }, null, 2);
}
```

---

### 4.3 Falta audit log

Cada acción importante debería registrarse.

Formato mínimo:

```text
~/.config/skool-mcp/audit.log
```

Campos:

```text
timestamp
tool_name
group_id
community_slug
actor_session_hash
action_type
input_hash
status
error
```

---

### 4.4 Outputs demasiado crudos

Muchas herramientas devuelven directamente `pageProps` con `JSON.stringify`.

Eso sirve para exploración, pero no para un agente robusto.

Se recomienda normalizar entidades:

```ts
type NormalizedPost = {
  id: string;
  slug: string;
  title: string;
  author: string;
  createdAt?: string;
  updatedAt?: string;
  commentCount?: number;
  likeCount?: number;
  category?: string;
  url: string;
};
```

Entidades a crear:

```text
NormalizedPost
NormalizedComment
NormalizedMember
NormalizedCourse
NormalizedLesson
NormalizedVideo
NormalizedEvent
```

---

### 4.5 Naming inconsistente

El README documenta tools con puntos:

```text
skool.posts.list
skool.members.list
skool.community.info
```

Pero el código usa nombres con underscore:

```text
skool_posts_list
skool_members_list
skool_community_info
```

Recomendación: elegir una convención única.

Preferencia:

```text
skool.posts.list
skool.posts.get
skool.members.list
skool.classroom.courses.list
```

---

### 4.6 Falta rate limiting, retries y timeout

Añadir:

```text
timeout por request
retry con backoff
rate limit por host
concurrency limit
circuit breaker
detección 401/403
detección CloudFront 403
```

---

### 4.7 Auth débil

El MCP actual usa cookies copiadas manualmente desde DevTools.

Para uso serio añadir:

```text
skool.auth.check
skool.auth.whoami
skool.auth.validate_permissions
skool.auth.refresh_status
skool.auth.logout
```

Y soporte para:

```text
variables de entorno
config path configurable
secret manager local
cifrado de cookies
perfiles multi-cuenta
perfiles multi-comunidad
allowedGroups
scopes
```

Ejemplo:

```json
{
  "profiles": {
    "default": {
      "cookies": "...",
      "defaultCommunity": "...",
      "baseUrl": "https://www.skool.com",
      "allowedGroups": ["..."],
      "scopes": [
        "read:community",
        "read:classroom",
        "write:posts"
      ]
    }
  }
}
```

---

## 5. Arquitectura propuesta del MCP evolucionado

Estructura sugerida:

```text
skool-mcp/
  src/
    auth/
      session_manager.ts
      cookies_vault.ts
      permissions.ts

    connectors/
      skool_official_zapier.ts
      skool_webhook.ts
      skool_browser_playwright.ts
      skool_email_parser.ts

    tools/
      auth.tools.ts
      community.tools.ts
      classroom.tools.ts
      members.tools.ts
      calendar.tools.ts
      payments.tools.ts
      leaderboard.tools.ts
      analytics.tools.ts
      video.tools.ts
      transcript.tools.ts
      knowledgebase.tools.ts

    pipelines/
      sync_community.ts
      sync_classroom.ts
      sync_members.ts
      detect_videos.ts
      download_videos.ts
      transcribe_videos.ts
      index_knowledge.ts
      daily_digest.ts

    storage/
      postgres.ts
      object_storage.ts
      vector_index.ts

    safety/
      rate_limits.ts
      audit_log.ts
      tos_guardrails.ts
      confirmations.ts
```

---

## 6. Persistencia y Knowledge Base

Para convertir Skool en una Knowledge Base hace falta persistencia.

Opciones:

```text
SQLite para MVP local
Postgres para versión seria
pgvector o Qdrant para búsqueda semántica
S3/R2/local disk para assets, vídeos y audios
```

Tablas mínimas:

```sql
groups
members
posts
comments
courses
lessons
resources
videos
transcripts
events
leaderboards
payments_snapshots
activity_snapshots
sync_runs
audit_log
embeddings
```

Tools KB:

```text
skool.kb.sync_all
skool.kb.sync_community
skool.kb.sync_classroom
skool.kb.sync_members
skool.kb.sync_videos
skool.kb.search
skool.kb.ask
skool.kb.reindex
skool.kb.generate_faq
skool.kb.generate_sop
skool.kb.weekly_digest
```

---

## 7. Exportación de contenido

Se recomienda añadir exports estructurados:

```text
skool.export.community
skool.export.posts
skool.export.comments
skool.export.classroom
skool.export.members
skool.export.calendar
skool.export.leaderboard
skool.export.all
```

Formatos:

```text
JSON
Markdown
CSV
HTML
ZIP local
```

Estructura recomendada:

```text
exports/
  group-slug/
    community/
      posts.json
      posts.md
      comments.json
    classroom/
      course-1/
        course.json
        lesson-1.md
        lesson-1.assets/
    members/
      members.csv
      members.json
    videos/
      metadata.json
    transcripts/
      lesson-1.transcript.json
      lesson-1.summary.md
```

Opciones de exportación:

```ts
{
  since?: string;
  includeComments?: boolean;
  includeMembers?: boolean;
  includeClassroom?: boolean;
  includeAssets?: boolean;
  includeVideos?: "metadata_only" | "authorized_download";
  outputDir?: string;
}
```

---

## 8. Revisión de `serpapps/skool-downloader`

Repositorio revisado:

```text
https://github.com/serpapps/skool-downloader
```

### 8.1 Qué es

Es una extensión de navegador para descargar vídeos desde páginas de Skool.

Según su README:

- Añade un botón de descarga en páginas de Skool.
- Detecta vídeos de:
  - Skool native player.
  - Loom.
  - Vimeo.
  - YouTube.
  - Wistia.
- Guarda vídeos como MP4.
- Funciona en classrooms, community posts y about pages.
- Permite elegir calidad.
- Tiene cola de descargas.
- No tiene bulk download de curso entero todavía.
- No hace transcripción.
- Tiene licencia propietaria SERP Apps.

### 8.2 Qué aporta al MCP

Aporta como referencia funcional:

```text
Mapa de proveedores soportados.
UX de detección in-browser.
Confirmación de que los vídeos de Skool pueden estar repartidos entre varios proveedores.
Idea de que a veces hay que pulsar play para detectar streams.
```

Tabla:

| Necesidad del MCP | ¿Ayuda? | Comentario |
|---|---:|---|
| Detectar vídeos en Classroom | Sí | Es su función principal. |
| Detectar vídeos en posts | Sí | Declarado por el README. |
| Detectar Skool native player | Sí | Punto fuerte del producto. |
| Detectar Loom/Vimeo/YouTube/Wistia | Sí | Muy relevante para el MCP. |
| Elegir calidad | Sí | Útil como referencia de UX. |
| Descargar MP4 | Sí | Conceptualmente sí. |
| Bulk download | No | El propio README dice que no todavía. |
| Transcripción | No | No incluye pipeline de transcripción. |
| Integración MCP directa | No | Es extensión, no librería/CLI. |
| Código reutilizable libremente | No claro | Licencia propietaria. |

### 8.3 Conclusión sobre uso del código

No se recomienda copiar ni integrar directamente código de ese repo porque:

- No parece contener claramente el código fuente completo de la extensión.
- No se encontró un `manifest.json` típico en raíz.
- El README indica licencia propietaria.
- Está planteado como producto/extensión, no como paquete open-source reutilizable.

Conclusión:

```text
No usar como dependencia central.
No copiar código propietario.
Sí usar como benchmark funcional.
Sí replicar funcionalidad con implementación propia.
```

---

## 9. Descarga autorizada de vídeos

El MCP debería implementar su propia capa:

```text
skool.videos.list
skool.videos.detect
skool.videos.get_download_options
skool.videos.download_authorized
skool.videos.extract_audio
```

Pipeline:

```text
1. Leer lesson/post autorizado.
2. Abrir página con Playwright si es necesario.
3. Detectar iframes, tags video y network requests.
4. Clasificar proveedor:
   - skool_native
   - loom
   - vimeo
   - youtube
   - wistia
5. Obtener opciones de calidad.
6. Descargar solo si está permitido/autorizado.
7. Guardar metadata.
8. Pasar a transcripción.
```

Implementación conceptual:

```ts
type VideoProvider =
  | "skool_native"
  | "loom"
  | "vimeo"
  | "youtube"
  | "wistia"
  | "unknown";

type DetectedVideo = {
  provider: VideoProvider;
  pageUrl: string;
  embedUrl?: string;
  streamUrl?: string;
  title?: string;
  durationSeconds?: number;
  qualities?: Array<{
    label: string;
    url?: string;
  }>;
};
```

---

## 10. Transcripción de vídeos

El repo `serpapps/skool-downloader` no resuelve transcripción. Hay que crear una capa propia.

Tools:

```text
skool.transcripts.create
skool.transcripts.summarize
skool.transcripts.chapterize
skool.transcripts.extract_actions
skool.transcripts.push_to_classroom
```

Pipeline:

```text
MP4
  ↓
ffmpeg extrae audio
  ↓
faster-whisper o WhisperX
  ↓
transcript con timestamps
  ↓
resumen
  ↓
capítulos
  ↓
acciones/tareas
  ↓
keywords
  ↓
guardar en DB
  ↓
indexar en vector DB
  ↓
opcional: subir transcript al classroom
```

Formato ideal:

```json
{
  "video_id": "abc",
  "title": "Clase 1 - Introducción",
  "duration": 3420,
  "language": "en",
  "transcript_segments": [
    {
      "start": 0.0,
      "end": 12.4,
      "speaker": "Speaker 1",
      "text": "Welcome to..."
    }
  ],
  "summary": "...",
  "chapters": [
    {
      "start": 0,
      "title": "Introduction"
    }
  ],
  "actions": [],
  "keywords": []
}
```

Stack recomendado:

```text
ffmpeg
faster-whisper
WhisperX
Python worker opcional
Node/TypeScript MCP orchestration
Postgres/SQLite
pgvector/Qdrant
```

---

## 11. Límites legales y de seguridad

El MCP debe operar solo con:

```text
contenido propio
contenido de comunidades donde eres owner/admin
contenido con autorización expresa
contenido cuya descarga permita el proveedor
transcripciones para uso interno autorizado
```

No implementar:

```text
bypass de DRM
bypass de paywalls
evasión de access controls
descarga de cursos de terceros sin permiso
reutilización de código propietario sin licencia
extracción de DMs sin consentimiento
automatización que viole términos o privacidad
```

---

## 12. Roadmap recomendado

### Fase 0 — Hardening inmediato

```text
1. Bloquear URLs externas en skool_request.
2. Añadir confirm/dryRun a escrituras.
3. Añadir audit log.
4. Añadir timeouts/retries/rate limit.
5. Normalizar errores.
6. Corregir naming README vs código.
7. Añadir scopes/permisos.
```

### Fase 1 — Exportador Knowledge Base

```text
skool.export.posts
skool.export.comments
skool.export.classroom
skool.export.members
skool.kb.sync_all
skool.kb.search
skool.kb.ask
```

### Fase 2 — Classroom completo

```text
get_lesson
get_course_tree
export_course
download_resources
markdown conversion
asset extraction
course tree
lesson metadata
```

### Fase 3 — Vídeos y transcripción

```text
list_videos
detect_provider
authorized_download
extract_audio
transcribe
summarize
chapters
push_transcript
```

### Fase 4 — Admin avanzado

```text
calendar
leaderboards
payments read-only
plugins
member segmentation
churn risk
unanswered questions
weekly digest
```

---

## 13. Prompt para Codex / agente desarrollador

```text
Build a TypeScript MCP server called skool-mcp for authorized administration and knowledge-base extraction from a Skool community.

The MCP must be modular and safe-by-design.

Core requirements:

1. Provide tools for read-only extraction of Skool Community posts, comments, categories, Classroom courses, folders, pages, resources, calendar events, and members.

2. Use official integrations where available: Zapier/webhooks for invitations, membership questions, and course unlocking.

3. Use Playwright only for authenticated browser automation where no official API is available.

4. Never bypass paywalls, DRM, video protections, or access controls.

5. Include permission scopes:
   - read:community
   - write:community
   - read:classroom
   - write:classroom
   - read:members
   - write:members
   - read:payments
   - download:resources
   - download:videos
   - transcribe:videos

6. Every write/destructive action must require explicit confirmation and be logged.

7. Store extracted data in Postgres or SQLite with tables for groups, members, posts, comments, courses, lessons, resources, videos, transcripts, events, sync_runs, embeddings and audit_log.

8. Export Classroom pages and posts as Markdown and JSON.

9. Add a transcription pipeline:
   - detect authorized videos
   - download only when permitted
   - extract audio using ffmpeg
   - transcribe using faster-whisper or WhisperX
   - generate transcript, summary, chapters, action items, and keywords
   - store transcript in database
   - optionally add transcript back to the Skool lesson if the user confirms

10. Add knowledge-base indexing using pgvector or Qdrant.

11. Provide MCP tools:
   - skool.auth.check
   - skool.community.info
   - skool.community.labels
   - skool.community.list_posts
   - skool.community.get_post
   - skool.community.search_posts
   - skool.community.export_posts
   - skool.classroom.list_courses
   - skool.classroom.get_course_tree
   - skool.classroom.get_lesson
   - skool.classroom.export_course
   - skool.classroom.add_transcript
   - skool.members.list
   - skool.members.search
   - skool.members.invite
   - skool.members.unlock_course
   - skool.calendar.list_events
   - skool.video.list_videos
   - skool.video.detect
   - skool.video.download_authorized
   - skool.video.extract_audio
   - skool.transcripts.create
   - skool.transcripts.summarize
   - skool.kb.sync_all
   - skool.kb.ask
   - skool.analytics.unanswered_questions
   - skool.analytics.community_health

12. Include rate limiting, retry logic, structured logging, and screenshots for Playwright failures.

13. Block arbitrary external URLs from receiving Skool cookies. Only allow:
   - https://www.skool.com
   - https://api2.skool.com

14. Add dryRun and confirm flags to all write operations.

15. Write a README explaining setup, environment variables, legal/permission assumptions, and examples of MCP tool calls.

Do not implement any functionality that bypasses Skool access controls or downloads third-party content without authorization.
```

---

## 14. Veredicto final

El MCP actual `louiewoof2026/skool-mcp` merece ser **forkeado y evolucionado**, no necesariamente reescrito desde cero.

Pero antes de añadir funcionalidades avanzadas, hay que hacer hardening:

```text
URL allowlist
confirm/dryRun
audit log
rate limit
normalización
scopes
auth check
naming consistente
```

El repo `serpapps/skool-downloader` **sí ayuda como referencia funcional** para descarga de vídeos, especialmente por el mapa de proveedores:

```text
Skool native
Loom
Vimeo
YouTube
Wistia
```

Pero no debe copiarse ni integrarse como código base porque:

```text
no parece contener fuente completo claramente reutilizable
es una extensión/producto
declara licencia propietaria
no hace transcripción
no ofrece API/CLI/MCP directa
```

La dirección correcta es:

```text
Fork local del MCP actual
  ↓
Hardening
  ↓
Exportador Knowledge Base
  ↓
Classroom completo
  ↓
Detector propio de vídeos
  ↓
Descarga autorizada
  ↓
ffmpeg + WhisperX/faster-whisper
  ↓
Transcripts + summaries + chapters
  ↓
Indexación semántica
  ↓
Admin analytics
```
