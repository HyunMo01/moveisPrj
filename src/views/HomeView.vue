<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { isFirebaseConfigured } from '../firebase/config'
import { fetchMoviesPage } from '../services/movies'

const movies = ref([])
const loading = ref(true)
const error = ref(null)
const currentPage = ref(0)
const endSnapshots = ref([])
const hasNextPage = ref(false)

async function goToPage(p) {
  loading.value = true
  error.value = null
  try {
    const cursor = p > 0 ? endSnapshots.value[p - 1] : null
    const { items, lastDoc, hasMore } = await fetchMoviesPage(cursor)
    movies.value = items
    currentPage.value = p
    if (lastDoc) {
      const next = [...endSnapshots.value]
      next[p] = lastDoc
      endSnapshots.value = next
    }
    hasNextPage.value = hasMore
  } catch (e) {
    error.value = e.message ?? String(e)
    movies.value = []
  } finally {
    loading.value = false
  }
}

function nextPage() {
  if (!hasNextPage.value) return
  goToPage(currentPage.value + 1)
}

function prevPage() {
  if (currentPage.value <= 0) return
  goToPage(currentPage.value - 1)
}

onMounted(() => {
  if (!isFirebaseConfigured()) {
    loading.value = false
    error.value =
      'Firebase가 설정되지 않았습니다. 프로젝트 루트에 .env 파일을 만들고 VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID 등을 입력한 뒤 개발 서버를 다시 시작하세요.'
    return
  }
  goToPage(0)
})

function formatDate(ts) {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="home">
    <header class="page-head">
      <h1>영화 소개</h1>
      <p class="lead">등록된 영화 소개 글을 페이지당 5개씩 볼 수 있습니다.</p>
      <RouterLink class="btn primary" to="/write">새 소개 글 쓰기</RouterLink>
    </header>

    <p v-if="loading" class="status">불러오는 중…</p>
    <p v-else-if="error" class="status error">{{ error }}</p>

    <ul v-else-if="movies.length" class="movie-list">
      <li v-for="m in movies" :key="m.id" class="movie-card">
        <RouterLink :to="`/movie/${m.id}`" class="card-link">
          <div class="card-inner">
            <div v-if="m.posterUrl" class="thumb-wrap">
              <img :src="m.posterUrl" alt="" class="thumb" />
            </div>
            <div class="card-body">
              <h2>{{ m.title }}</h2>
              <p class="excerpt">{{ m.introduction }}</p>
              <time v-if="m.createdAt" class="meta">{{ formatDate(m.createdAt) }}</time>
            </div>
          </div>
        </RouterLink>
      </li>
    </ul>

    <p v-else class="empty">아직 등록된 글이 없습니다. 첫 글을 작성해 보세요.</p>

    <nav v-if="!loading && !error && (currentPage > 0 || hasNextPage)" class="pager">
      <button type="button" class="btn" :disabled="currentPage <= 0" @click="prevPage">
        이전
      </button>
      <span class="page-num">{{ currentPage + 1 }} 페이지</span>
      <button type="button" class="btn" :disabled="!hasNextPage" @click="nextPage">
        다음
      </button>
    </nav>
  </div>
</template>

<style scoped>
.home {
  padding: 2rem 1.5rem 3rem;
  text-align: left;
  max-width: 720px;
  margin: 0 auto;
}

.page-head {
  margin-bottom: 2rem;
}

.page-head h1 {
  margin-top: 0;
  font-size: 2rem;
}

.lead {
  color: var(--text);
  margin: 0 0 1.25rem;
  line-height: 1.5;
}

.status {
  padding: 1rem;
  border-radius: 8px;
  background: var(--code-bg);
}

.status.error {
  color: #b91c1c;
  border: 1px solid rgba(185, 28, 28, 0.35);
}

.movie-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.movie-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.movie-card:hover {
  box-shadow: var(--shadow);
  border-color: var(--accent-border);
}

.card-link {
  display: block;
  padding: 1.25rem 1.5rem;
  text-decoration: none;
  color: inherit;
}

.card-inner {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.thumb-wrap {
  flex-shrink: 0;
  width: 100px;
  height: 140px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--code-bg);
}

.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-link h2 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  color: var(--text-h);
}

@media (max-width: 520px) {
  .card-inner {
    flex-direction: column;
  }

  .thumb-wrap {
    width: 100%;
    height: 180px;
  }
}

.excerpt {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0 0 0.75rem;
  line-height: 1.55;
  color: var(--text);
}

.meta {
  font-size: 0.85rem;
  color: var(--text);
  opacity: 0.85;
}

.empty {
  padding: 2rem;
  text-align: center;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--text);
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  flex-wrap: wrap;
}

.page-num {
  font-size: 0.95rem;
  color: var(--text-h);
}
</style>
