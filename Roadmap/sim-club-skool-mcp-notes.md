# SIM Club Skool MCP Notes

Fecha de captura: 2026-06-16

## Objetivo

Documentar el flujo usado para revisar respuestas pendientes en SIM Club mediante el MCP local de Skool, proponer respuestas simples y publicar solo las confirmadas.

## Configuracion Local Observada

- MCP local: `skool-mcp`
- Script MCP: `C:\Users\madgarcijd\OneDrive - JT International\Documents\Github Cloned Repos\skool-mcp\dist\index.js`
- Config MCP: `C:\Users\madgarcijd\OneDrive - JT International\Documents\Github Cloned Repos\skool-mcp\config.json`
- Cuenta SIM Club: `dagarluen`
- Comunidad: `sim-club`
- Group ID SIM Club: `31c4f3a103704e43a516c0ba431d0d3f`
- Usuario propio detectado: `David Garcia`
- User ID propio: `fe8109e9dadc46d68b3a86c3ecaf7ce2`

No guardar cookies, auth tokens ni valores sensibles en el repositorio.

## Herramientas MCP Utiles

- `skool_community_info`: confirma acceso, `self`, `currentGroup`, `groupId`, datos de perfil y contador `metadata.notifs`.
- `skool_posts_list`: lista posts de la comunidad.
- `skool_posts_get`: trae el post principal, aunque no siempre trae comentarios cargados dinamicamente.
- `skool_posts_vote`: da like a posts o comentarios. Es idempotente: si ya existe like devuelve `skipped`.
- `skool_posts_comment`: comenta o responde via browser/Playwright. Evita parte del bloqueo de CloudFront/WAF.
- `skool_request`: permite hacer GET autenticados a `www.skool.com` y `api2.skool.com`. Funciono bien para lectura.

## Endpoints Descubiertos

### Notificaciones

Endpoint real usado por el frontend:

```text
GET https://api2.skool.com/self/notifications?limit=30&type=group&group={group_id}
```

Campos utiles:

- `messages`
- `has_more`
- `cursor`
- `type`
- En cada mensaje, `metadata.data` contiene JSON con:
  - `action`
  - `display_name`
  - `text`
  - `content`
  - `post_id`
  - `root_post_id`
  - `link_as`
  - `group_id`

Acciones relevantes para respuestas:

- `mention-comment`
- textos como `mentioned you in reply`

### Comentarios De Un Post

Endpoint usado para verificar si ya se habia respondido:

```text
GET https://api2.skool.com/posts/{root_post_id}/comments?group-id={group_id}&tail=true&limit=30
```

Tambien existe:

```text
GET https://api2.skool.com/posts/{root_post_id}/comments/links/{comment_prefix}?group-id={group_id}&limit=30
```

Notas:

- `limit=50` falla con `invalid limit: 50`.
- `limit=30` funciona.
- El endpoint puede devolver objetos de usuario y comentarios mezclados, asi que hay que filtrar por objetos con `metadata.content` y `user_id` o `userId`.

## Criterio Para Pendientes

1. Leer notificaciones recientes de SIM Club.
2. Filtrar menciones o replies hacia el usuario.
3. Para cada `mention-comment`, cargar comentarios del `root_post_id`.
4. Encontrar el comentario objetivo por `post_id`.
5. Considerar pendiente si no hay comentario posterior del `self_id` en ese hilo/post.
6. Excluir respuestas sociales ya contestadas o donde no tenga sentido duplicar.

## Limitaciones Encontradas

- `skool_notifications` devolvio redirect a `/` y no fue util para listar notificaciones.
- `www.skool.com/notifications` cargo HTML, pero el `__NEXT_DATA__` correspondia a Discover/Home, no a la bandeja real.
- `skool_posts_get` no siempre trae comentarios porque Skool los carga dinamicamente.
- `skool_posts_comment` puede fallar al buscar snippets con emojis o acentos, mostrando timeouts de Playwright.
- El helper `buildSkoolPostUrl` codifica `?p=` dentro del slug, asi que `postSlug: "avatar-ia-listo?p=..."` no abre el hilo seleccionado.
- Las llamadas directas `POST https://api2.skool.com/posts` con `skool_request` fueron bloqueadas por CloudFront `403`; para escribir conviene usar el flujo browser.
- Si el snippet coincide con otro comentario cercano, el browser puede publicar como comentario top-level o en el parent incorrecto. Verificar despues con `comments?tail=true`.

## Workaround Browser Directo

Para hilos que el MCP no encuentra por snippet, funciono usar Playwright directamente con las cookies del config local y abrir la URL real:

```text
https://www.skool.com/sim-club/{post_slug}?p={comment_prefix}
```

Luego:

1. Esperar carga.
2. Buscar un snippet ASCII visible, por ejemplo `llegando a casa`.
3. Hacer hover sobre el comentario.
4. Pulsar el boton `Reply` mas cercano.
5. Escribir al final del contenteditable.
6. Pulsar el boton `REPLY` mas cercano al cuadro.
7. Verificar con `api2.skool.com/posts/{root}/comments?group-id={group_id}&tail=true&limit=30`.

## Ronda De Respuestas Del 2026-06-16

Se detectaron 5 pendientes iniciales. El usuario confirmo publicar el 2 y ajustar 3, 4 y 5.

Publicadas:

- `Vamooos, ahi seguimos sumando`
  - Post: `/sim-club/ayuda-para-subir-de-level?p=c5670480`
  - Nota: quedo como comentario en el post, no como reply exacta al comentario con fuego. No se duplico para no ensuciar el hilo.
- `Quizas no se comparten los mensajes anteriores, puedes contactar a Lamin o Alex`
  - Post: `/sim-club/reto-semanal-founders-del-briefing-a-propuesta-con-nuestro-workflow?p=6e365db2`
  - Skool anadio mencion automatica a Guille.
- `Crack!`
  - Post: `/sim-club/avatar-ia-listo?p=aa78b2c9`
  - Skool anadio mencion automatica a Vik.
- `:)))))`
  - Post: `/sim-club/avatar-ia-listo?p=3230e508`
  - Skool anadio mencion automatica a Felipe porque el helper eligio ese parent en el hilo visible.

No publicado:

- Pendiente 1 de Santiago Manrique: el usuario no lo confirmo.

## Recomendaciones Operativas

- Antes de comentar posts nuevos, consultar notificaciones con `self/notifications`.
- Dar like al comentario objetivo con `skool_posts_vote` antes de responder.
- Para propuestas, mantener respuestas simples y naturales.
- Para publicar, preferir `skool_posts_comment`; si falla por snippet, usar Playwright directo con URL `?p=`.
- Verificar siempre con `comments?tail=true&limit=30` despues de publicar.
- Evitar duplicar si el comentario ya quedo publicado aunque sea top-level.

## Fuentes

- MCP local `skool-mcp`.
- SIM Club via cuenta `dagarluen`.
- API de lectura `api2.skool.com/self/notifications`.
- API de lectura `api2.skool.com/posts/{root_post_id}/comments`.
