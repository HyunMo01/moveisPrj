<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { isFirebaseConfigured } from '../firebase/config'
import {
  addComment,
  deleteMovieCompletely,
  incrementMovieLike,
  subscribeComments,
  subscribeMovie,
  subscribePosterImage,
} from '../services/movies'

const props = defineProps({
  id: { type: String, required: true },
})

const router = useRouter()

const movie = ref(null)
const comments = ref([])
const loadError = ref(null)
const commentText = ref('')
const submitting = ref(false)
const likeBusy = ref(false)
const likedStorageKey = computed(() => `movie_like_${props.id}`)
const hasLiked = ref(false)
const deleteBusy = ref(false)
const posterUrl = ref(null)

let unsubMovie
let unsubComments
let unsubPoster

function readLikedState() {
  try {
    hasLiked.value = localStorage.getItem(likedStorageKey.value) === '1'
  } catch {
    hasLiked.value = false
  }
}

function setupSubscriptions() {
  loadError.value = null
  if (!isFirebaseConfigured()) {
    loadError.value =
      'Firebase가 설정되지 않았습니다. .env에 VITE_FIREBASE_* 값을 넣고 서버를 재시작하세요.'
    return
  }
  readLikedState()

  unsubPoster?.()
  unsubPoster = undefined
  posterUrl.value = null

  unsubMovie?.()
  unsubComments?.()

  unsubMovie = subscribeMovie(
    props.id,
    (data) => {
      movie.value = data
      if (!data) loadError.value = '글을 찾을 수 없습니다.'
      setupPosterSubscription()
    },
    (err) => {
      loadError.value = err.message ?? String(err)
    },
  )

  unsubComments = subscribeComments(
    props.id,
    (list) => {
      comments.value = list
    },
    (err) => {
      loadError.value = err.message ?? String(err)
    },
  )
}

function setupPosterSubscription() {
  unsubPoster?.()
  unsubPoster = undefined
  posterUrl.value = null
  if (!isFirebaseConfigured()) return
  const imgId = movie.value?.posterImageId
  if (!imgId) return
  unsubPoster = subscribePosterImage(
    imgId,
    (url) => {
      posterUrl.value = url
    },
    (err) => {
      loadError.value = err.message ?? String(err)
    },
  )
}

watch(
  () => props.id,
  () => setupSubscriptions(),
  { immediate: true },
)

onUnmounted(() => {
  unsubMovie?.()
  unsubComments?.()
  unsubPoster?.()
})

async function submitComment() {
  const text = commentText.value.trim()
  if (!text || submitting.value) return
  submitting.value = true
  try {
    await addComment(props.id, text)
    commentText.value = ''
  } catch (e) {
    loadError.value = e.message ?? String(e)
  } finally {
    submitting.value = false
  }
}

async function onLike() {
  if (hasLiked.value || likeBusy.value || !movie.value) return
  likeBusy.value = true
  try {
    await incrementMovieLike(props.id)
    try {
      localStorage.setItem(likedStorageKey.value, '1')
    } catch {
      /* ignore */
    }
    hasLiked.value = true
  } catch (e) {
    loadError.value = e.message ?? String(e)
  } finally {
    likeBusy.value = false
  }
}

