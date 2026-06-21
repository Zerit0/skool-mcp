import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { nextDataRequest, api2Request } from "../client.js";
import { loadConfig } from "../config.js";
import { tiptapToMarkdown } from "../tiptap.js";

const accountParam = z.string().optional().describe("Account name from config (e.g. 'piqueran'). Uses defaultAccount if omitted.");

// ── Types ──────────────────────────────────────────────────────────────────────

interface SkoolResource {
  title?: string;
  file_id?: string;
  file_name?: string;
  file_content_type?: string;
  link?: string;
}

interface MuxVideo {
  id: string;
  playbackId?: string;
  playbackToken?: string;
  duration?: number;
  aspectRatio?: string;
  status?: string;
}

interface RawModule {
  id: string;
  name: string;
  metadata: {
    title?: string;
    desc?: string;
    videoId?: string;
    resources?: string;
    numModules?: number;
  };
  createdAt?: string;
  updatedAt?: string;
  state?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function parseResources(raw: unknown): SkoolResource[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? (parsed as SkoolResource[]) : [];
}

function resourcesToMarkdown(resources: SkoolResource[], groupId: string): string {
  if (resources.length === 0) return "";
  const lines = resources.map((r) => {
    if (r.link) return `- 🔗 [${r.title ?? r.link}](${r.link})`;
    if (r.file_id) {
      const url = `https://assets.skool.com/f/${groupId}/${r.file_id}`;
      return `- 📄 [${r.title ?? r.file_name ?? r.file_id}](${url})`;
    }
    return `- ${r.title ?? "Unknown resource"}`;
  });
  return `\n## Resources\n\n${lines.join("\n")}\n`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function sanitizeFilename(title: string): string {
  return title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").replace(/\s+/g, "_").slice(0, 80);
}

// Fetch classroom data for a specific module, handling Next.js app-level redirects.
async function classroomRequest(
  community: string,
  courseSlug: string,
  moduleId?: string,
  account?: string,
): Promise<Record<string, unknown>> {
  const params: Record<string, string> = { group: community, course: courseSlug };
  if (moduleId) params.md = moduleId;

  const data = await nextDataRequest(
    `/${community}/classroom/${courseSlug}`,
    params,
    account,
  ) as Record<string, unknown>;

  if (data.__N_REDIRECT) {
    const redirectUrl = new URL(asString(data.__N_REDIRECT) ?? "", "https://www.skool.com");
    const redirectModuleId = redirectUrl.searchParams.get("md");
    if (!redirectModuleId) throw new Error("Could not extract module ID from classroom redirect");
    return classroomRequest(community, courseSlug, redirectModuleId, account);
  }

  return data;
}

function extractPageProps(data: Record<string, unknown>): Record<string, unknown> {
  const props = (data as { pageProps?: Record<string, unknown> }).pageProps;
  if (!props) throw new Error("No pageProps in classroom response");
  return props;
}

function extractModuleList(props: Record<string, unknown>): RawModule[] {
  const course = isRecord(props.course) ? props.course : null;
  if (!course) throw new Error("No course object in pageProps");
  const children = Array.isArray(course.children) ? course.children : [];
  return children.map((child: unknown) => {
    const c = isRecord(child) && isRecord(child.course) ? child.course as unknown as RawModule : null;
    if (!c) throw new Error("Unexpected course children shape");
    return c;
  });
}

function extractMuxVideo(props: Record<string, unknown>): MuxVideo | undefined {
  const v = isRecord(props.video) ? props.video : null;
  if (!v) return undefined;
  return {
    id: asString(v.id) ?? "",
    playbackId: asString(v.playbackId),
    playbackToken: asString(v.playbackToken),
    duration: asNumber(v.duration),
    aspectRatio: asString(v.aspectRatio),
    status: asString(v.status),
  };
}

function extractCourseTitle(props: Record<string, unknown>): string {
  const course = isRecord(props.course) && isRecord((props.course as Record<string, unknown>).course)
    ? (props.course as Record<string, unknown>).course as Record<string, unknown>
    : null;
  return asString(course?.metadata && isRecord(course.metadata) ? course.metadata.title : undefined) ?? "";
}

function extractGroupId(props: Record<string, unknown>): string {
  const group = isRecord(props.currentGroup) ? props.currentGroup : null;
  return asString(group?.id) ?? "";
}

function buildLessonMarkdown(args: {
  mod: RawModule;
  moduleIndex: number;
  moduleTotal: number;
  courseTitle: string;
  video: MuxVideo | undefined;
  resources: SkoolResource[];
  groupId: string;
  community: string;
  courseSlug: string;
}): string {
  const { mod, moduleIndex, moduleTotal, courseTitle, video, resources, groupId, community, courseSlug } = args;
  const title = mod.metadata.title ?? mod.name;
  const url = `https://www.skool.com/${community}/classroom/${courseSlug}?md=${mod.id}`;

  const parts: string[] = [];

  // Frontmatter
  parts.push(`---
title: ${JSON.stringify(title)}
module_id: "${mod.id}"
module_index: ${moduleIndex + 1}
module_total: ${moduleTotal}
course: ${JSON.stringify(courseTitle)}
community: "${community}"
has_video: ${Boolean(video || mod.metadata.videoId)}
extracted_at: "${new Date().toISOString()}"
---

`);

  // Title
  parts.push(`# ${title}\n\n`);

  // Meta line
  const metaParts = [`**Course:** ${courseTitle}`, `**Module:** ${moduleIndex + 1} of ${moduleTotal}`];
  if (video) {
    const dur = video.duration ? ` (${formatDuration(video.duration)})` : "";
    metaParts.push(`**Video:** Skool/Mux${dur}`);
  } else if (mod.metadata.videoId) {
    metaParts.push(`**Video:** Skool/Mux (details require direct page load)`);
  }
  parts.push(metaParts.join("  \n") + "\n\n---\n\n");

  // Content
  const desc = mod.metadata.desc;
  if (desc) {
    parts.push(tiptapToMarkdown(desc) + "\n\n");
  }

  // Resources
  parts.push(resourcesToMarkdown(resources, groupId));

  // Source footer
  parts.push(`\n---\n\n*Source: ${url}*  \n`);

  return parts.join("");
}

// ── Tools ──────────────────────────────────────────────────────────────────────

export const coursesListTool = {
  name: "skool_courses_list",
  description:
    "List courses in a community classroom. Returns course names and metadata.",
  inputSchema: {
    community: z.string().optional().describe("Community slug. Uses default from config if omitted."),
    groupId: z.string().optional().describe("Group UUID — if provided, uses api2.skool.com for richer data"),
    account: accountParam,
  },
  async handler(args: { community?: string; groupId?: string; account?: string }) {
    if (args.groupId) {
      const result = await api2Request(`/groups/${args.groupId}/courses`, { account: args.account });
      return JSON.stringify(result, null, 2);
    }

    const config = await loadConfig(args.account);
    const slug = args.community || config.defaultCommunity;
    if (!slug) throw new Error("No community specified and no defaultCommunity in config");

    const data = (await nextDataRequest(`/${slug}/classroom`, {
      group: slug,
    }, args.account)) as { pageProps?: Record<string, unknown> };

    const props = data?.pageProps;
    if (!props) throw new Error("No pageProps in response");

    return JSON.stringify(props, null, 2);
  },
};

export const lessonsListTool = {
  name: "skool_lessons_list",
  description:
    "List lessons/modules in a specific course. Uses the Next.js classroom data route with course parameter.",
  inputSchema: {
    community: z.string().optional().describe("Community slug. Uses default from config if omitted."),
    courseSlug: z.string().describe("The course slug/name to list lessons for"),
    account: accountParam,
  },
  async handler(args: { community?: string; courseSlug: string; account?: string }) {
    const config = await loadConfig(args.account);
    const slug = args.community || config.defaultCommunity;
    if (!slug) throw new Error("No community specified and no defaultCommunity in config");

    const data = (await nextDataRequest(`/${slug}/classroom/${args.courseSlug}`, {
      group: slug,
      course: args.courseSlug,
    }, args.account)) as { pageProps?: Record<string, unknown> };

    const props = data?.pageProps;
    if (!props) throw new Error("No pageProps in response");

    return JSON.stringify(props, null, 2);
  },
};

export const lessonGetTool = {
  name: "skool_lesson_get",
  description:
    "Get the full content of a single Classroom lesson as Markdown. Returns title, text content, video metadata, and resources. Requires the course slug and module ID (both from skool_courses_list / skool_lessons_list).",
  inputSchema: {
    community: z.string().optional().describe("Community slug. Uses default from config if omitted."),
    courseSlug: z.string().describe("Course slug (hex, e.g. 'e22d16af'). From skool_courses_list metadata.name."),
    moduleId: z.string().describe("Module/lesson ID (hex UUID). From skool_lessons_list course.children[].course.id."),
    account: accountParam,
  },
  async handler(args: { community?: string; courseSlug: string; moduleId: string; account?: string }) {
    const config = await loadConfig(args.account);
    const community = args.community || config.defaultCommunity;
    if (!community) throw new Error("No community specified and no defaultCommunity in config");

    const data = await classroomRequest(community, args.courseSlug, args.moduleId, args.account);
    const props = extractPageProps(data);
    const modules = extractModuleList(props);
    const video = extractMuxVideo(props);
    const courseTitle = extractCourseTitle(props);
    const groupId = extractGroupId(props);

    const moduleIndex = modules.findIndex((m) => m.id === args.moduleId);
    const mod = modules[moduleIndex];
    if (!mod) throw new Error(`Module ${args.moduleId} not found in course response`);

    const resources = parseResources(mod.metadata.resources);
    const markdown = buildLessonMarkdown({
      mod,
      moduleIndex,
      moduleTotal: modules.length,
      courseTitle,
      video,
      resources,
      groupId,
      community,
      courseSlug: args.courseSlug,
    });

    return JSON.stringify({
      title: mod.metadata.title ?? mod.name,
      moduleId: mod.id,
      moduleIndex: moduleIndex + 1,
      moduleTotal: modules.length,
      courseTitle,
      hasVideo: Boolean(video || mod.metadata.videoId),
      video: video ?? (mod.metadata.videoId ? { id: mod.metadata.videoId } : null),
      resourceCount: resources.length,
      markdownContent: markdown,
      url: `https://www.skool.com/${community}/classroom/${args.courseSlug}?md=${mod.id}`,
    }, null, 2);
  },
};

export const courseExportTool = {
  name: "skool_course_export",
  description:
    "Export all lessons in a Classroom course to Markdown files on disk. Creates one .md file per lesson plus a course_index.json. Fetches each lesson individually so may take several seconds for large courses.",
  inputSchema: {
    community: z.string().optional().describe("Community slug. Uses default from config if omitted."),
    courseSlug: z.string().describe("Course slug (hex, e.g. 'e22d16af'). From skool_courses_list metadata.name."),
    outputDir: z.string().optional().describe("Directory to save exported files. Defaults to ~/skool-exports/{community}/{courseSlug}/"),
    account: accountParam,
  },
  async handler(args: { community?: string; courseSlug: string; outputDir?: string; account?: string }) {
    const config = await loadConfig(args.account);
    const community = args.community || config.defaultCommunity;
    if (!community) throw new Error("No community specified and no defaultCommunity in config");

    // Step 1: get module list by fetching any page of the course
    const listData = await classroomRequest(community, args.courseSlug, undefined, args.account);
    const listProps = extractPageProps(listData);
    const modules = extractModuleList(listProps);
    const courseTitle = extractCourseTitle(listProps);
    const groupId = extractGroupId(listProps);

    if (modules.length === 0) throw new Error("No modules found in course");

    // Step 2: prepare output directory
    const outputDir = args.outputDir
      ?? join(homedir(), "skool-exports", community, args.courseSlug);
    await mkdir(outputDir, { recursive: true });

    // Step 3: iterate modules, fetch content for each, save
    const exportedFiles: string[] = [];
    const index: object[] = [];

    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      const title = mod.metadata.title ?? mod.name;

      // Fetch this specific module to get desc + video
      const modData = await classroomRequest(community, args.courseSlug, mod.id, args.account);
      const modProps = extractPageProps(modData);

      // Re-extract the module from this response (its desc/video are now populated)
      const modModules = extractModuleList(modProps);
      const modFull = modModules.find((m) => m.id === mod.id) ?? mod;
      const video = extractMuxVideo(modProps);
      const resources = parseResources(modFull.metadata.resources);

      const markdown = buildLessonMarkdown({
        mod: modFull,
        moduleIndex: i,
        moduleTotal: modules.length,
        courseTitle,
        video,
        resources,
        groupId,
        community,
        courseSlug: args.courseSlug,
      });

      const filename = `${String(i + 1).padStart(2, "0")}_${sanitizeFilename(title)}.md`;
      const filepath = join(outputDir, filename);
      await writeFile(filepath, markdown, "utf-8");
      exportedFiles.push(filepath);

      index.push({
        index: i + 1,
        filename,
        title,
        moduleId: mod.id,
        hasVideo: Boolean(video || modFull.metadata.videoId),
        videoId: video?.id ?? modFull.metadata.videoId ?? null,
        muxPlaybackId: video?.playbackId ?? null,
        durationMs: video?.duration ?? null,
        resourceCount: resources.length,
        url: `https://www.skool.com/${community}/classroom/${args.courseSlug}?md=${mod.id}`,
      });
    }

    // Step 4: save index
    const indexPath = join(outputDir, "course_index.json");
    await writeFile(
      indexPath,
      JSON.stringify({
        courseTitle,
        courseSlug: args.courseSlug,
        community,
        groupId,
        moduleCount: modules.length,
        exportedAt: new Date().toISOString(),
        modules: index,
      }, null, 2),
      "utf-8",
    );

    return JSON.stringify({
      success: true,
      courseTitle,
      moduleCount: modules.length,
      outputDir,
      files: [...exportedFiles, indexPath],
    }, null, 2);
  },
};
