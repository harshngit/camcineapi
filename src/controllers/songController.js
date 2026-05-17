// ============================================================
// songController.js — Camcine OTT Song Module
// Routes: /api/v1/songs
// ============================================================

const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { uploadToGCS, saveUploadRecord } = require('../middleware/uploadMiddleware');

// ─────────────────────────────────────────────────────────────
// 1. GET /songs
// ─────────────────────────────────────────────────────────────
const getAllSongs = async (req, res, next) => {
  const {
    page = 1, limit = 10,
    language, region, genre, is_free, search,
    mood, album, festival,
    sort = 'newest',
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const statusFilter = req.user?.role === 'admin' ? req.query.status : 'published';

  const conditions = [`c.type = 'song'`];
  const params = [];
  let idx = 1;

  if (statusFilter) { conditions.push(`c.status = $${idx++}`);          params.push(statusFilter); }
  if (language)     { conditions.push(`c.language ILIKE $${idx++}`);    params.push(language); }
  if (region)       { conditions.push(`c.region ILIKE $${idx++}`);      params.push(region); }
  if (is_free)      { conditions.push(`c.is_free = $${idx++}`);         params.push(is_free === 'true'); }
  if (genre)        { conditions.push(`c.genre @> $${idx++}::jsonb`);   params.push(JSON.stringify([genre])); }
  if (search) {
    conditions.push(`(c.title ILIKE $${idx} OR c.description ILIKE $${idx + 1})`);
    params.push(`%${search}%`, `%${search}%`);
    idx += 2;
  }
  if (mood)     { conditions.push(`sm.mood_tags @> $${idx++}::jsonb`); params.push(JSON.stringify([mood])); }
  if (album)    { conditions.push(`sm.album ILIKE $${idx++}`);         params.push(`%${album}%`); }
  if (festival) { conditions.push(`sm.festival ILIKE $${idx++}`);      params.push(`%${festival}%`); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const sortMap = {
    newest: 'c.created_at DESC', oldest: 'c.created_at ASC', title: 'c.title ASC',
  };
  const orderBy = sortMap[sort] || 'c.created_at DESC';

  try {
    const dataQuery = `
      SELECT
        c.id, c.title AS song_name, c.description, c.language, c.region,
        c.genre, c.director, c.release_year, c.rating, c.status,
        c.poster_url, c.thumbnail_url,
        c.stream_url_hls, c.stream_url_dash,
        c.duration_seconds, c.is_free, c.price_tvod,
        c.imdb_id, c.tags, c.created_at, c.updated_at,
        sm.mood_tags, sm.instruments, sm.festival, sm.album,
        sm.lyrics_url, sm.audio_url_hq, sm.audio_url_lq,
        sm.video_url AS song_video_url,
        sm.artist_ids,
        COALESCE(
          json_agg(
            json_build_object(
              'id',             cc.id,
              'actor_id',       cc.actor_id,
              'actor_name',     COALESCE(cc.actor_name, a.name),
              'character_name', cc.character_name,
              'role_type',      cc.role_type,
              'billing_order',  cc.billing_order,
              'headshot_url',   COALESCE(cc.headshot_url, cc.cast_image, a.headshot_url)
            ) ORDER BY cc.billing_order ASC
          ) FILTER (WHERE cc.id IS NOT NULL),
          '[]'::json
        ) AS cast
      FROM content c
      LEFT JOIN songs_metadata sm ON sm.id = c.id
      LEFT JOIN content_cast cc ON cc.content_id = c.id
      LEFT JOIN actors a ON a.id = cc.actor_id
      ${where}
      GROUP BY c.id, sm.id
      ORDER BY ${orderBy}
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT c.id)
      FROM content c
      LEFT JOIN songs_metadata sm ON sm.id = c.id
      ${where}
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, [...params, parseInt(limit), offset]),
      pool.query(countQuery, params),
    ]);

    const total = parseInt(countResult.rows[0].count);
    return sendSuccess(res, {
      songs: dataResult.rows,
      pagination: {
        page: parseInt(page), limit: parseInt(limit), total,
        total_pages: Math.ceil(total / parseInt(limit)),
        has_next: parseInt(page) < Math.ceil(total / parseInt(limit)),
        has_prev: parseInt(page) > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 2. GET /songs/:id
// ─────────────────────────────────────────────────────────────
const getSongById = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id, c.title AS song_name, c.description, c.language, c.region,
        c.genre, c.director, c.release_year, c.rating, c.status,
        c.poster_url, c.thumbnail_url,
        c.stream_url_hls, c.stream_url_dash,
        c.duration_seconds, c.is_free, c.price_tvod,
        c.imdb_id, c.tags, c.created_at, c.updated_at,
        sm.mood_tags, sm.instruments, sm.festival, sm.album,
        sm.lyrics_url, sm.audio_url_hq, sm.audio_url_lq,
        sm.video_url AS song_video_url,
        sm.artist_ids,
        COALESCE(
          json_agg(
            json_build_object(
              'id',             cc.id,
              'actor_id',       cc.actor_id,
              'actor_name',     COALESCE(cc.actor_name, a.name),
              'character_name', cc.character_name,
              'role_type',      cc.role_type,
              'billing_order',  cc.billing_order,
              'headshot_url',   COALESCE(cc.headshot_url, cc.cast_image, a.headshot_url),
              'is_verified',    a.is_verified
            ) ORDER BY cc.billing_order ASC
          ) FILTER (WHERE cc.id IS NOT NULL),
          '[]'::json
        ) AS cast
      FROM content c
      LEFT JOIN songs_metadata sm ON sm.id = c.id
      LEFT JOIN content_cast cc ON cc.content_id = c.id
      LEFT JOIN actors a ON a.id = cc.actor_id
      WHERE c.id = $1 AND c.type = 'song'
      GROUP BY c.id, sm.id
    `, [req.params.id]);

    if (!result.rows.length) return sendError(res, 'Song not found.', 404);
    return sendSuccess(res, { song: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 3. POST /songs — Create song with ALL OTT fields
// ─────────────────────────────────────────────────────────────
const createSong = async (req, res, next) => {
  const {
    // Core identity
    song_name,          // maps to content.title
    description,
    language,
    region,
    genre,
    director,           // music director / composer
    release_year,
    rating,
    imdb_id,
    tags,

    // Streaming / video
    stream_url_hls,     // HLS stream URL (after transcoding)
    stream_url_dash,    // DASH stream URL (after transcoding)

    // Images
    poster_url,
    thumbnail_url,

    // Pricing
    duration_seconds,
    is_free,
    price_tvod,

    // Song-specific metadata (goes to songs_metadata table)
    mood_tags,
    instruments,
    festival,
    album,
    lyrics_url,         // .lrc / .vtt lyrics file URL
    audio_url_hq,       // 320kbps audio URL
    audio_url_lq,       // 128kbps audio URL
    video_url,          // music video / song video URL
    artist_ids,         // array of actor UUIDs

    // Cast (singers, musicians, lyricists)
    cast = [],
  } = req.body;

  if (!song_name) return sendError(res, 'song_name is required.', 400);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert into content table
    const contentResult = await client.query(`
      INSERT INTO content (
        title, type, description, language, region,
        genre, director, release_year, rating,
        poster_url, thumbnail_url,
        stream_url_hls, stream_url_dash,
        duration_seconds, is_free, price_tvod,
        imdb_id, tags,
        status, created_by
      ) VALUES ($1,'song',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'draft',$18)
      RETURNING *
    `, [
      song_name, description, language, region,
      JSON.stringify(genre || []),
      director, release_year, rating,
      poster_url || null,
      thumbnail_url || null,
      stream_url_hls || null,
      stream_url_dash || null,
      duration_seconds || null,
      is_free || false,
      price_tvod || 0,
      imdb_id || null,
      JSON.stringify(tags || []),
      req.user.id,
    ]);

    const song = contentResult.rows[0];

    // Insert into songs_metadata table
    await client.query(`
      INSERT INTO songs_metadata (
        id, mood_tags, instruments, festival, album,
        lyrics_url, audio_url_hq, audio_url_lq,
        video_url, artist_ids
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `, [
      song.id,
      JSON.stringify(mood_tags || []),
      JSON.stringify(instruments || []),
      festival || null,
      album || null,
      lyrics_url || null,
      audio_url_hq || null,
      audio_url_lq || null,
      video_url || null,
      JSON.stringify(artist_ids || []),
    ]);

    // Insert cast members
    const insertedCast = [];
    for (const member of cast) {
      if (!member.actor_id && !member.actor_name) continue;
      const r = await client.query(`
        INSERT INTO content_cast (
          content_id, actor_id, actor_name, character_name,
          role_type, billing_order, headshot_url, cast_image
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (content_id, actor_id) DO UPDATE SET
          character_name = EXCLUDED.character_name,
          role_type      = EXCLUDED.role_type,
          billing_order  = EXCLUDED.billing_order
        RETURNING *
      `, [
        song.id,
        member.actor_id || null,
        member.actor_name || null,
        member.character_name || null,
        member.role_type || 'singer',
        member.billing_order || 99,
        member.headshot_url || null,
        member.cast_image || null,
      ]);
      insertedCast.push(r.rows[0]);
    }

    await client.query('COMMIT');

    return sendSuccess(res, {
      song: {
        ...song,
        song_name: song.title,
        cast: insertedCast,
        mood_tags: mood_tags || [],
        instruments: instruments || [],
        festival: festival || null,
        album: album || null,
        lyrics_url: lyrics_url || null,
        audio_url_hq: audio_url_hq || null,
        audio_url_lq: audio_url_lq || null,
        song_video_url: video_url || null,
        artist_ids: artist_ids || [],
      }
    }, 'Song created successfully.', 201);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// 4. PUT /songs/:id
// ─────────────────────────────────────────────────────────────
const updateSong = async (req, res, next) => {
  const contentFields = [
    'title', 'description', 'language', 'region', 'genre',
    'director', 'release_year', 'rating', 'status',
    'poster_url', 'thumbnail_url',
    'stream_url_hls', 'stream_url_dash',
    'duration_seconds', 'is_free', 'price_tvod', 'imdb_id', 'tags',
  ];
  const metaFields = [
    'mood_tags', 'instruments', 'festival', 'album',
    'lyrics_url', 'audio_url_hq', 'audio_url_lq', 'video_url', 'artist_ids',
  ];
  const jsonFields = ['genre', 'tags', 'mood_tags', 'instruments', 'artist_ids'];

  // Allow song_name as alias for title
  if (req.body.song_name) req.body.title = req.body.song_name;

  try {
    const existing = await pool.query(
      `SELECT id FROM content WHERE id = $1 AND type = 'song'`,
      [req.params.id]
    );
    if (!existing.rows.length) return sendError(res, 'Song not found.', 404);

    const cUpdates = []; const cValues = []; let cIdx = 1;
    contentFields.forEach(f => {
      if (req.body[f] !== undefined) {
        cUpdates.push(`${f} = $${cIdx++}`);
        cValues.push(jsonFields.includes(f) ? JSON.stringify(req.body[f]) : req.body[f]);
      }
    });
    if (cUpdates.length) {
      cUpdates.push(`updated_at = NOW()`);
      cValues.push(req.params.id);
      await pool.query(`UPDATE content SET ${cUpdates.join(', ')} WHERE id = $${cIdx}`, cValues);
    }

    const mUpdates = []; const mValues = []; let mIdx = 1;
    metaFields.forEach(f => {
      if (req.body[f] !== undefined) {
        mUpdates.push(`${f} = $${mIdx++}`);
        mValues.push(jsonFields.includes(f) ? JSON.stringify(req.body[f]) : req.body[f]);
      }
    });
    if (mUpdates.length) {
      mUpdates.push(`updated_at = NOW()`);
      mValues.push(req.params.id);
      await pool.query(`UPDATE songs_metadata SET ${mUpdates.join(', ')} WHERE id = $${mIdx}`, mValues);
    }

    if (!cUpdates.length && !mUpdates.length) {
      return sendError(res, 'No valid fields provided to update.', 400);
    }

    const result = await pool.query(`
      SELECT c.*, c.title AS song_name,
             sm.mood_tags, sm.instruments, sm.festival, sm.album,
             sm.lyrics_url, sm.audio_url_hq, sm.audio_url_lq,
             sm.video_url AS song_video_url, sm.artist_ids
      FROM content c
      LEFT JOIN songs_metadata sm ON sm.id = c.id
      WHERE c.id = $1
    `, [req.params.id]);

    return sendSuccess(res, { song: result.rows[0] }, 'Song updated.');
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 5. DELETE /songs/:id
// ─────────────────────────────────────────────────────────────
const deleteSong = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE content SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND type = 'song' AND status != 'archived'
       RETURNING id, title`,
      [req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Song not found or already archived.', 404);
    return sendSuccess(res, {}, 'Song archived.');
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
// UPLOAD ENDPOINTS — content_id passed in body
// ═══════════════════════════════════════════════════════════════

// Upload HQ + optional LQ audio
const uploadSongAudio = async (req, res, next) => {
  try {
    const hqFile = req.files?.audio_hq?.[0];
    const lqFile = req.files?.audio_lq?.[0];
    if (!hqFile) return sendError(res, 'audio_hq file is required.', 400);

    const song_id = req.body.song_id;
    if (!song_id) return sendError(res, 'song_id is required in the request body.', 400);

    const song = await pool.query(`SELECT id FROM content WHERE id = $1 AND type = 'song'`, [song_id]);
    if (!song.rows.length) return sendError(res, 'Song not found.', 404);

    const result = {};

    const hq = await uploadToGCS({
      fileBuffer: hqFile.buffer, originalName: hqFile.originalname,
      mimeType: hqFile.mimetype, fileType: 'audio', folder: 'audio/hq',
    });
    const hqRecord = await saveUploadRecord({
      uploadedBy: req.user.id, originalName: hqFile.originalname,
      uniqueName: hq.uniqueName, fileType: 'audio', mimeType: hqFile.mimetype,
      fileSize: hqFile.size, gcsPath: hq.gcsPath, publicUrl: hq.publicUrl,
      linkedToId: song_id, linkedToType: 'content',
      metadata: { quality: 'hq', bitrate: '320kbps' },
    });
    result.audio_hq = { upload_id: hqRecord.id, public_url: hq.publicUrl };

    let lqPublicUrl = null;
    if (lqFile) {
      const lq = await uploadToGCS({
        fileBuffer: lqFile.buffer, originalName: lqFile.originalname,
        mimeType: lqFile.mimetype, fileType: 'audio', folder: 'audio/lq',
      });
      const lqRecord = await saveUploadRecord({
        uploadedBy: req.user.id, originalName: lqFile.originalname,
        uniqueName: lq.uniqueName, fileType: 'audio', mimeType: lqFile.mimetype,
        fileSize: lqFile.size, gcsPath: lq.gcsPath, publicUrl: lq.publicUrl,
        linkedToId: song_id, linkedToType: 'content',
        metadata: { quality: 'lq', bitrate: '128kbps' },
      });
      result.audio_lq = { upload_id: lqRecord.id, public_url: lq.publicUrl };
      lqPublicUrl = lq.publicUrl;
    }

    await pool.query(
      `UPDATE songs_metadata SET
         audio_url_hq = $1,
         audio_url_lq = COALESCE($2, audio_url_lq),
         updated_at = NOW()
       WHERE id = $3`,
      [hq.publicUrl, lqPublicUrl, song_id]
    );

    return sendSuccess(res, result, 'Song audio uploaded and linked.', 201);
  } catch (err) {
    next(err);
  }
};

// Upload lyrics file
const uploadSongLyrics = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 'No lyrics file provided.', 400);
    const song_id = req.body.song_id;
    if (!song_id) return sendError(res, 'song_id is required in the request body.', 400);

    const song = await pool.query(`SELECT id FROM content WHERE id = $1 AND type = 'song'`, [song_id]);
    if (!song.rows.length) return sendError(res, 'Song not found.', 404);

    const { uniqueName, gcsPath, publicUrl } = await uploadToGCS({
      fileBuffer: req.file.buffer, originalName: req.file.originalname,
      mimeType: req.file.mimetype || 'text/plain',
      fileType: 'document', folder: 'lyrics',
    });
    await saveUploadRecord({
      uploadedBy: req.user.id, originalName: req.file.originalname,
      uniqueName, fileType: 'document', mimeType: req.file.mimetype || 'text/plain',
      fileSize: req.file.size, gcsPath, publicUrl,
      linkedToId: song_id, linkedToType: 'content',
      metadata: { purpose: 'lyrics' },
    });
    await pool.query(
      `UPDATE songs_metadata SET lyrics_url = $1, updated_at = NOW() WHERE id = $2`,
      [publicUrl, song_id]
    );
    return sendSuccess(res, { public_url: publicUrl, file_name: uniqueName }, 'Lyrics uploaded and linked.', 201);
  } catch (err) {
    next(err);
  }
};

// Upload song thumbnail/cover
const uploadSongThumbnail = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 'No image file provided.', 400);
    const song_id = req.body.song_id;
    if (!song_id) return sendError(res, 'song_id is required in the request body.', 400);

    const song = await pool.query(`SELECT id FROM content WHERE id = $1 AND type = 'song'`, [song_id]);
    if (!song.rows.length) return sendError(res, 'Song not found.', 404);

    const { uniqueName, gcsPath, publicUrl } = await uploadToGCS({
      fileBuffer: req.file.buffer, originalName: req.file.originalname,
      mimeType: req.file.mimetype, fileType: 'image', folder: 'images/song-thumbnails',
    });
    await saveUploadRecord({
      uploadedBy: req.user.id, originalName: req.file.originalname,
      uniqueName, fileType: 'image', mimeType: req.file.mimetype,
      fileSize: req.file.size, gcsPath, publicUrl,
      linkedToId: song_id, linkedToType: 'content',
      metadata: { image_purpose: 'thumbnail' },
    });
    await pool.query(
      `UPDATE content SET thumbnail_url = $1, updated_at = NOW() WHERE id = $2`,
      [publicUrl, song_id]
    );
    return sendSuccess(res, { public_url: publicUrl }, 'Song thumbnail uploaded.', 201);
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
// CAST ENDPOINTS
// ═══════════════════════════════════════════════════════════════

const addSongCast = async (req, res, next) => {
  const { actor_id, actor_name, character_name, role_type, billing_order, headshot_url, cast_image } = req.body;
  if (!actor_id && !actor_name) return sendError(res, 'actor_id or actor_name is required.', 400);

  try {
    const song = await pool.query(`SELECT id FROM content WHERE id = $1 AND type = 'song'`, [req.params.id]);
    if (!song.rows.length) return sendError(res, 'Song not found.', 404);

    let resolvedName = actor_name;
    let resolvedHeadshot = headshot_url;
    if (actor_id) {
      const actor = await pool.query('SELECT name, headshot_url FROM actors WHERE id = $1', [actor_id]);
      if (!actor.rows.length) return sendError(res, 'Artist not found.', 404);
      resolvedName     = resolvedName     || actor.rows[0].name;
      resolvedHeadshot = resolvedHeadshot || actor.rows[0].headshot_url;
    }

    const result = await pool.query(`
      INSERT INTO content_cast (
        content_id, actor_id, actor_name, character_name,
        role_type, billing_order, headshot_url, cast_image
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (content_id, actor_id) DO UPDATE SET
        character_name = EXCLUDED.character_name,
        role_type      = EXCLUDED.role_type,
        billing_order  = EXCLUDED.billing_order,
        headshot_url   = EXCLUDED.headshot_url,
        cast_image     = EXCLUDED.cast_image
      RETURNING *
    `, [
      req.params.id,
      actor_id || null, resolvedName, character_name || null,
      role_type || 'singer', billing_order || 99,
      resolvedHeadshot || null, cast_image || null,
    ]);
    return sendSuccess(res, { cast: result.rows[0] }, 'Artist added to song.', 201);
  } catch (err) {
    next(err);
  }
};

const removeSongCast = async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM content_cast WHERE id = $1 AND content_id = $2 RETURNING id',
      [req.params.castId, req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Artist not found on this song.', 404);
    return sendSuccess(res, {}, 'Artist removed from song.');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllSongs,
  getSongById,
  createSong,
  updateSong,
  deleteSong,
  uploadSongAudio,
  uploadSongLyrics,
  uploadSongThumbnail,
  addSongCast,
  removeSongCast,
};