function formatDate(ts) {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function onDelete() {
  if (
    !movie.value ||
    deleteBusy.value ||
    !confirm('이 글과 댓글, 포스터 이미지를 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.')
  ) {
    return
  }
  deleteBusy.value = true
  loadError.value = null
  try {
    unsubMovie?.()
    unsubComments?.()
    unsubMovie = undefined
    unsubComments = undefined
    unsubPoster?.()
    unsubPoster = undefined
    await deleteMovieCompletely(props.id)
    router.replace('/')
  } catch (e) {
    loadError.value = e.message ?? String(e)
    setupSubscriptions()
  } finally {
    deleteBusy.value = false
  }
}
</script>

<template>
  <div class="detail">
    <RouterLink class="back" to="/">← 목록</RouterLink>

    <p v-if="loadError && !movie" class="status error">{{ loadError }}</p>

    <article v-else-if="movie" class="article">
      <div v-if="posterUrl" class="poster-hero">
        <img :src="posterUrl" :alt="`${movie.title} 포스터`" />
      </div>
      <header class="article-head">
        <div class="head-row">
          <div>
            <h1>{{ movie.title }}</h1>
            <time v-if="movie.createdAt" class="date">{{ formatDate(movie.createdAt) }}</time>
          </div>
          <div class="article-tools">
            <RouterLink class="btn small" :to="`/movie/${id}/edit`">수정</RouterLink>
            <button type="button" class="btn small danger" :disabled="deleteBusy" @click="onDelete">
              {{ deleteBusy ? '삭제 중…' : '삭제' }}
            </button>
          </div>
        </div>
      </header>
      <div class="body">
        <p v-for="(para, i) in movie.introduction.split('\n')" :key="i" class="para">
          {{ para }}
        </p>
      </div>

      <div class="like-row">
        <button
          type="button"
          class="btn like-btn"
          :disabled="hasLiked || likeBusy"
          @click="onLike"
        >
          <span class="heart" aria-hidden="true">{{ hasLiked ? '♥' : '♡' }}</span>
          좋아요
          <strong class="count">{{ movie.likeCount }}</strong>
        </button>
        <span v-if="hasLiked" class="hint">이 브라우저에서 이미 좋아요를 눌렀습니다.</span>
      </div>
    </article>

    <section v-if="movie" class="comments-section">
      <h2>댓글</h2>
      <p v-if="loadError && movie" class="status error subtle">{{ loadError }}</p>

      <form class="comment-form" @submit.prevent="submitComment">
        <label class="sr-only" for="comment-input">댓글</label>
        <textarea
          id="comment-input"
          v-model="commentText"
          rows="3"
          placeholder="댓글을 입력하세요 (로그인 없이 작성됩니다)"
          maxlength="2000"
        />
        <button type="submit" class="btn primary" :disabled="submitting || !commentText.trim()">
          {{ submitting ? '등록 중…' : '댓글 등록' }}
        </button>
      </form>

      <ul v-if="comments.length" class="comment-list">
        <li v-for="c in comments" :key="c.id" class="comment-item">
          <p class="comment-text">{{ c.content }}</p>
          <time class="comment-meta">{{ formatDate(c.createdAt) }}</time>
        </li>
      </ul>
      <p v-else class="no-comments">아직 댓글이 없습니다.</p>
    </section>
  </div>
</template>

<style scoped>
.detail {
  padding: 2rem 1.5rem 3rem;
  text-align: left;
  max-width: 720px;
  margin: 0 auto;
}

.back {
  display: inline-block;
  margin-bottom: 1.5rem;
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

.back:hover {
  text-decoration: underline;
}

.status.error {
  padding: 1rem;
  border-radius: 8px;
  background: rgba(185, 28, 28, 0.08);
  color: #b91c1c;
}

.status.subtle {
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.poster-hero {
  margin: 0 0 1.25rem;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--code-bg);
}

.poster-hero img {
  display: block;
  width: 100%;
  max-height: 420px;
  object-fit: contain;
}

.head-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.article-tools {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.btn.small {
  padding: 0.4rem 0.85rem;
  font-size: 0.875rem;
}

.btn.small.danger {
  border-color: rgba(185, 28, 28, 0.45);
  color: #b91c1c;
  background: rgba(185, 28, 28, 0.06);
}

.btn.small.danger:hover:not(:disabled) {
  background: rgba(185, 28, 28, 0.12);
}

.article-head h1 {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
  line-height: 1.25;
}

.date {
  font-size: 0.9rem;
  color: var(--text);
}

.body {
  margin: 1.5rem 0 2rem;
}

.para {
  margin: 0 0 1rem;
  line-height: 1.65;
  color: var(--text-h);
  white-space: pre-wrap;
}

.like-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
}

.like-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.like-btn .count {
  font-weight: 600;
  margin-left: 0.25rem;
}

.heart {
  font-size: 1.1rem;
}

.hint {
  font-size: 0.8rem;
  color: var(--text);
}

.comments-section {
  margin-top: 2.5rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border);
}

.comments-section h2 {
  font-size: 1.2rem;
  margin: 0 0 1rem;
}

.comment-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.comment-form textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-h);
  font: inherit;
  line-height: 1.5;
  resize: vertical;
}

.comment-form textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.comment-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.comment-item {
  padding: 1rem 1.1rem;
  border-radius: 10px;
  background: var(--code-bg);
  border: 1px solid var(--border);
}

.comment-text {
  margin: 0 0 0.5rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.comment-meta {
  font-size: 0.8rem;
  color: var(--text);
}

.no-comments {
  color: var(--text);
  font-size: 0.95rem;
  margin: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
