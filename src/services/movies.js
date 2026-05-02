import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { getDb } from '../firebase/config'

export const MOVIES_PAGE_SIZE = 5

/** Firestore 문서 1MB 한도 → 원본 파일은 약 이 크기 이하로 제한 */
export const MAX_POSTER_FILE_BYTES = 600 * 1024

const moviesCol = () => collection(getDb(), 'movies')
const imagesCol = () => collection(getDb(), 'images')

export function imageDocToDataUrl(img) {
  if (!img?.base64 || !img?.mimeType) return null
  return `data:${img.mimeType};base64,${img.base64}`
}

function mapImageDoc(id, data) {
  return {
    id,
    movieId: data.movieId ?? '',
    kind: data.kind ?? 'poster',
    mimeType: data.mimeType ?? 'image/jpeg',
    base64: data.base64 ?? '',
    sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : 0,
    createdAt: data.createdAt ?? null,
  }
}

function mapMovieDoc(id, data) {
  return {
    id,
    title: data.title ?? '',
    introduction: data.introduction ?? '',
    likeCount: typeof data.likeCount === 'number' ? data.likeCount : 0,
    createdAt: data.createdAt ?? null,
    posterImageId: data.posterImageId ?? null,
    posterUrl: null,
  }
}

function validateImageFileForFirestore(file) {
  if (!(file instanceof Blob) || file.size <= 0) {
    throw new Error('유효한 이미지 파일이 아닙니다.')
  }
  if (file.size > MAX_POSTER_FILE_BYTES) {
    throw new Error(
      `이미지는 약 ${MAX_POSTER_FILE_BYTES / 1024}KB 이하만 저장할 수 있습니다. (Firestore 문서 크기 제한)`,
    )
  }
}

function fileToBase64Payload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('파일을 읽지 못했습니다.'))
        return
      }
      const comma = result.indexOf(',')
      const header = result.slice(0, comma)
      const b64 = result.slice(comma + 1)
      const mimeMatch = header.match(/^data:([^;]+)/)
      const mimeType = mimeMatch
        ? mimeMatch[1]
        : file.type && file.type.startsWith('image/')
          ? file.type
          : 'image/jpeg'
      if (b64.length > 950_000) {
        reject(
          new Error(
            '인코딩 후 용량이 너무 큽니다. 더 작은 이미지를 사용해 주세요.',
          ),
        )
        return
      }
      resolve({ base64: b64, mimeType })
    }
    reader.onerror = () => reject(reader.error ?? new Error('파일 읽기 실패'))
    reader.readAsDataURL(file)
  })
}

async function createPosterImageDoc(movieId, file) {
  validateImageFileForFirestore(file)
  const { base64, mimeType } = await fileToBase64Payload(file)
  return addDoc(imagesCol(), {
    movieId,
    kind: 'poster',
    mimeType,
    base64,
    sizeBytes: file.size,
    createdAt: serverTimestamp(),
  })
}

/**
 * images 컬렉션에 포스터를 만들고 movies 문서의 posterImageId를 연결합니다.
 */
export async function attachPosterToMovie(movieId, file, { replaceOld = true } = {}) {
  const db = getDb()
  const movieRef = doc(db, 'movies', movieId)
  const movieSnap = await getDoc(movieRef)
  const oldPosterImageId =
    movieSnap.exists() && movieSnap.data().posterImageId
      ? movieSnap.data().posterImageId
      : null

  const imgRef = await createPosterImageDoc(movieId, file)
  await updateDoc(movieRef, { posterImageId: imgRef.id })

  if (replaceOld && oldPosterImageId && oldPosterImageId !== imgRef.id) {
    try {
      await deleteDoc(doc(db, 'images', oldPosterImageId))
    } catch {
      /* 이미 없음 */
    }
  }
  return imgRef
}

export async function fetchMoviesPage(cursorSnapshot = null) {
  const constraints = [orderBy('createdAt', 'desc'), limit(MOVIES_PAGE_SIZE)]
  if (cursorSnapshot) {
    constraints.splice(1, 0, startAfter(cursorSnapshot))
  }
  const q = query(moviesCol(), ...constraints)
  const snap = await getDocs(q)
  const raw = snap.docs.map((d) => mapMovieDoc(d.id, d.data()))
  const items = await enrichMoviesWithPosterUrls(raw)
  const lastDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : null
  const hasMore = snap.docs.length === MOVIES_PAGE_SIZE
  return { items, lastDoc, hasMore }
}

async function enrichMoviesWithPosterUrls(items) {
  const db = getDb()
  return Promise.all(
    items.map(async (m) => {
      if (!m.posterImageId) return { ...m, posterUrl: null }
      const imgSnap = await getDoc(doc(db, 'images', m.posterImageId))
      if (!imgSnap.exists()) return { ...m, posterUrl: null }
      const url = imageDocToDataUrl(mapImageDoc(imgSnap.id, imgSnap.data()))
      return { ...m, posterUrl: url }
    }),
  )
}

