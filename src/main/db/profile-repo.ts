import { desc, eq } from 'drizzle-orm';
import { extractMetrics } from '@shared/metrics';
import {
  profileSchema,
  type Profile,
  type ProfileVersionInfo,
  type SavedProfile,
} from '@shared/schemas/profile';
import { ulid } from '../ids';
import type { Db } from './open';
import { profileVersions } from './schema';

type Row = typeof profileVersions.$inferSelect;

export interface SourceFile {
  name: string;
  path: string;
  sha256: string;
}

function toInfo(row: Row): ProfileVersionInfo {
  return {
    version: row.version,
    note: row.note,
    createdAt: row.createdAt,
    sourceName: row.sourceName,
  };
}

/** Re-derives every bullet's metrics from its text, so they can never drift from what's written. */
export function withMetrics(profile: Profile): Profile {
  const bullets = <T extends { text: string; metrics: string[] }>(items: T[]): T[] =>
    items.map((item) => ({ ...item, metrics: extractMetrics(item.text) }));
  return {
    ...profile,
    experiences: profile.experiences.map((e) => ({ ...e, bullets: bullets(e.bullets) })),
    projects: profile.projects.map((p) => ({ ...p, bullets: bullets(p.bullets) })),
  };
}

export function createProfileRepo(db: Db, clock: () => Date = () => new Date()) {
  const { orm } = db;

  function toSaved(row: Row): SavedProfile {
    return { ...toInfo(row), profile: profileSchema.parse(JSON.parse(row.data)) };
  }

  return {
    current(): SavedProfile | null {
      const row = orm.select().from(profileVersions).orderBy(desc(profileVersions.version)).get();
      return row ? toSaved(row) : null;
    },

    version(version: number): SavedProfile | null {
      const row = orm
        .select()
        .from(profileVersions)
        .where(eq(profileVersions.version, version))
        .get();
      return row ? toSaved(row) : null;
    },

    list(): ProfileVersionInfo[] {
      return orm
        .select()
        .from(profileVersions)
        .orderBy(desc(profileVersions.version))
        .all()
        .map(toInfo);
    },

    /** Saves a new immutable version. Returns it. */
    save(profile: Profile, note?: string, source?: SourceFile): SavedProfile {
      const data = withMetrics(profileSchema.parse(profile));
      const latest = orm
        .select({ version: profileVersions.version })
        .from(profileVersions)
        .orderBy(desc(profileVersions.version))
        .get();
      const version = (latest?.version ?? 0) + 1;
      const row = {
        id: ulid(),
        version,
        data: JSON.stringify(data),
        note: note && note !== '' ? note : null,
        sourceName: source?.name ?? null,
        sourcePath: source?.path ?? null,
        sourceSha256: source?.sha256 ?? null,
        createdAt: clock().toISOString(),
      };
      orm.insert(profileVersions).values(row).run();
      return toSaved(row);
    },
  };
}

export type ProfileRepo = ReturnType<typeof createProfileRepo>;
