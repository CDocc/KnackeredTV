const Database = require('better-sqlite3' /* webpackIgnore: true */);
const CryptoJS = require('crypto-js' /* webpackIgnore: true */);
const { app } = require('electron' /* webpackIgnore: true */);
const path = require('path' /* webpackIgnore: true */);

const ENCRYPTION_KEY = 'knackeredtv-default-key'; // In production, use a secure key

class DatabaseManager {
  private db: any;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'knackeredtv.db');
  }

  async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.createTables();
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error}`);
    }
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        serverUrl TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        m3uUrl TEXT,
        userAgent TEXT,
        createdAt INTEGER NOT NULL,
        lastUsed INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playback_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        contentId TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        watched INTEGER DEFAULT 0,
        lastPlayedAt INTEGER NOT NULL,
        UNIQUE(type, contentId)
      )
    `);

    const historyColumns = this.db.prepare('PRAGMA table_info(playback_history)').all() as any[];
    if (!historyColumns.some((c) => c.name === 'meta')) {
      this.db.exec('ALTER TABLE playback_history ADD COLUMN meta TEXT');
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS favorites (
        profileId TEXT NOT NULL,
        kind TEXT NOT NULL,
        itemId TEXT NOT NULL,
        data TEXT NOT NULL,
        addedAt INTEGER NOT NULL,
        PRIMARY KEY (profileId, kind, itemId)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profileId TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_search_cache_profile_type 
      ON search_cache(profileId, type)
    `);
  }

  // Profile Management
  async saveProfile(profile: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const encryptedPassword = CryptoJS.AES.encrypt(
      profile.password,
      ENCRYPTION_KEY
    ).toString();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO profiles 
      (id, name, serverUrl, username, password, m3uUrl, userAgent, createdAt, lastUsed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      profile.id,
      profile.name,
      profile.serverUrl,
      profile.username,
      encryptedPassword,
      profile.m3uUrl || null,
      profile.userAgent || null,
      profile.createdAt,
      profile.lastUsed
    );
  }

  async getProfiles(): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM profiles ORDER BY lastUsed DESC');
    const rows = stmt.all() as any[];

    return rows.map((row) => ({
      ...row,
      password: CryptoJS.AES.decrypt(row.password, ENCRYPTION_KEY).toString(
        CryptoJS.enc.Utf8
      ),
    }));
  }

  async getProfile(id: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM profiles WHERE id = ?');
    const row = stmt.get(id) as any;

    if (row) {
      return {
        ...row,
        password: CryptoJS.AES.decrypt(row.password, ENCRYPTION_KEY).toString(
          CryptoJS.enc.Utf8
        ),
      };
    }
    return null;
  }

  async deleteProfile(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM profiles WHERE id = ?');
    stmt.run(id);
  }

  async updateLastUsed(profileId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('UPDATE profiles SET lastUsed = ? WHERE id = ?');
    stmt.run(Date.now(), profileId);
  }

  // Playback History
  async savePlaybackPosition(
    type: string,
    contentId: string,
    position: number,
    duration: number,
    watched: boolean,
    meta?: any
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO playback_history
      (type, contentId, position, duration, watched, lastPlayedAt, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(type, contentId) DO UPDATE SET
        position = excluded.position,
        duration = excluded.duration,
        watched = excluded.watched,
        lastPlayedAt = excluded.lastPlayedAt,
        meta = COALESCE(excluded.meta, playback_history.meta)
    `);

    stmt.run(
      type,
      contentId,
      Math.floor(position) || 0,
      Math.floor(duration) || 0,
      watched ? 1 : 0,
      Date.now(),
      meta ? JSON.stringify(meta) : null
    );
  }

  async getPlaybackPosition(type: string, contentId: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      'SELECT * FROM playback_history WHERE type = ? AND contentId = ?'
    );

    return stmt.get(type, contentId) || null;
  }

  async getPlaybackHistory(type: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db
      .prepare('SELECT * FROM playback_history WHERE type = ? ORDER BY lastPlayedAt DESC LIMIT 500')
      .all(type) as any[];

    return rows.map((row) => ({
      ...row,
      meta: row.meta ? JSON.parse(row.meta) : null,
    }));
  }

  async getContinueWatching(limit: number = 20): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM playback_history 
      WHERE watched = 0 AND position > 0 AND type != 'live'
      ORDER BY lastPlayedAt DESC LIMIT ?
    `);

    return (stmt.all(limit) as any[]).map((row) => ({
      ...row,
      meta: row.meta ? JSON.parse(row.meta) : null,
    }));
  }

  // Favorites
  async getFavorites(profileId: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db
      .prepare('SELECT * FROM favorites WHERE profileId = ? ORDER BY addedAt DESC')
      .all(profileId) as any[];
    return rows.map((row) => ({ ...row, data: JSON.parse(row.data) }));
  }

  async toggleFavorite(profileId: string, kind: string, itemId: string, data: any): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const removed = this.db
      .prepare('DELETE FROM favorites WHERE profileId = ? AND kind = ? AND itemId = ?')
      .run(profileId, kind, itemId);
    if (removed.changes > 0) return false;

    this.db
      .prepare('INSERT INTO favorites (profileId, kind, itemId, data, addedAt) VALUES (?, ?, ?, ?, ?)')
      .run(profileId, kind, itemId, JSON.stringify(data), Date.now());
    return true;
  }

  // Search Cache
  async cacheSearch(
    profileId: string,
    type: string,
    title: string,
    data: any
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO search_cache 
      (profileId, type, title, data, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(profileId, type, title, JSON.stringify(data), Date.now());
  }

  async searchCache(profileId: string, query: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM search_cache 
      WHERE profileId = ? AND title LIKE ? 
      ORDER BY createdAt DESC LIMIT 50
    `);

    const rows = stmt.all(profileId, `%${query}%`) as any[];
    return rows.map((row) => ({
      ...row,
      data: JSON.parse(row.data),
    }));
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

export const db = new DatabaseManager();