export function getMovie(movieId) {
  return getDoc(doc(getDb(), 'movies', movieId)).then((snap) => {
    if (!snap.exists()) return null
    return mapMovieDoc(snap.id, snap.data())
  })
}

/** 수정 화면 등에서 포스터 data URL이 필요할 때 */
export async function getMovieWithPosterUrl(movieId) {
  const m = await getMovie(movieId)
  if (!m) return null
  if (!m.posterImageId) return { ...m, posterUrl: null }
  const imgSnap = await getDoc(doc(getDb(), 'images', m.posterImageId))
  if (!imgSnap.exists()) return { ...m, posterUrl: null }
  return {
    ...m,
    posterUrl: imageDocToDataUrl(mapImageDoc(imgSnap.id, imgSnap.data())),
  }
}

export function subscribeMovie(movieId, onData, onError) {
  return onSnapshot(
    doc(getDb(), 'movies', movieId),
    (snap) => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      onData(mapMovieDoc(snap.id, snap.data()))
    },
    onError,
  )
}

/** images 문서 구독 → data URL 문자열 또는 null */
export function subscribePosterImage(posterImageId, onData, onError) {
  if (!posterImageId) {
    onData(null)
    return () => {}
  }
  return onSnapshot(
    doc(getDb(), 'images', posterImageId),
    (snap) => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      onData(imageDocToDataUrl(mapImageDoc(snap.id, snap.data())))
    },
    onError,
  )
}

export function createMovie({ title, introduction }) {
  return addDoc(moviesCol(), {
    title: title.trim(),
    introduction: introduction.trim(),
    likeCount: 0,
    createdAt: serverTimestamp(),
    posterImageId: null,
  })
}

export async function createMovieWithPoster({ title, introduction, posterFile }) {
  const docRef = await createMovie({ title, introduction })
  const hasFile =
    posterFile &&
    (posterFile instanceof File || posterFile instanceof Blob) &&
    posterFile.size > 0

  if (hasFile) {
    await attachPosterToMovie(docRef.id, posterFile, { replaceOld: false })
  }
  return docRef
}

export function updateMovieContent(movieId, { title, introduction }) {
  return updateDoc(doc(getDb(), 'movies', movieId), {
    title: title.trim(),
    introduction: introduction.trim(),
  })
}

export function setMoviePoster(movieId, file) {
  return attachPosterToMovie(movieId, file, { replaceOld: true })
}

export async function clearMoviePoster(movieId, posterImageId) {
  const db = getDb()
  if (posterImageId) {
    try {
      await deleteDoc(doc(db, 'images', posterImageId))
    } catch {
      /* 없음 */
    }
  }
  await updateDoc(doc(db, 'movies', movieId), {
    posterImageId: null,
  })
}

const COMMENT_DELETE_CHUNK = 400

export async function deleteMovieCompletely(movieId) {
  const db = getDb()
  const commentsSnap = await getDocs(commentsCol(movieId))
  const commentDocs = commentsSnap.docs
  const movieRef = doc(db, 'movies', movieId)
  const movieSnap = await getDoc(movieRef)
  const posterImageId =
    movieSnap.exists() && movieSnap.data().posterImageId
      ? movieSnap.data().posterImageId
      : null

  if (posterImageId) {
    try {
      await deleteDoc(doc(db, 'images', posterImageId))
    } catch {
      /* ignore */
    }
  }

  for (let i = 0; i < commentDocs.length; i += COMMENT_DELETE_CHUNK) {
    const batch = writeBatch(db)
    commentDocs.slice(i, i + COMMENT_DELETE_CHUNK).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }

  await deleteDoc(movieRef)
}

export function incrementMovieLike(movieId) {
  return updateDoc(doc(getDb(), 'movies', movieId), {
    likeCount: increment(1),
  })
}

const commentsCol = (movieId) =>
  collection(getDb(), 'movies', movieId, 'comments')

export function fetchComments(movieId) {
  const q = query(commentsCol(movieId), orderBy('createdAt', 'desc'))
  return getDocs(q).then((snap) =>
    snap.docs.map((d) => ({
      id: d.id,
      content: d.data().content ?? '',
      createdAt: d.data().createdAt ?? null,
    })),
  )
}

export function subscribeComments(movieId, onData, onError) {
  const q = query(commentsCol(movieId), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({
          id: d.id,
          content: d.data().content ?? '',
          createdAt: d.data().createdAt ?? null,
        })),
      )
    },
    onError,
  )
}

export function addComment(movieId, content) {
  return addDoc(commentsCol(movieId), {
    content: content.trim(),
    createdAt: serverTimestamp(),
  })
}
